# Audit — Phase 1 — Sonnet — 2026-06-13

## Verdict: PASS WITH FIXES

Scope: F1–F3 + foundation per `docs/audit/SCOPE-phase-1.md`. Reviewed domain layer,
data access, schema migration, seed script, three pages, shared components. Phase-2
features (F4–F8) treated as explicitly out of scope. Quality gates verified by reading
test files and tsconfig: strict + `noUncheckedIndexedAccess` + `noImplicitOverride`
enabled; 35 tests, 100% domain coverage.

---

## Findings

### [SEV-1 Critical]

None. Full repo grep (`createClient|supabase`) confirms Supabase is only in
`src/lib/db/client.ts` (guarded by `import 'server-only'`) and `scripts/seed.ts`
(Node-only script). No LLM/AI SDK found anywhere. RLS enabled deny-all on all four
tables. `.env*` gitignored and confirmed untracked. No user input is interpolated
into SQL (Supabase client uses parameterized PostgREST queries throughout).

---

### [SEV-2 Major]

**1. Demand window not enforced — SPEC says "last 90 days", query returns all history.**

`src/lib/db/queries.ts:81–88` — `fetchDemand()` calls `selectAll('demand_history', …)`
with no date filter. All demand history for a product is loaded and fed to `demandStats`
and, in Phase 2, to z-score anomaly detection. SPEC §F3 is explicit: "avg daily demand
d̄ and std dev σd **over the last 90 days**." SPEC §F5: "computed over the trailing
window, min 14 datapoints."

Currently harmless because the seed creates exactly 90 rows per product, so all history
*is* the last 90 days. But the `selectAll` helper supports only equality filters — no
`gte` / date-range parameter exists — so there is no mechanism to enforce the window.
When Phase 2 CRUD allows visitors to add or import demand history, the window silently
expands, drifting from the spec.

The fix must happen in one of two places: either add a `date >= today - 90` filter
to `fetchDemand`, or post-filter the returned rows before calling `demandStats`. The
former is cheaper (fewer rows transferred); the latter avoids extending `selectAll`.
Either way the Phase-2 anomaly detection window ("min 14 datapoints") must use the
same slice.

---

### [SEV-3 Minor]

**1. Dead exported code: `getProductDetail`, `ProductDetail`, and `DemandPoint`.**

`src/lib/db/queries.ts:226–252` exports `getProductDetail` which is not imported by
any file in `src/`. The return type `ProductDetail` (`src/lib/db/types.ts:77–81`) and
its `DemandPoint` member are also dead. The dashboard detail panel uses
`batchesByProduct` pre-fetched by `getDashboardData`, not this function. No
`/product/[id]` route exists. This violates CLAUDE.md rule 5 ("no dead code").
Either remove it now and re-introduce in Phase 2, or wire it to a route this phase.

**2. `getInventoryOverview` and `getDashboardData` duplicate four-table fetch + composition.**

`src/lib/db/queries.ts:161–223` — both functions independently call all four
`fetch*` helpers, build identical `supplierById`/`batchesByProductRow`/`demandByProduct`
maps, and run the same `computeMetrics` + sort pipeline. `getDashboardData` adds only
the batch-view map. `getReorderAlerts` correctly delegates to `getInventoryOverview`;
`getDashboardData` does not follow that pattern. Extract a shared private helper (or
have `getDashboardData` call `getInventoryOverview` for metrics and add the batch-view
pass separately).

**3. `fefoRank: 0` in `ExpiringBatchView` is a misleading sentinel.**

`src/lib/db/queries.ts:282` — `getExpiryRisk` hardcodes `fefoRank: 0` for every
`ExpiringBatchView`. In the batch detail panel, FEFO ranks start at 1 (rank 0 is
never a valid position). Any future consumer of `ExpiryRisk` that reads `fefoRank`
without knowing this convention will treat 0 as "first" rather than "not ranked." A
short inline comment (`// not applicable in global expiry view`) or a field default of
`-1` with a comment would make the sentinel explicit.

