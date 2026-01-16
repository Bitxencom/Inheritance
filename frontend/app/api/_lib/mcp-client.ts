import fs from "fs";

import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;

// Path configuration for development (local) and production (Docker)
// In Docker, use environment variables; in local, use absolute path
// Path for Docker container (from environment variables or default)
const MCP_SERVER_CWD = process.env.MCP_SERVER_CWD || "./mcp-server";
const MCP_SERVER_ENTRY = process.env.MCP_SERVER_ENTRY || "server.js";

let clientPromise: Promise<MCPClient> | null = null;
let cachedTools: Record<string, unknown> | null = null;

async function ensureClient(): Promise<MCPClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      // Use "node" from PATH
      let command = "node";

      // Ensure MCP server directory exists
      if (!fs.existsSync(MCP_SERVER_CWD)) {
        throw new Error(
          `MCP server directory not found: ${MCP_SERVER_CWD}. Make sure mcp-server is mounted to the container.`
        );
      }

      const serverEntryPath = `${MCP_SERVER_CWD}/${MCP_SERVER_ENTRY}`;
      if (!fs.existsSync(serverEntryPath)) {
        throw new Error(
          `MCP server entry file not found: ${serverEntryPath}`
        );
      }

      console.log(`🔌 Connecting to MCP server at: ${MCP_SERVER_CWD}`);
      console.log(`📝 Using command: ${command} ${MCP_SERVER_ENTRY}`);

      // Prepare environment variables for MCP server subprocess
      // IMPORTANT: In Docker, subprocess doesn't automatically receive env vars from parent
      // We need to explicitly forward relevant env vars
      const mcpEnv: Record<string, string> = {
        ...process.env as Record<string, string>,
        // Set BACKEND_BASE_URL for MCP server subprocess
        // In Docker, backend is accessed via http://backend:7002 (internal network)
        // In local, use BACKEND_BASE_URL from environment or fallback to localhost
        BACKEND_BASE_URL: process.env.BACKEND_BASE_URL || 'http://localhost:7002',
      };

      console.log(`🌐 MCP server BACKEND_BASE_URL: ${mcpEnv.BACKEND_BASE_URL}`);

      const transport = new Experimental_StdioMCPTransport({
        command,
        args: [MCP_SERVER_ENTRY],
        cwd: MCP_SERVER_CWD,
        env: mcpEnv,
      });

      const client = await createMCPClient({ transport });
      cachedTools = await client.tools();

      console.log(`✅ MCP client successfully created with ${Object.keys(cachedTools || {}).length} tools`);

      return client;
    })();
  }

  return clientPromise;
}

export async function getMCPTools() {
  if (cachedTools) {
    return cachedTools;
  }

  const client = await ensureClient();
  cachedTools = await client.tools();
  return cachedTools;
}

export async function callMCPTool(name: string, args: Record<string, unknown>) {
  const client = await ensureClient();

  const callableClient = client as MCPClient & {
    callTool?: (params: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
  };

  if (typeof callableClient.callTool !== "function") {
    throw new Error("MCP client does not support direct tool invocation.");
  }

  return callableClient.callTool({
    name,
    arguments: args,
  });
}

