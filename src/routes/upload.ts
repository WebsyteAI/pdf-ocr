import { Hono } from "hono";
import type { Env } from "../types";

const upload = new Hono<{ Bindings: Env }>();
upload.post("/upload/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.arrayBuffer();
  await c.env.MY_BUCKET.put(key, body);
  return c.text(`File uploaded as ${key}`);
});
export default upload;
