---
description: Architectural gatekeeper review of an AI-generated change
---

Review the current diff as the architectural gatekeeper. Check, in order:

1. **Boundaries**: does anything in `src/domain/` import adapters, MCP or legacy code? Was `legacy/` edited?
2. **Contracts**: did a zod schema change? Is that change reflected in the MCP tool and the README?
3. **Behaviour**: did any characterization test change? If so, is the behaviour change intended and explained?
4. **Tests**: run `npm test` and `npm run typecheck`. Paste the result.
5. **MCP safety**: no stdout writes, every tool has schemas and annotations, errors are recoverable.

Answer with APPROVE or REQUEST CHANGES, followed by concrete file:line findings.
