# legacy-mcp-bridge

A small, complete example of making a **legacy system agent-operable**:

- an untyped 2014-era billing module ([`legacy/billing.js`](legacy/billing.js)) is wrapped, not rewritten
- a typed **anti-corruption layer** and **hexagonal ports** isolate it
- a modern replacement is introduced with the **Strangler Fig pattern** (`legacy` → `shadow` → `modern`)
- **characterization tests** pin the legacy behaviour, quirks included, so refactoring can't change invoices
- a **Model Context Protocol (MCP) server** exposes the system to AI agents as typed, validated, read-only tools
- an **agent context layer** ([`AGENTS.md`](AGENTS.md), [`.claude/commands`](.claude/commands)) tells agents the rules of the codebase

## Architecture

```
            AI agent (Claude, Cursor, ...)
                     │  MCP (stdio, JSON-RPC)
            ┌────────▼─────────┐
            │  src/mcp/server  │  zod input/output contracts, tool errors
            └────────┬─────────┘
                     │ InvoiceCalculator port
        ┌────────────▼─────────────┐
        │ StranglerInvoiceCalculator│  MIGRATION_MODE = legacy | shadow | modern
        └──────┬────────────┬──────┘
               │            │
   LegacyInvoiceCalculator  ModernInvoiceCalculator
   (anti-corruption layer)  (pure, typed, injected)
               │
        legacy/billing.js  ← frozen, never edited
```

| Layer | File | Responsibility |
| --- | --- | --- |
| Contracts | `src/domain/invoice.ts` | zod schemas = single source of truth for types and MCP tool schemas |
| Ports | `src/domain/ports.ts` | interfaces the core depends on |
| Legacy adapter | `src/adapters/legacy-billing.ts` | translates untyped legacy data and error codes into domain types |
| Modern adapter | `src/adapters/modern-calculator.ts` | clean reimplementation, named constants, no globals |
| Strangler facade | `src/strangler.ts` | routes traffic; in `shadow` mode runs both and logs mismatches |
| Composition root | `src/container.ts` | the only place that wires concrete classes (DI) |
| MCP adapter | `src/mcp/server.ts` | tools for agents |

## MCP tools

| Tool | What it does |
| --- | --- |
| `list_customers` | all customers and their pricing tier |
| `get_customer` | one customer by id |
| `calculate_invoice` | subtotal, tier discount, 18% VAT, shipping, total, through the strangler facade |
| `compare_implementations` | runs legacy **and** modern on the same order and reports whether they match |

Every tool has an input and output schema and `readOnlyHint`. Unknown customers return a tool error that tells the agent how to recover (`Call list_customers to see valid ids`) instead of crashing.

## Pinned legacy quirks

Characterization tests document behaviour that is surprising but that customers' invoices depend on. They are kept until the business decides otherwise:

- tier codes are case-sensitive: customer 4 has tier `g`, so gets **no** gold discount
- negative quantities are silently treated as 0
- the bulk discount (2% at qty ≥ 10) is applied per line, before rounding
- the subtotal is a raw float sum and is not rounded
- shipping is not taxed; it is free above 1000 after discount, and 0 for empty orders

A seeded property test also checks that the modern calculator matches legacy exactly on 5,000 random orders.

## Run it

```bash
npm install
npm test          # characterization + MCP contract tests
npm run build
```

Add it to an MCP client (for example Claude Code, Claude Desktop or Cursor):

```json
{
  "mcpServers": {
    "legacy-billing": {
      "command": "node",
      "args": ["/absolute/path/to/legacy-mcp-bridge/dist/src/index.js"],
      "env": { "MIGRATION_MODE": "shadow" }
    }
  }
}
```

Or with Claude Code:

```bash
claude mcp add legacy-billing --env MIGRATION_MODE=shadow -- node dist/src/index.js
```

## Migration playbook

1. **legacy**: wrap the old module behind a port; write characterization tests against it.
2. **shadow**: build the modern implementation; run both on every call, serve legacy, log mismatches.
3. **modern**: when shadow logs are clean and the tests pass, switch the flag.
4. Delete the legacy adapter and module once nothing routes to them.

## License

MIT
