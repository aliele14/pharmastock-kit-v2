# Audit scope — Phase 2

What was built this phase and where the important code lives. For the dual-model
audit (`prompts/audit.md`), run once with Opus and once with Sonnet.

## What was built (F4–F8)

- **F5 — Demand anomaly detection.** Z-score anomaly detection (|z| > 2.5, sample
  std dev, ≥14 datapoints). Dashboard shows a 90-day demand sparkline with anomaly
  highlights (ReferenceDot) and an anomaly badge per product row.
- **F4 — Deterministic supply briefing.** Five typed rules evaluate live data and
  produce a `BriefingReport` (Risks / Actions / Watchlist sections). Generated via
  a React Server Action with a `useTransition` pending state. "How is this
  generated?" note explains the rules to the user.
- **F6 — Quick-question chips.** Five preset chips filter/sort the dashboard by
  URL search param (`?chip=…`), making each view bookmarkable and shareable.
- **F7 — Sandbox CRUD.** Add/edit/delete products and batches via CRUD route
  handlers (POST/PATCH/DELETE to `/api/products[/id]` and `/api/batches[/id]`).
  Forms wired into the dashboard via a Dialog modal. Product DELETE cascades
  demand_history → batches → product in the route handler.
- **F8 — Health + auto-reset.** `GET /api/health` checks DB connectivity.
  `POST /api/admin/reset` re-seeds the database; guarded by
  `Authorization: Bearer ${CRON_SECRET}`. `vercel.json` schedules the reset at
  03:00 UTC daily.

## Files that matter most (new or significantly changed this phase)

### Domain
- `src/lib/domain/anomalies.ts` — `detectAnomalies`, `hasRecentAnomaly`. Core math.
- `src/lib/domain/anomalies.test.ts` — 16 tests; sample std dev, threshold guards, date windows.
- `src/lib/domain/briefing.ts` — `generateBriefing`, five typed rules. All logic is pure.
- `src/lib/domain/briefing.test.ts` — 24 tests including a full-output snapshot.
- `src/lib/domain/__snapshots__/briefing.test.ts.snap` — Snapshot baseline.

### Database / server
- `src/lib/db/queries.ts` — `fetchAndBuildMetrics` now returns `demandByProduct` and
  `anomaliesByProduct`; `getDashboardData` exposes both; `getBriefingData` assembles
  `BriefingInput` from live DB.
- `src/app/briefing/actions.ts` — Server Action that calls `getBriefingData` + `generateBriefing`.

### API routes
- `src/app/api/products/route.ts` — POST; Zod schema validates category enum, supplier UUID, positive cost.
- `src/app/api/products/[id]/route.ts` — PATCH + DELETE. DELETE cascades manually.
- `src/app/api/batches/route.ts` — POST; Zod schema validates date format, non-negative qty.
- `src/app/api/batches/[id]/route.ts` — PATCH + DELETE.
- `src/app/api/health/route.ts` — GET; queries one supplier row; returns 503 on failure.
- `src/app/api/admin/reset/route.ts` — POST; validates Bearer token; re-seeds with Mulberry32 PRNG (seed 0x50484152).

### UI
- `src/components/dashboard/dashboard-view.tsx` — Extended with sparklines, anomaly badge, chip bar, CRUD icon buttons, and Dialog renders.
- `src/components/dashboard/product-form.tsx` — Controlled form; POST or PATCH to products API.
- `src/components/dashboard/batch-form.tsx` — Controlled form; POST or PATCH to batches API.
- `src/components/briefing/briefing-view.tsx` — Client component; Generate button with useTransition; color-coded report sections.
- `src/components/ui.tsx` — `Dialog` modal overlay added.
- `vercel.json` — Cron schedule for the reset endpoint.

## Areas requiring extra scrutiny

**1. Anomaly math (`src/lib/domain/anomalies.ts`)**
Verify: sample std dev (divides by n−1, not n); the σ=0 guard returns [] not crash;
the `hasRecentAnomaly` window is inclusive of both endpoints (asOfIso and
asOfIso−13 days); MIN_DATAPOINTS (14) and Z_THRESHOLD (2.5) match SPEC §F5.

**2. Briefing rules (`src/lib/domain/briefing.ts`)**
Verify: all five rules fire on the correct condition; the VAR_RISK_THRESHOLD is
5,000 (SPEC §F4); the `healthy: true` path fires only when no rules fire; rule 1
names the top-3 batches by line value (not top-3 by days-to-expiry); rule 5 scopes
cold-chain risk to ≤60 days.

**3. Reset endpoint guard (`src/app/api/admin/reset/route.ts`)**
Verify: `Authorization: Bearer ${CRON_SECRET}` comparison is exact and
case-sensitive; the route returns 401 (not 403) on missing/wrong token; the
`CRON_SECRET` env var is read only server-side; no secret appears in a response body.

**4. Mutation validation (`src/app/api/products/route.ts`, `src/app/api/batches/route.ts`)**
Verify: Zod parse errors return 422 with the error message (not 500); the category
field is constrained to the SPEC enum values; `supplier_id` is validated as a UUID;
date fields match `YYYY-MM-DD` regex; no raw SQL or unsanitised interpolation.

**5. Secrets / architecture rules**
Confirm no Supabase client or `SUPABASE_SERVICE_ROLE_KEY` reference appears in any
`'use client'` component. Confirm the Server Action imports `server-only` transitively
(via `queries.ts` → `client.ts`). Confirm `vercel.json` cron path matches the actual
route (`/api/admin/reset`).

## Deferred to Phase 3 (not in scope to flag as "missing")

Nothing specified — SPEC §F1–F8 are now fully implemented. Phase 3 is polish,
performance, and a final end-to-end review before the public portfolio launch.

## Quality gates at handoff

- `npm run lint` — clean (0 errors, 0 warnings)
- `npm run typecheck` — clean
- `npm run test` — 75 tests, 4 files, all passing
  - 16 anomaly tests, 24 briefing tests, 17 expiry tests, 18 reorder tests
