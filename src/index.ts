#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildContainer, parseMode } from "./container.js";
import { createServer } from "./mcp/server.js";

const mode = parseMode(process.env.MIGRATION_MODE);
const server = createServer(buildContainer(mode));
await server.connect(new StdioServerTransport());
console.error(`legacy-billing-bridge MCP server running on stdio (mode: ${mode})`);
