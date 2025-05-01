import { Hono } from "hono";
import type { Context } from "hono";

export type Env = {
  MY_BUCKET: R2Bucket;
  MISTRAL_OCR_API_KEY: string;
};

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
  return new Response(object.body, { headers: { "content-type": "application/octet-stream" } });
});

// OCR endpoint: Fetch PDF from R2 using file key, send to Mistral OCR API, return parsed text
app.post("/ocr/:key", async (c) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);

  // Generate a presigned URL for the PDF in R2 (publicly accessible for Mistral OCR API)
  // If presigned URLs are not available, you must serve the file from your Worker
  // We'll serve the file from the Worker and provide a temporary URL
  // For now, let's assume the Worker is public and construct the download URL
  const downloadUrl = `${c.req.url.replace(/\/ocr\/.*/, '')}/download/${encodeURIComponent(key)}`;

  // Prepare the OCR API payload
  const payload = {
    model: "mistral-ocr-large", // Replace with the correct model name if needed
    document: {
      document_url: downloadUrl,
      document_name: key,
      type: "document_url"
    }
  };

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
  return c.json(data);
});

export default app;
