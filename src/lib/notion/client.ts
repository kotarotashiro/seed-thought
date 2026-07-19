import { Client } from "@notionhq/client";

let _client: Client | null = null;

export function getNotionClient(apiKey: string): Client {
  if (!_client) {
    _client = new Client({ auth: apiKey, notionVersion: "2025-09-03" });
  }
  return _client;
}

export function resetNotionClient() {
  _client = null;
}
