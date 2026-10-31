# Contributing to Reference Radar

Thanks for your interest! This project values **verifiable correctness** over
feature count: every rule conclusion must trace back to a standard clause, and
every claim in the docs must be reproducible.

## Development setup

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # vitest (unit + golden + hostile + perf)
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm exec playwright test   # E2E against the production build
```

## Ground rules

1. **Quality gates.** CI runs typecheck, lint, unit tests, build and E2E. A PR
   that fails any gate will not be merged.
2. **Rules need sources.** A new GB/T 7714 rule must define `sourceReference`
   with a clause number and a verification status (`verified-official` /
   `verified-secondary` / `unverified`). `unverified` rules never produce
   deterministic conclusions. Update `docs/rule-coverage.md`.
3. **Rules need tests.** Each rule declares `testCases`; the meta-test runner
   executes them. Broken or skipped tests are treated as failures.
4. **No fabricated results.** Don't hardcode analysis outcomes, don't loosen
   assertions to make tests pass, and don't claim support for clauses that
   aren't implemented.
5. **Privacy by construction.** The browser app must not send user content to
   any endpoint. New dependencies need a permissive license and a
   `pnpm audit --prod`-clean state.
6. **No full standard text.** Quote clause numbers and short paraphrases only.

## Commit style

Short imperative subject, e.g. `feat: add author-year detection scaffolding`.
Update `docs/progress.md` when you complete a phase-level item.