**4. `role="dialog"` is missing `aria-labelledby` on the batch detail panel.**

`src/components/dashboard/dashboard-view.tsx:337` — the `DetailPanel` renders a
`<div role="dialog" aria-modal="true">` but does not connect `aria-labelledby` to the
`<h2>` at line 348. WCAG 2.1 SC 4.1.2 requires interactive dialogs to have an
accessible name. The fix is two lines: add `id="detail-panel-title"` to the h2 and
`aria-labelledby="detail-panel-title"` to the dialog div. (SPEC §7 targets
Accessibility ≥ 95 in Phase 3 Lighthouse; this would fail that gate if left unfixed.)

**5. `suggestedOrderQty` rounds up to pack size; SPEC says "rounded."**

`src/lib/domain/reorder.ts:72` uses `Math.ceil(target / packSize) * packSize`. SPEC
§F3 says "rounded to pack size of 10." Rounding up is the correct supply-chain
choice (you never order a partial pack), but it is a literal deviation. No
`DECISIONS.md` entry captures this. Add one line: "2026-06-12 — suggestedOrderQty
rounds UP to pack size — ordering a partial pack is not possible; ceiling is safer
than nearest-integer."

---

## What is genuinely good

- **Domain functions are textbook quality.** Pure, edge-case-correct (empty history,
  single point, σ=0, zero lead time), documented with the SPEC formula inline, and
  tested on behavior rather than implementation — every test would fail if the formula
  were wrong. `noUncheckedIndexedAccess` is on and the code proves it by using `!`
  assertions only at genuinely provably non-null indices.
- **UTC date math is airtight.** `parseIsoDateUtc` and `startOfUtcDay` ensure all
  date arithmetic is in UTC, eliminating DST ambiguity at day boundaries. The math
  was independently verified: `daysToExpiry('2026-06-13', asOf at 23:59Z)` = 1 ✅.
  Both `getDashboardData` and `getExpiryRisk` capture a single `asOf = new Date()` and
  thread it through consistently — no mid-request clock drift.
- **Pagination of Supabase reads is correct.** `selectAll` (queries.ts:41–62) loops
  `.range(from, from + 999)` until a short page arrives, handling the PostgREST 1000-row
  cap that demand_history (~3600 rows) would otherwise silently exceed. The loop
  terminates correctly when row count is an exact multiple of PAGE_SIZE (returns 0
  rows on the extra call).
- **Security posture is defense-in-depth.** `import 'server-only'` on both `client.ts`
  and `queries.ts` makes a client-bundle import a build error, not just a runtime
  surprise. RLS deny-all is a backstop even if service-key logic is ever bypassed.
  `.env*` gitignore covers both `.env.local` and any future `.env.production`.
- **Seed is deterministic and realistic.** mulberry32 PRNG + Box-Muller noise gives
  stable repeatable demo data. Stock targets are computed from each product's actual
  ROP/SS via the domain layer, so Critical/Reorder/OK statuses are mathematically
  guaranteed — not just eyeballed.

---

## Functionality-impact flags

- **Finding SEV-2 (demand window).** Fixing the 90-day window by adding a date filter
  to `fetchDemand` changes what data the demand stats and (Phase 2) anomaly detection
  see. Since the seed is exactly 90 days this is transparent in Phase 1, but it is a
  required change before Phase 2 CRUD lands. Not a user-visible change today; flag to
  ensure it is addressed in Phase 2 scope.
- **Finding SEV-3/3 (`fefoRank: 0`).** If the briefing engine (Phase 2) ever consumes
  `ExpiryRisk.batches`, a `fefoRank` of 0 could be mistaken for rank 1. Confirm the
  briefing never reads this field, or use a clearly invalid sentinel (`-1`) with a
  comment.

---

**Verdict in one sentence:** Phase 1 passes security and correctness checks with an
excellent tested domain layer — the only real fix needed before Phase 2 is enforcing
the 90-day demand window that SPEC §F3/F5 requires and that current queries do not
implement.
