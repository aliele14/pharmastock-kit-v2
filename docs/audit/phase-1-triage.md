# Triage — Phase 1 — 2026-06-13

## Merged Findings Table

| # | Finding | Severity | Found by | Final status |
|---|---------|----------|----------|--------------|
| F1 | Dead exported code: `getProductDetail`, `ProductDetail`, `DemandPoint` | SEV-3 | Both | Fixed @ 23e7a67 |
| F2 | `getInventoryOverview` / `getDashboardData` duplicate four-table fetch + compose | SEV-3 | Both | Fixed @ 23e7a67 (extracted `fetchAndBuildMetrics`) |
| F3 | `error.tsx` renders `error.message`, stripped by Next.js in production | SEV-3 | Opus | Won't fix — static hint carries the useful guidance; acceptable as-is (Opus's own verdict) |
| F4 | `valueAtRisk` includes already-expired stock in ≤30/60/90 KPIs | SEV-3 | Opus | Fixed @ 2c3c41f (expired shown as separate KPI; ≤30/60/90 now future-only) |
| F5 | `suggestedOrderQty` rounds UP (ceil); SPEC says "rounded" — no DECISIONS.md entry | SEV-3 | Both | Fixed @ 05d2310 (docs only; code is correct) |
| F6 | "Today" is server UTC midnight — note about non-UTC runtimes | SEV-3 | Opus | Won't fix — informational only; consistent and correct for Vercel |
| F7 | `fetchDemand` has no 90-day date filter; SPEC §F3/F5 require trailing window | SEV-2 | Sonnet | Fixed @ e2f7838 (post-filter in fetchAndBuildMetrics; asOf shared to avoid drift) |
| F8 | `fefoRank: 0` is a misleading sentinel in `getExpiryRisk` | SEV-3 | Sonnet | Fixed @ 23e7a67 (changed to -1 + comment) |
| F9 | `role="dialog"` missing `aria-labelledby` on batch detail panel | SEV-3 | Sonnet | Fixed @ 8fe8c07 |

## Phase 1 triage complete

All 9 findings resolved. No open items.
