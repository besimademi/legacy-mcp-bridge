// Contract tests: talk to the MCP server exactly as an AI agent would.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildContainer } from "../src/container.js";
import { createServer } from "../src/mcp/server.js";

let client: Client;

beforeAll(async () => {
  const server = createServer(buildContainer("shadow", { warn: () => {} }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-agent", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe("MCP server", () => {
  it("advertises typed, read-only tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "calculate_invoice",
      "compare_implementations",
      "get_customer",
      "list_customers",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it("lists customers with mapped tiers", async () => {
    const result = await client.callTool({ name: "list_customers", arguments: {} });
    const { customers } = result.structuredContent as { customers: { id: number; tier: string }[] };
    expect(customers).toHaveLength(4);
    expect(customers.find((c) => c.id === 4)?.tier).toBe("standard");
  });

  it("calculates an invoice with structured output", async () => {
    const result = await client.callTool({
      name: "calculate_invoice",
      arguments: { customerId: 1, items: [{ sku: "A", price: 100, qty: 2 }] },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ subtotal: 200, discount: 20, tax: 32.4, shipping: 5, total: 217.4 });
  });

  it("reports legacy/modern agreement", async () => {
    const result = await client.callTool({
      name: "compare_implementations",
      arguments: { customerId: 2, items: [{ sku: "A", price: 19.99, qty: 12 }] },
    });
    expect((result.structuredContent as { match: boolean }).match).toBe(true);
  });

  it("returns a recoverable tool error for unknown customers", async () => {
    const result = await client.callTool({ name: "calculate_invoice", arguments: { customerId: 999, items: [] } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("list_customers");
  });

  it("rejects input that violates the contract", async () => {
    const call = client.callTool({
      name: "calculate_invoice",
      arguments: { customerId: 1, items: [{ sku: "A", price: -5, qty: 1.5 }] },
    });
    const outcome = await call.then(
      (r) => r.isError === true,
      () => true,
    );
    expect(outcome).toBe(true);
  });
});
