import { z } from "zod";

/** Contract-first schemas: the single source of truth for humans, code and agents. */
export const LineItemSchema = z.object({
  sku: z.string().min(1).describe("Product SKU"),
  price: z.number().nonnegative().describe("Unit price in EUR"),
  qty: z.number().int().describe("Quantity (negative values are treated as 0, legacy behaviour)"),
});

export const CustomerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  tier: z.enum(["gold", "silver", "standard"]),
  country: z.string().length(2),
});

export const InvoiceSchema = z.object({
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  shipping: z.number(),
  total: z.number(),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;

export class CustomerNotFoundError extends Error {
  constructor(public readonly customerId: number) {
    super(`Customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}
