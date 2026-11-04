import type { Customer, Invoice, LineItem } from "./invoice.js";

/** Hexagonal ports: the core depends on these interfaces, never on concrete adapters. */
export interface CustomerRepository {
  list(): Customer[];
  findById(id: number): Customer | undefined;
}

export interface InvoiceCalculator {
  /** @throws CustomerNotFoundError */
  calculate(customerId: number, items: LineItem[]): Invoice;
}

export interface Logger {
  warn(message: string, data?: unknown): void;
}
