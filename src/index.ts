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

// OCR endpoint: Accepts PDF, sends to Mistral OCR API, returns parsed text
app.post("/ocr", async (c) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const contentType = c.req.header("content-type") || "";
  if (!contentType.includes("application/pdf")) {
    return c.text("Please upload a PDF file.", 400);
  }
  const pdfBuffer = await c.req.arrayBuffer();

  // Call Mistral OCR API
  const resp = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/pdf"
    },
    body: pdfBuffer
  });

  if (!resp.ok) {
    const err = await resp.text();
    return c.text(`Mistral OCR API error: ${err}`, 502);
  }

  // Assume the API returns JSON with a 'text' field
  const data = await resp.json();
  return c.json({ text: data.text });
});

export default app;
