import crypto from "node:crypto";

/**
 * Verify that an incoming request carries a valid MCP_API_KEY.
 * Accepts Authorization: Bearer <key>, x-api-key: <key>, or ?token=<key>.
 * Fails closed if MCP_API_KEY is not configured.
 */
export function isMcpAuthorized(request: Request): boolean {
  const expected = process.env.MCP_API_KEY?.trim();
  if (!expected) {
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const apiKeyHeader = request.headers.get("x-api-key")?.trim() ?? "";

  let queryToken = "";
  try {
    queryToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  } catch {
    queryToken = "";
  }

  const candidate = bearerToken || apiKeyHeader || queryToken;
  if (!candidate) {
    return false;
  }

  const expectedBuf = Buffer.from(expected, "utf8");
  const candidateBuf = Buffer.from(candidate, "utf8");
  if (expectedBuf.length !== candidateBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}
