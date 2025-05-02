// Handler for POST /autorag
export default async (c: any) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.text("Missing query", 400);
    const apiToken = c.env.AUTORAG_API_TOKEN;
    const url =
      "https://api.cloudflare.com/client/v4/accounts/85007e57ff327d1bd0f10025e9ea3aa3/autorag/rags/autobus_a350/search";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return c.json({ error: data?.error || data }, resp.status);
    }
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
};
