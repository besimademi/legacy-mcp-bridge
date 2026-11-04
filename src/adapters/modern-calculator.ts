// The modern replacement: pure, typed, dependency-injected.
// Behaviour is pinned to the legacy module by test/characterization.test.ts.
import { CustomerNotFoundError, type Customer, type Invoice, type LineItem } from "../domain/invoice.js";
import type { CustomerRepository, InvoiceCalculator } from "../domain/ports.js";

export const VAT_RATE = 0.18;
export const BULK_QTY = 10;
export const BULK_FACTOR = 0.98;
export const FREE_SHIPPING_ABOVE = 1000;
export const SHIPPING_FEE = 5;

const TIER_DISCOUNT: Record<Customer["tier"], number> = { gold: 0.1, silver: 0.05, standard: 0 };

/** Legacy rounding (Math.round on x*100). Kept on purpose: changing it changes invoices. */
const round2 = (x: number): number => Math.round(x * 100) / 100;

export function lineTotal(item: LineItem): number {
  const qty = Math.max(item.qty, 0);
  const gross = item.price * qty;
  return round2(qty >= BULK_QTY ? gross * BULK_FACTOR : gross);
}

export class ModernInvoiceCalculator implements InvoiceCalculator {
  constructor(private readonly customers: CustomerRepository) {}

  calculate(customerId: number, items: LineItem[]): Invoice {
    const customer = this.customers.findById(customerId);
    if (!customer) throw new CustomerNotFoundError(customerId);

    // Summed without rounding, exactly like the legacy loop.
    const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
    const afterDiscount = round2(subtotal * (1 - TIER_DISCOUNT[customer.tier]));
    const tax = round2(afterDiscount * VAT_RATE);
    const shipping = items.length === 0 || afterDiscount > FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;

    return {
      subtotal,
      discount: round2(subtotal - afterDiscount),
      tax,
      shipping,
      total: round2(afterDiscount + tax + shipping),
    };
  }
}
