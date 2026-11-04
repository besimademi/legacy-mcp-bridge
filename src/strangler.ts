// Strangler facade: callers see one InvoiceCalculator; traffic moves from legacy to modern
// one mode at a time, with shadow mode proving equivalence on real inputs first.
import { isDeepStrictEqual } from "node:util";
import type { Invoice, LineItem } from "./domain/invoice.js";
import type { InvoiceCalculator, Logger } from "./domain/ports.js";

export type MigrationMode = "legacy" | "shadow" | "modern";

export interface Comparison {
  legacy: Invoice;
  modern: Invoice;
  match: boolean;
}

export class StranglerInvoiceCalculator implements InvoiceCalculator {
  constructor(
    private readonly legacy: InvoiceCalculator,
    private readonly modern: InvoiceCalculator,
    private readonly mode: MigrationMode,
    private readonly logger: Logger,
  ) {}

  calculate(customerId: number, items: LineItem[]): Invoice {
    switch (this.mode) {
      case "legacy":
        return this.legacy.calculate(customerId, items);
      case "modern":
        return this.modern.calculate(customerId, items);
      case "shadow": {
        const result = this.compare(customerId, items);
        if (!result.match) this.logger.warn("shadow mismatch", { customerId, items, ...result });
        return result.legacy; // legacy stays authoritative until shadow runs clean
      }
    }
  }

  compare(customerId: number, items: LineItem[]): Comparison {
    const legacy = this.legacy.calculate(customerId, items);
    const modern = this.modern.calculate(customerId, items);
    return { legacy, modern, match: isDeepStrictEqual(legacy, modern) };
  }
}
