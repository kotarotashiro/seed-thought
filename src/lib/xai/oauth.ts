import crypto from "crypto";

export class XaiTokenExpiredError extends Error {
  constructor() {
    super("Grokの認証が切れています。ローカルで再認証してください。");
    this.name = "XaiTokenExpiredError";
  }
}

export const XAI_OAUTH_ID = "xai-oauth";
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL =
  `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_REDIRECT_URI = "http://127.0.0.1:56121/callback";
export const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";

interface XaiDiscoveryDocument {
  authorization_endpoint?: string;
  token_endpoint?: string;
}

export interface XaiPkceSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

export interface XaiTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope: string;
}

function getXaiClientId(): string {
  const clientId = process.env.XAI_CLIENT_ID;
  if (!clientId) throw new Error("XAI_CLIENT_ID is not set");
  return clientId;
}

function base64Url(input: Buffer): string {
  return input.toString("base64url");
}

export function createXaiPkceSession(): XaiPkceSession {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  return {
    state: crypto.randomBytes(16).toString("hex"),
    nonce: crypto.randomBytes(16).toString("hex"),
    codeVerifier,
    codeChallenge,
  };
}

async function getXaiDiscovery(): Promise<Required<XaiDiscoveryDocument>> {
  const response = await fetch(XAI_OAUTH_DISCOVERY_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`xAI OAuth discovery failed: ${response.status}`);
  }

  const data = (await response.json()) as XaiDiscoveryDocument;
  if (!data.authorization_endpoint || !data.token_endpoint) {
    throw new Error("xAI OAuth discovery response is missing endpoints");
  }

  return {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
  };
}

export async function buildXaiAuthorizeUrl(session: XaiPkceSession): Promise<string> {
  const discovery = await getXaiDiscovery();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getXaiClientId(),
    redirect_uri: XAI_OAUTH_REDIRECT_URI,
    scope: XAI_OAUTH_SCOPE,
    state: session.state,
    nonce: session.nonce,
    code_challenge: session.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

function parseTokenPayload(data: unknown): XaiTokenResult {
  const payload = data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!payload.access_token) {
    throw new Error("xAI OAuth token response did not include access_token");
  }

  const expiresIn =
    typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? payload.expires_in
      : null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scope: payload.scope ?? XAI_OAUTH_SCOPE,
  };
}

async function postTokenRequest(params: URLSearchParams): Promise<XaiTokenResult> {
  const discovery = await getXaiDiscovery();
  params.set("client_id", getXaiClientId());

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`xAI OAuth token request failed: ${response.status} ${text.slice(0, 200)}`);
  }

  return parseTokenPayload(await response.json());
}

export function getXaiTokenEncryptionKey(): string | undefined {
  return process.env.XAI_ENCRYPTION_KEY ?? process.env.TOKEN_ENCRYPTION_KEY;
}

export async function exchangeXaiCodeForTokens(
  code: string,
  session: Pick<XaiPkceSession, "codeVerifier" | "codeChallenge">
): Promise<XaiTokenResult> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: XAI_OAUTH_REDIRECT_URI,
    code_verifier: session.codeVerifier,
    code_challenge: session.codeChallenge,
    code_challenge_method: "S256",
  });

  return postTokenRequest(params);
}

export async function refreshXaiToken(refreshToken: string): Promise<XaiTokenResult> {
  return postTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}
