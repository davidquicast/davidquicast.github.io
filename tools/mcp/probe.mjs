import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { writeFile, mkdir } from "node:fs/promises";
const root = new URL("../../", import.meta.url).pathname;
const out = root + ".local/redesign/tools";
const moduleRoot = new URL("./node_modules/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const name = process.argv[2];
const client = new Client({ name: "portfolio-redesign", version: "1.0.0" }, { capabilities: { roots: { listChanged: false } } });
client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: [{ uri: pathToFileURL(root).href, name: "Portfolio workspace" }] }));
let transport;
try {
  if (name === "21st") transport = new StreamableHTTPClientTransport(new URL("https://21st.dev/api/mcp"));
  else
    transport = new StdioClientTransport({
      command: "node",
      args:
        name === "shadcn"
          ? [moduleRoot + "shadcn/dist/index.js", "mcp"]
          : [
              moduleRoot + "chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js",
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
  const listing = await client.listTools();
  await writeFile(`${out}/${name}-tools.json`, JSON.stringify(listing, null, 2));
  console.log(
    name,
    listing.tools.map((t) => t.name)
  );
  if (name === "21st") {
    const t = listing.tools.find((t) => t.name === "get_usage");
    if (t) {
      const r = await client.callTool({ name: t.name, arguments: {} });
      await writeFile(`${out}/21st-usage.json`, JSON.stringify(r, null, 2));
      console.log(JSON.stringify(r));
    }
  }
  if (name === "shadcn") {
    for (const call of [
      { name: "get_project_registries", arguments: {} },
      { name: "search_items_in_registries", arguments: { registries: ["@shadcn"], query: "navigation-menu", limit: 3 } },
      { name: "view_items_in_registries", arguments: { items: ["@shadcn/navigation-menu", "@shadcn/toggle-group", "@shadcn/empty"] } },
      { name: "get_item_examples_from_registries", arguments: { registries: ["@shadcn"], query: "toggle-group-demo" } },
      { name: "get_audit_checklist", arguments: {} },
    ]) {
      try {
        const r = await client.callTool(call);
        await writeFile(`${out}/shadcn-${call.name}.json`, JSON.stringify(r, null, 2));
        console.log(call.name, JSON.stringify(r).slice(0, 600));
      } catch (e) {
        console.log(call.name, e.message);
      }
    }
  }
  if (name === "chrome") {
    const r = await client.callTool({ name: "list_pages", arguments: {} });
    await writeFile(`${out}/chrome-first-use.json`, JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r));
  }
} catch (e) {
  await writeFile(`${out}/${name}-error.txt`, String(e));
  console.log(name, "ERROR", e.message);
} finally {
  await client.close().catch(() => {});
}
