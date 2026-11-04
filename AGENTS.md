# Rules for AI agents working in this repo

## Architecture boundaries
- `legacy/` is **frozen**. Never edit it. Wrap it.
- `src/domain/` must not import from `src/adapters/`, `src/mcp/` or `legacy/`.
- Only `src/container.ts` may construct concrete adapters.
- New behaviour goes into the modern adapter, reached only through the `InvoiceCalculator` port.

## Contracts
- zod schemas in `src/domain/invoice.ts` are the source of truth. Change the schema first, then the code.
- Every MCP tool needs an `inputSchema`, an `outputSchema` and annotations.
- Domain errors become `isError` tool results with a recovery hint. Never leak stack traces.
- Never write to stdout from server code: stdio is the MCP channel. Log with `stderrLogger`.

## Testing (required before any PR)
- Changing calculation logic? First add a characterization test that captures the **current** legacy output.
- `npm test` and `npm run typecheck` must pass.
- Legacy quirks are pinned on purpose. Do not "fix" one without a test change that a human approved.

## Definition of done
- Tests pass, types check, `compare_implementations` reports `match: true` for the affected cases.
- The PR description lists any changed behaviour explicitly.
