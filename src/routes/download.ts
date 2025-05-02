import type { Env } from "../types";

// Handler for GET /download/:key
export default async (c: any) => {
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "content-type": "application/pdf" } });
};
