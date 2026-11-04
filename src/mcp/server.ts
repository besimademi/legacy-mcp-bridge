// MCP adapter: exposes the legacy billing system to AI agents as typed, validated tools.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  CustomerNotFoundError,
  CustomerSchema,
  InvoiceSchema,
  LineItemSchema,
} from "../domain/invoice.js";
import type { CustomerRepository } from "../domain/ports.js";
import type { StranglerInvoiceCalculator } from "../strangler.js";

export interface ServerDeps {
  customers: CustomerRepository;
  calculator: StranglerInvoiceCalculator;
}

const orderInput = {
  customerId: z.number().int().positive().describe("Customer id from list_customers"),
  items: z.array(LineItemSchema).describe("Order lines"),
};

function ok<T extends Record<string, unknown>>(data: T): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Domain errors become tool errors the agent can read and recover from; anything else is a bug. */
function guard(fn: () => CallToolResult): CallToolResult {
  try {
    return fn();
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return fail(`${err.message}. Call list_customers to see valid ids.`);
    throw err;
  }
}

export function createServer({ customers, calculator }: ServerDeps): McpServer {
  const server = new McpServer({ name: "legacy-billing-bridge", version: "0.1.0" });

  server.registerTool(
    "list_customers",
    {
      title: "List customers",
      description: "List all customers with their pricing tier.",
      outputSchema: { customers: z.array(CustomerSchema) },
      annotations: { readOnlyHint: true },
    },
    async () => ok({ customers: customers.list() }),
  );

  server.registerTool(
    "get_customer",
    {
      title: "Get customer",
      description: "Get one customer by id.",
      inputSchema: { customerId: orderInput.customerId },
      outputSchema: CustomerSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async ({ customerId }) => {
      const customer = customers.findById(customerId);
      return customer ? ok(customer) : fail(`Customer ${customerId} not found. Call list_customers to see valid ids.`);
    },
  );

  server.registerTool(
    "calculate_invoice",
    {
      title: "Calculate invoice",
      description:
        "Calculate subtotal, tier discount, 18% VAT, shipping and total for an order. " +
        "Routed through the strangler facade (legacy, shadow or modern implementation).",
      inputSchema: orderInput,
      outputSchema: InvoiceSchema.shape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ customerId, items }) => guard(() => ok(calculator.calculate(customerId, items))),
  );

  server.registerTool(
    "compare_implementations",
    {
      title: "Compare legacy vs modern",
      description:
        "Run the order through BOTH the legacy and the modern calculator and report whether they agree. " +
        "Use this to verify a refactor before switching MIGRATION_MODE to modern.",
      inputSchema: orderInput,
      outputSchema: { legacy: InvoiceSchema, modern: InvoiceSchema, match: z.boolean() },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ customerId, items }) => guard(() => ok({ ...calculator.compare(customerId, items) })),
  );

  return server;
}
