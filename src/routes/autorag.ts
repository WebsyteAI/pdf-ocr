import type { Env } from "../types";

// Handler for POST /autorag
export default async (c: any) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.text("Missing query", 400);
    const apiToken = c.env.AUTORAG_API_TOKEN;
    const url =
      "https://api.cloudflare.com/client/v4/accounts/85007e57ff327d1bd0f10025e9ea3aa3/autorag/rags/autobus_a350/search";
    const ragResp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query }),
    });
    const ragData = await ragResp.json();
    if (!ragResp.ok) {
      return c.json({ error: ragData?.error || ragData }, ragResp.status);
    }
    const context = ragData?.result?.data?.map((d: any) => d.text).join("\n\n") || "";

    // Compose messages for the model, injecting RAG context
    const messages = [
      { role: "system", content: "You are a friendly assistant. Use the following context to answer the user's question as accurately as possible." },
      { role: "system", content: `Context:\n${context}` },
      { role: "user", content: query },
    ];

    // Call Workers AI with context-augmented messages
    const stream = await c.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
      messages,
      stream: true,
    });

    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
};
