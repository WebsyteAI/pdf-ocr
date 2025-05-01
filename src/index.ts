import { Hono } from "hono";
import type { Context } from "hono";

// Define Env type with R2 binding
export type Env = {
  MY_BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c: Context) => c.text("Hello from Worker with R2!"));

// Example: Upload a file to R2
app.post("/upload/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.arrayBuffer();
  await c.env.MY_BUCKET.put(key, body);
  return c.text(`File uploaded as ${key}`);
});

// Example: Download a file from R2
app.get("/download/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "content-type": "application/octet-stream" } });
});

export default app;
