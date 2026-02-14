import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const ts = new Date().toISOString();
  const ua = req.headers["user-agent"] ?? "unknown";
  const accept = req.headers["accept"] ?? "none";

  // Log incoming request
  if (Array.isArray(req.body)) {
    for (const msg of req.body) {
      console.log(`[${ts}] ${req.method} ${msg.method ?? "notification"} | id=${msg.id ?? "-"} | ua=${ua} | accept=${accept}`);
      if (msg.params && Object.keys(msg.params).length > 0) {
        console.log(`[${ts}]   params: ${JSON.stringify(msg.params)}`);
      }
    }
  } else if (req.body?.method) {
    console.log(`[${ts}] ${req.method} ${req.body.method} | id=${req.body.id ?? "-"} | ua=${ua} | accept=${accept}`);
    if (req.body.params && Object.keys(req.body.params).length > 0) {
      console.log(`[${ts}]   params: ${JSON.stringify(req.body.params)}`);
    }
  } else {
    console.log(`[${ts}] ${req.method} (no body) | ua=${ua} | accept=${accept}`);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(`[${ts}] ERROR:`, e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  }
}
