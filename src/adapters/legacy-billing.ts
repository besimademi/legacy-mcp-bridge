// Anti-corruption layer: wraps the untyped legacy module behind typed ports.
import * as legacy from "../../legacy/billing.js";
import {
  CustomerNotFoundError,
  type Customer,
  type Invoice,
  type LineItem,
} from "../domain/invoice.js";
import type { CustomerRepository, InvoiceCalculator } from "../domain/ports.js";

type LegacyCustomer = { id: number; name: string; tier: string; country: string };
type LegacyResult =
  | { err: string }
  | { sub: number; disc: number; tax: number; ship: number; total: number };

/** Legacy tier codes are case-sensitive: only "G" and "S" earn a discount. */
function mapTier(code: string): Customer["tier"] {
  if (code === "G") return "gold";
  if (code === "S") return "silver";
  return "standard";
}

function toCustomer(c: LegacyCustomer): Customer {
  return { id: c.id, name: c.name, tier: mapTier(c.tier), country: c.country };
}

export class LegacyCustomerRepository implements CustomerRepository {
  list(): Customer[] {
    return (legacy.getCustomers() as LegacyCustomer[]).map(toCustomer);
  }
  findById(id: number): Customer | undefined {
    const c = legacy.findCust(id) as LegacyCustomer | null;
    return c ? toCustomer(c) : undefined;
  }
}

export class LegacyInvoiceCalculator implements InvoiceCalculator {
  calculate(customerId: number, items: LineItem[]): Invoice {
    const r = legacy.calc(customerId, items) as LegacyResult;
    if ("err" in r) throw new CustomerNotFoundError(customerId);
    return { subtotal: r.sub, discount: r.disc, tax: r.tax, shipping: r.ship, total: r.total };
  }
}
