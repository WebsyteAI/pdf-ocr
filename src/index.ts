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
  return new Response(object.body, { headers: { "content-type": "application/pdf" } });
});

// OCR endpoint: Fetch PDF from R2 using file key, send raw document to Mistral OCR API, support base64 images in response
app.post("/ocr/:key", async (c) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);
  const pdfBuffer = await object.arrayBuffer();

  // Prepare the multipart/form-data body
  const formData = new FormData();
  formData.append("model", "mistral-ocr-large"); // Use the correct model name if needed
  formData.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), key);
  formData.append("include_image_base64", "true");

  // Call Mistral OCR API
  const resp = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
      // Content-Type will be set automatically by FormData
    },
    body: formData
  });

  if (!resp.ok) {
    const err = await resp.text();
    return c.text(`Mistral OCR API error: ${err}`, 502);
  }

  const data = await resp.json();
  return c.json(data);
});

export default app;
