import { Hono } from "hono";
import type { Env } from "../types";

const download = new Hono<{ Bindings: Env }>();
download.get("/download/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "content-type": "application/pdf" } });
});
export default download;
