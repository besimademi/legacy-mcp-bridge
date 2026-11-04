// Characterization (golden-master) tests: they pin what the legacy code DOES, not what it should do.
// The modern implementation must match it exactly before traffic is switched over.
import { describe, expect, it, vi } from "vitest";
import { LegacyCustomerRepository, LegacyInvoiceCalculator } from "../src/adapters/legacy-billing.js";
import { ModernInvoiceCalculator } from "../src/adapters/modern-calculator.js";
import { CustomerNotFoundError, type Invoice, type LineItem } from "../src/domain/invoice.js";
import type { InvoiceCalculator } from "../src/domain/ports.js";
import { StranglerInvoiceCalculator } from "../src/strangler.js";

const customers = new LegacyCustomerRepository();
const legacy = new LegacyInvoiceCalculator();
const modern = new ModernInvoiceCalculator(customers);
const implementations: [string, InvoiceCalculator][] = [
  ["legacy", legacy],
  ["modern", modern],
];

describe.each(implementations)("%s calculator: pinned legacy behaviour", (_name, calc) => {
  it("applies gold discount, per-line bulk discount, 18% VAT and flat shipping", () => {
    const items: LineItem[] = [
      { sku: "A", price: 100, qty: 2 },
      { sku: "B", price: 9.99, qty: 10 },
    ];
    expect(calc.calculate(1, items)).toEqual<Invoice>({
      subtotal: 297.9,
      discount: 29.79,
      tax: 48.26,
      shipping: 5,
      total: 321.37,
    });
  });

  it("QUIRK: tier codes are case-sensitive, so lowercase 'g' gets no gold discount", () => {
    const result = calc.calculate(4, [{ sku: "A", price: 100, qty: 1 }]);
    expect(result.discount).toBe(0);
    expect(result.total).toBe(123);
  });

  it("QUIRK: negative quantities are silently treated as zero", () => {
    const result = calc.calculate(3, [
      { sku: "A", price: 50, qty: -3 },
      { sku: "B", price: 10, qty: 1 },
    ]);
    expect(result.subtotal).toBe(10);
  });

  it("gives free shipping above 1000 after discount, and no shipping on empty orders", () => {
    expect(calc.calculate(3, [{ sku: "A", price: 1200, qty: 1 }])).toEqual<Invoice>({
      subtotal: 1200,
      discount: 0,
      tax: 216,
      shipping: 0,
      total: 1416,
    });
    expect(calc.calculate(2, [])).toEqual<Invoice>({ subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 });
  });

  it("throws CustomerNotFoundError for unknown customers", () => {
    expect(() => calc.calculate(999, [])).toThrow(CustomerNotFoundError);
  });
});

/** Small seeded PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("modern calculator is equivalent to legacy", () => {
  it("matches legacy output exactly on 5,000 random orders", () => {
    const rand = mulberry32(42);
    const ids = customers.list().map((c) => c.id);
    for (let n = 0; n < 5000; n++) {
      const customerId = ids[Math.floor(rand() * ids.length)]!;
      const items: LineItem[] = Array.from({ length: Math.floor(rand() * 6) }, (_, i) => ({
        sku: `SKU-${i}`,
        price: Math.round(rand() * 50000) / 100,
        qty: Math.floor(rand() * 30) - 3,
      }));
      expect(modern.calculate(customerId, items), JSON.stringify({ customerId, items })).toEqual(
        legacy.calculate(customerId, items),
      );
    }
  });
});

describe("strangler facade", () => {
  const items: LineItem[] = [{ sku: "A", price: 10, qty: 1 }];
  const broken: InvoiceCalculator = {
    calculate: () => ({ subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 }),
  };

  it("in shadow mode returns the legacy result and logs any mismatch", () => {
    const warn = vi.fn();
    const facade = new StranglerInvoiceCalculator(legacy, broken, "shadow", { warn });
    expect(facade.calculate(3, items)).toEqual(legacy.calculate(3, items));
    expect(warn).toHaveBeenCalledOnce();
  });

  it("in shadow mode stays silent when implementations agree", () => {
    const warn = vi.fn();
    new StranglerInvoiceCalculator(legacy, modern, "shadow", { warn }).calculate(1, items);
    expect(warn).not.toHaveBeenCalled();
  });

  it("routes to the modern implementation in modern mode", () => {
    const facade = new StranglerInvoiceCalculator(legacy, broken, "modern", { warn: vi.fn() });
    expect(facade.calculate(3, items).total).toBe(0);
  });
});
