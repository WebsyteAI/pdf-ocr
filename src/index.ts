import { Hono } from "hono";
import type { Context } from "hono";

export type Env = {
  MY_BUCKET: R2Bucket;
  MISTRAL_OCR_API_KEY: string;
  AI: any;
};

const R2_PUBLIC_URL = "https://pub-8e8f33484ec948a2bc5d784574d78e6b.r2.dev";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c: Context) => c.text("Hello from Worker with R2!"));

// Upload a file to R2
app.post("/upload/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.arrayBuffer();
  await c.env.MY_BUCKET.put(key, body);
  return c.text(`File uploaded as ${key}`);
});

// Download a file from R2
app.get("/download/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "content-type": "application/pdf" } });
});

// Helper: Validate base64 string
function isValidBase64(str: string) {
  if (!str || typeof str !== "string" || str.length < 8) return false;
  // Basic base64 regex (not strict, but avoids obvious errors)
  return /^[A-Za-z0-9+/=\s]+$/.test(str);
}

// Helper: Strip data URL prefix if present
function stripDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/(jpeg|png|jpg));base64,(.*)$/);
  if (match) return match[3];
  return dataUrl;
}

// OCR endpoint: Use R2 public URL for document_url, save each page's markdown and images in R2 (jpeg, no page limit)
app.post("/ocr/:key", async (c) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);

  // Use the R2 public URL for the document
  const downloadUrl = `${R2_PUBLIC_URL}/${encodeURIComponent(key)}`;

  // Prepare the OCR API payload (no page limit)
  const payload = {
    model: "mistral-ocr-latest",
    document: {
      document_url: downloadUrl,
      document_name: key,
      type: "document_url"
    },
    include_image_base64: true
  };

  // Call Mistral OCR API
  const resp = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const err = await resp.text();
    return c.text(`Mistral OCR API error: ${err}`, 502);
  }

  const data = await resp.json();

  // For every page, save markdown and images as separate files in R2 (jpeg)
  if (Array.isArray(data.pages)) {
    for (let i = 0; i < data.pages.length; i++) {
      const page = data.pages[i];
      // Save markdown
      if (page.markdown) {
        const mdKey = `${key}.page-${i + 1}.md`;
        await c.env.MY_BUCKET.put(mdKey, page.markdown, { httpMetadata: { contentType: "text/markdown" } });
      }
      // Save images as jpeg
      if (Array.isArray(page.images)) {
        for (let j = 0; j < page.images.length; j++) {
          const img = page.images[j];
          if (img.image_base64) {
            const base64Data = stripDataUrlPrefix(img.image_base64);
            if (isValidBase64(base64Data)) {
              try {
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const imgKey = `${key}.page-${i + 1}.image-${j + 1}.jpeg`;
                await c.env.MY_BUCKET.put(imgKey, imageBuffer, { httpMetadata: { contentType: "image/jpeg" } });
              } catch (e) {
                console.error(`Failed to decode base64 image for page ${i + 1}, image ${j + 1}:`, e);
                continue;
              }
            } else {
              console.error(`Invalid base64 image for page ${i + 1}, image ${j + 1}:`, base64Data.slice(0, 32) + '...');
            }
          }
        }
      }
    }
  }

  return c.json(data);
});

// Autorag endpoint: POST /autorag { query: string }
app.post("/autorag", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.text("Missing query", 400);
    const answer = await c.env.AI.autorag("airbus_a350").aiSearch({ query });
    return c.json(answer);
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
});

export default app;
