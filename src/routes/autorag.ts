import { Hono } from "hono";
import type { Env } from "../types";

const autorag = new Hono<{ Bindings: Env }>();
autorag.post("/autorag", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.text("Missing query", 400);
    const answer = await c.env.AI.autorag("airbus_a350").aiSearch({ query });
    return c.json(answer);
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
});
export default autorag;
