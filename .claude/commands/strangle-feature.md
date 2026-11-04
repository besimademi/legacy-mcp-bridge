---
description: Migrate one legacy behaviour to the modern implementation using the strangler pattern
argument-hint: <legacy function or behaviour>
---

Migrate `$ARGUMENTS` from `legacy/` to the modern adapter. Follow `AGENTS.md`.

1. Read the legacy code for `$ARGUMENTS`. List every branch and quirk you find.
2. Add characterization tests in `test/characterization.test.ts` that pin the current output, quirks included. Run `npm test`; they must pass against legacy.
3. Add or extend a port in `src/domain/ports.ts` if needed. Contracts first.
4. Implement the behaviour in `src/adapters/`. No globals, named constants, pure functions.
5. Extend the random equivalence test so it covers the new inputs.
6. Run `npm test` and `npm run typecheck`.
7. Report: what moved, which quirks were preserved, and any case where legacy and modern differ.

Do not edit `legacy/`. Do not change `MIGRATION_MODE` defaults.
