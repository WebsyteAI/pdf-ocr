import type { Env } from "../types";

// Handler for POST /autorag
export default async (c: any) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.text("Missing query", 400);
    const answer = await c.env.AI.autorag("airbus_a350").search({ query });
    return c.json(answer);
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
};
