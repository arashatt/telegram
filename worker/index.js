export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (request.method === "POST") {
        try {
          const { messages } = await request.json();

          const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages: [
              {
                role: "system",
                content:
                  "You are a Telegram bot intake assistant for Limoo Host. Ask about purpose, features, audience size, timeline, budget, and contact info before wrapping up.",
              },
              ...messages,
            ],
            max_tokens: 512,
          });

          // Temporary — check `wrangler tail` output to see the raw shape
          console.log("AI result:", JSON.stringify(result));

          return new Response(
            JSON.stringify({ reply: result.response ?? "", submitted: false }),
            {
              headers: {
                "content-type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err.message }),
            {
              status: 500,
              headers: {
                "content-type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
      }

      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/chat/stream") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (request.method === "POST") {
        const { messages } = await request.json();

        const stream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            {
              role: "system",
              content:
                "You are a Telegram bot intake assistant for Limoo Host. Ask about purpose, features, audience size, timeline, budget, and contact info before wrapping up.",
            },
            ...messages,
          ],
          max_tokens: 512,
          stream: true,
        });

        // env.AI.run with stream:true already returns an SSE-formatted
        // ReadableStream — pass it straight through.
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    // Everything else: serve the built React app
    return env.ASSETS.fetch(request);
  },
};
