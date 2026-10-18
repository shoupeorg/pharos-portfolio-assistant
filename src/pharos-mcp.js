import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_URL } from "./constants.js";

const REQUIRED = ["get_chain_info", "get_block_number", "get_block", "get_code", "get_balance", "eth_call"];

function parse(result, name) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`${name} returned no text result.`);
  const value = JSON.parse(text);
  if (result.isError || value.error) throw new Error(value.error?.message || `${name} failed.`);
  return value;
}

async function retry(fn, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try { return await fn(); } catch (error) {
      last = error;
      if (i === attempts || !/timeout|fetch|network|429|502|503|reset/i.test(error.message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * i));
    }
  }
  throw last;
}

export async function withPharosMcp(operation, options = {}) {
  let client;
  let transport;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    client = new Client({ name: "pharos-portfolio-assistant", version: "2.0.0" });
    transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      fetch: options.fetch || ((input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(25_000) }))
    });
    try { await client.connect(transport); lastError = null; break; }
    catch (error) {
      lastError = error;
      try { await transport.terminateSession(); } catch {}
      try { await client.close(); } catch {}
      if (attempt === 3 || !/timeout|fetch|network|429|502|503|reset/i.test(error.message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  if (lastError) throw lastError;
  try {
    const listed = (await client.listTools()).tools.map((tool) => tool.name);
    const missing = REQUIRED.filter((name) => !listed.includes(name));
    if (missing.length) throw new Error(`Official Pharos MCP is missing required read tools: ${missing.join(", ")}`);
    const call = (name, args = {}) => retry(async () => parse(await client.callTool({ name, arguments: args }), name));
    return await operation({ call, tools: listed });
  } finally {
    try { await transport.terminateSession(); } catch {}
    await client.close();
  }
}
