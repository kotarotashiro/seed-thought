import { executeMcpTool, MCP_TOOLS, McpUnknownToolError } from "./tools";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05"] as const;
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

export async function handleMcpRequest(
  payload: unknown,
): Promise<JsonRpcResponse | null> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return errorResponse(null, -32600, "Invalid Request");
  }

  const req = payload as JsonRpcRequest;
  const id = req.id === undefined ? null : req.id;

  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return errorResponse(id, -32600, "Invalid Request");
  }

  // Notifications have no `id` property and expect no JSON-RPC body.
  const isNotification = req.id === undefined;

  if (req.method === "notifications/initialized" || req.method.startsWith("notifications/")) {
    return null;
  }

  switch (req.method) {
    case "initialize": {
      const requestedVersion =
        typeof req.params?.protocolVersion === "string"
          ? req.params.protocolVersion
          : DEFAULT_PROTOCOL_VERSION;
      const protocolVersion = (
        SUPPORTED_PROTOCOL_VERSIONS as readonly string[]
      ).includes(requestedVersion)
        ? requestedVersion
        : DEFAULT_PROTOCOL_VERSION;

      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "seed-thought-mcp",
            version: "1.0.0",
          },
        },
      };
    }

    case "ping": {
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };
    }

    case "tools/list": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };
    }

    case "tools/call": {
      const toolName =
        typeof req.params?.name === "string" ? req.params.name : "";
      if (!toolName) {
        return errorResponse(id, -32602, "Invalid params: tool name is required");
      }

      const rawArgs = req.params?.arguments;
      const args =
        rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {};

      try {
        const data = await executeMcpTool(toolName, args);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          },
        };
      } catch (err) {
        if (err instanceof McpUnknownToolError) {
          return errorResponse(id, -32602, err.message);
        }
        const message =
          err instanceof Error ? err.message : "Tool execution failed";
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          },
        };
      }
    }

    default:
      if (isNotification) return null;
      return errorResponse(id, -32601, `Method not found: ${req.method}`);
  }
}
