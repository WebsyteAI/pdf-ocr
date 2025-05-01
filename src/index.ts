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

// OCR endpoint: Use R2 public URL for document_url, save each page as JSON in R2
app.post("/ocr/:key", async (c) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);

  // Use the R2 public URL for the document
  const downloadUrl = `${R2_PUBLIC_URL}/${encodeURIComponent(key)}`;

  // Prepare the OCR API payload
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

  // Save each page as a JSON file in R2
  if (Array.isArray(data.pages)) {
    for (let i = 0; i < data.pages.length; i++) {
      const pageJson = JSON.stringify(data.pages[i], null, 2);
      const pageKey = `${key}.page-${i + 1}.json`;
      await c.env.MY_BUCKET.put(pageKey, pageJson, { httpMetadata: { contentType: "application/json" } });
    }
  }

  return c.json(data);
});

// Autorag endpoint: POST /autorag { query: string }
app.post("/autorag", async (c) => {
  const { query } = await c.req.json();
  if (!query) return c.text("Missing query", 400);
  const answer = await c.env.AI.autorag("airbus_a350").aiSearch({ query });
  return c.json(answer);
});

export default app;
