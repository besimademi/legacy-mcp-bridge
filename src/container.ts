// Composition root: the only place that knows about concrete classes (dependency injection).
import { LegacyCustomerRepository, LegacyInvoiceCalculator } from "./adapters/legacy-billing.js";
import { ModernInvoiceCalculator } from "./adapters/modern-calculator.js";
import type { Logger } from "./domain/ports.js";
import { StranglerInvoiceCalculator, type MigrationMode } from "./strangler.js";

const MODES: readonly MigrationMode[] = ["legacy", "shadow", "modern"];

export function parseMode(value: string | undefined): MigrationMode {
  const mode = (value ?? "shadow") as MigrationMode;
  if (!MODES.includes(mode)) throw new Error(`MIGRATION_MODE must be one of ${MODES.join(", ")}; got "${value}"`);
  return mode;
}

/** MCP stdio uses stdout for protocol messages, so logs must go to stderr. */
export const stderrLogger: Logger = {
  warn: (message, data) => console.error(`[warn] ${message}`, data === undefined ? "" : JSON.stringify(data)),
};

export function buildContainer(mode: MigrationMode, logger: Logger = stderrLogger) {
  const customers = new LegacyCustomerRepository();
  const calculator = new StranglerInvoiceCalculator(
    new LegacyInvoiceCalculator(),
    new ModernInvoiceCalculator(customers),
    mode,
    logger,
  );
  return { customers, calculator };
}
