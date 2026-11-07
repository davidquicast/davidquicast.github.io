import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Start an isolated, local Chromium session through the official DevTools MCP. */
export async function connectChrome() {
  const root = new URL("../../", import.meta.url).pathname;
  const executable = new URL("./node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js", import.meta.url).pathname;
  const client = new Client({ name: "portfolio-verification", version: "1.0.0" }, { capabilities: { roots: { listChanged: false } } });
  client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: [{ uri: pathToFileURL(root).href, name: "Portfolio workspace" }] }));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      executable,
      "--headless",
      "--isolated",
      "--executablePath=/usr/bin/chromium",
      "--chromeArg=--no-sandbox",
      "--chromeArg=--disable-dev-shm-usage",
      "--no-usage-statistics",
      "--no-performance-crux",
    ],
    cwd: root,
    stderr: "pipe",
  });
  await client.connect(transport);
  return client;
}
