# Triage — Phase 2 — 2026-06-13

## Merged findings table

| # | Finding | Sev | Found by | Final status |
|---|---------|-----|----------|--------------|
| F1 | Vercel cron sends GET; reset route was POST-only — auto-reset never fired | SEV-2 | Both | Fixed @ 6df9766 |
| F2 | Invalid `?chip=` URL param crashed dashboard on mount (`undefined.sortKey`) | SEV-2 | Sonnet | Fixed @ e9cddd7 |
| F3 | Delete buttons swallowed API errors — no `res.ok` check, no user feedback | SEV-2 | Both | Fixed @ e9cddd7 |
| F4 | `hasRecentAnomaly` had no upper bound — future-dated anomaly returned `true` | SEV-3 | Both | Fixed @ be7c9b2 |
| F5 | `top-var` sorted by name instead of `valueAtRisk30d`; `expiring-60` sorted by name instead of `minDaysToExpiry` | SEV-3 | Both | Fixed @ e9cddd7 |
| F6 | PATCH/DELETE id params not validated as UUID — malformed id returned 500 not 400 | SEV-3 | Both | Fixed @ 91a1b61 |
| F7 | `Dialog` modal lacked `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler, focus restore | SEV-3 | Both | Fixed @ fa49faa |
| F8 | Reset route duplicates ~230 lines of seed logic from `scripts/seed.ts` | SEV-3 | Both | Won't fix — documented deliberate decision (DECISIONS.md 2026-06-13); fix is extractable but adds scope with no immediate benefit |
| F9 | Test name said "returns []" but assertion expected `toHaveLength(1)` | SEV-3 | Sonnet | Fixed @ be7c9b2 |
| F10 | Product-edit form resolves `supplier_id` by name reverse-lookup — fragile if names aren't unique | SEV-3 | Sonnet | Won't fix — not a live bug; all 6 seeded supplier names are unique; deferred to Phase 3 if supplier catalog expands |

## Summary

**8 findings fixed across 6 commits.** All three quality gates pass after fixes: lint ✓, typecheck ✓, 76/76 tests ✓ (one new test added for the upper-bound fix).

**2 findings deferred (Won't fix):** F8 (seed duplication — documented deliberate decision) and F10 (supplier name lookup — not a live bug in the seeded data).

**No items await Alina's decision.** Both functionality-impact items (F1 reset method, F5 chip sort) were pre-approved before this session.

Phase 2 is now clean. Ready for Phase 3.
