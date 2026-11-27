import { NextResponse } from "next/server";
import { isMcpAuthorized } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, Mcp-Session-Id",
};

function withCors(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) =>
    response.headers.set(k, v),
  );
  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  if (!isMcpAuthorized(request)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }
  // Streamable HTTP servers that do not expose an SSE stream return 405 on GET.
  return withCors(
    NextResponse.json(
      { error: "Method Not Allowed. Use POST for MCP JSON-RPC requests." },
      { status: 405 },
    ),
  );
}

export async function POST(request: Request) {
  if (!isMcpAuthorized(request)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        { status: 400 },
      ),
    );
  }

  const response = await handleMcpRequest(payload);
  if (response === null) {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }

  return withCors(NextResponse.json(response));
}
