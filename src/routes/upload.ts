import type { Env } from "../types";

// Handler for POST /upload/:key
export default async (c: any) => {
  const key = c.req.param("key");
  const body = await c.req.arrayBuffer();
  await c.env.MY_BUCKET.put(key, body);
  return c.text(`File uploaded as ${key}`);
};
