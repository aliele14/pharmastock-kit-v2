# Triage — Phase 1 — 2026-06-13

## Merged Findings Table

| # | Finding | Severity | Found by | Final status |
|---|---------|----------|----------|--------------|
| F1 | Dead exported code: `getProductDetail`, `ProductDetail`, `DemandPoint` | SEV-3 | Both | Fixed @ 23e7a67 |
| F2 | `getInventoryOverview` / `getDashboardData` duplicate four-table fetch + compose | SEV-3 | Both | Fixed @ 23e7a67 (extracted `fetchAndBuildMetrics`) |
| F3 | `error.tsx` renders `error.message`, stripped by Next.js in production | SEV-3 | Opus | Won't fix — static hint carries the useful guidance; acceptable as-is (Opus's own verdict) |
| F4 | `valueAtRisk` includes already-expired stock in ≤30/60/90 KPIs | SEV-3 | Opus | Deferred to Alina — product decision, changes headline numbers |
| F5 | `suggestedOrderQty` rounds UP (ceil); SPEC says "rounded" — no DECISIONS.md entry | SEV-3 | Both | Fixed @ 05d2310 (docs only; code is correct) |
| F6 | "Today" is server UTC midnight — note about non-UTC runtimes | SEV-3 | Opus | Won't fix — informational only; consistent and correct for Vercel |
| F7 | `fetchDemand` has no 90-day date filter; SPEC §F3/F5 require trailing window | SEV-2 | Sonnet | Deferred to Alina — harmless now (seed is exactly 90 rows); timing decision: fix here vs. Phase 2 |
| F8 | `fefoRank: 0` is a misleading sentinel in `getExpiryRisk` | SEV-3 | Sonnet | Fixed @ 23e7a67 (changed to -1 + comment) |
| F9 | `role="dialog"` missing `aria-labelledby` on batch detail panel | SEV-3 | Sonnet | Fixed @ 8fe8c07 |

## Awaiting Alina's decision

**B1 — F4: Does already-expired stock belong in the value-at-risk KPIs?**

SPEC §F2 says "batches expiring ≤30/60/90 days" — ambiguous on whether negative days (already expired) should be included. Current code includes them; changing it would split expired inventory into a distinct "Already expired" figure. Changes the ≤30/60/90 headline numbers on the Expiry risk page.

Options: (1) keep as-is, or (2) exclude negative days from ≤30/60/90 buckets and add a separate "Already expired" KPI.

**B2 — F7: Fix the 90-day demand window now or defer to Phase 2?**

`fetchDemand` returns all history. SPEC §F3 mandates "last 90 days." Currently harmless (seed has exactly 90 rows/product). Becomes a real spec deviation once Phase 2 CRUD allows adding demand rows.

Options: (1) add `date >= today - 90` filter to `fetchDemand` now, or (2) defer to Phase 2 scope.
