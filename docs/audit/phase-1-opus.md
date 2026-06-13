# Audit — Phase 1 — Opus — 2026-06-13

## Verdict: PASS WITH FIXES

Scope reviewed: F1–F3 + foundation per `docs/audit/SCOPE-phase-1.md` — domain layer
(`src/lib/domain/`), data access (`src/lib/db/`), seed (`scripts/seed.ts`), schema
migration, the three pages and shared UI. Phase-2 items (F4–F8) were treated as
out of scope. Quality gates verified locally: `typecheck` clean, `test` 35/35 green,
domain coverage 100% (expiry.ts + reorder.ts).

## Findings

### [SEV-1 Critical]
None. No secret leakage, no client-reachable Supabase access, no SQL injection
surface, and — confirmed by a full repo grep — **no LLM/AI SDK or call anywhere**.
The domain math is correct against SPEC §F2/§F3 (verified by hand below).

### [SEV-2 Major]
None.

### [SEV-3 Minor]

**1. Dead code: `getProductDetail` and the `ProductDetail`/`DemandPoint` types are unused.**
`src/lib/db/queries.ts:226-252` — `getProductDetail` is exported but never called;
the dashboard detail panel uses the pre-fetched `batchesByProduct` prop
(`dashboard-view.tsx:268-272`), not this function. Its return type `ProductDetail`
(`src/lib/db/types.ts:77-81`) and `DemandPoint` are consequently dead too. This
violates CLAUDE.md rule 5 ("no dead code"). It clearly anticipates the Phase-2
demand sparkline, but as committed it is unreachable.
*Suggested fix:* either remove it now and reintroduce in Phase 2, or add the product
detail route/page that consumes it this phase. Don't leave it dangling.

**2. Duplicated fetch-and-compose logic between `getInventoryOverview` and `getDashboardData`.**
`src/lib/db/queries.ts:161-223` — both functions fetch all four tables, build the
same `supplierById`/`batchesByProduct`/`demandByProduct` maps, and run the identical
`computeMetrics` + sort. `getDashboardData` is essentially `getInventoryOverview`
plus a batch-view map. The first could be expressed in terms of the second (or a
shared private helper) to remove the duplication.
*Suggested fix:* extract one internal `composeMetrics(...)` helper; have both public
functions call it.

**3. `error.tsx` shows `error.message`, which Next.js redacts in production.**
`src/app/error.tsx:27` renders `{error.message}`. For errors thrown in Server
Components (which is exactly where the data layer throws its helpful
`Could not load suppliers: …` messages), Next.js strips the message in production
builds and substitutes a generic string + digest. So the carefully worded DB error
messages reach the user only in dev; in prod the user sees the generic line plus the
static "apply the schema / run seed" hint.
*Suggested fix:* this is acceptable as-is (the static hint carries the useful
guidance), but consider logging server-side with the digest and not relying on
`error.message` for user-facing detail. At minimum, be aware the message won't show
in the deployed demo.

**4. `valueAtRisk` includes already-expired stock in every horizon bucket.** *(behavior flag — see below)*
`src/lib/domain/expiry.ts:61-71` counts batches with `daysToExpiry <= horizonDays`,
which is true for all negative (expired) values, so expired stock is summed into the
≤30/≤60/≤90 KPIs and listed in the expiry table (`queries.ts:291`). SPEC §F2 phrases
this as "batches expiring ≤30/60/90 days," which a reader could interpret as
*future* expiry only. Including already-expired stock inflates "value at risk" with
value that is arguably already lost rather than at risk.
*Suggested fix:* decide intent — if expired stock should be a separate "already
expired" figure rather than folded into the at-risk horizons, split it out. Flagged
to Alina because it changes a user-facing number.

**5. `suggestedOrderQty` rounds *up* to pack size; SPEC says "rounded".**
`src/lib/domain/reorder.ts:72` uses `Math.ceil(target / packSize) * packSize`.
SPEC §F3 says "rounded to pack size of 10." Rounding up is the sensible supply-chain
choice (you order whole packs and want to clear the reorder point), and the code
comment states this intent, but it is a literal deviation from "rounded." No action
needed beyond confirming the intent is documented (it is, in `docs/DECISIONS.md` if
captured there).

**6. "Today" is the server's UTC calendar day.**
`queries.ts:190,256` and `expiry.ts` truncate `new Date()` to UTC midnight. On Vercel
(UTC) this is correct and consistent. Only note: if ever run in a non-UTC runtime,
day-boundary classifications near local midnight shift by a day. Consistent and fine
for this deployment; recorded for completeness.

## What is genuinely good

- **Domain layer is exemplary.** Pure, well-named functions; precise JSDoc tying each
  to the SPEC; correct edge-case handling (empty history → zeros, single point →
  σ=0, zero lead time / zero σ → SS=0). Tests assert *behavior and boundaries*
  (`stockStatus(30,100,30)='Critical'`, `expiryBucket(0)='red'`, FEFO tie-break,
  non-mutation of input, IEEE-754 rounding) rather than re-implementing the formula —
  none would pass if the code were wrong. 100% coverage is real, not gamed.
- **The 1000-row PostgREST cap is handled.** `selectAll` (`queries.ts:41-62`) paginates
  with `.range()` over a stable `.order()`. This is a real production bug most demos
  ship with (demand_history is ~3600 rows) — caught and fixed (commit `fdbfc9a`).
- **Security posture is clean and defense-in-depth.** `import 'server-only'` on the
  client and query modules, RLS enabled deny-all on every table, service key read from
  env only, `.env*` gitignored and confirmed untracked, business math kept entirely
  out of components.
- **Seed data is deterministic and purpose-built.** Seeded mulberry32 PRNG, Box-Muller
  noise, and — crucially — stock targets *derived from each product's real ROP/SS* so
  the Critical/Reorder/OK mix is guaranteed rather than hoped for. Anomalies and
  expired batches are planted intentionally for Phase-2 features.
- **Status precedence is correct and reasoned.** `stockStatus` checks Critical before
  Reorder with an explicit comment that ROP ≥ SS makes the ordering safe.

## Functionality-impact flags

- **Finding 4 (valueAtRisk includes expired stock).** Whether already-expired
  inventory belongs in the "value at risk ≤30/60/90 days" KPIs is a product decision
  that changes a headline number on the Expiry-risk page. Recommend Alina confirm the
  intended definition before Phase 2 builds the briefing on top of these figures.
- **Finding 1 (dead `getProductDetail`).** Removing vs. wiring it up this phase is a
  scope choice; either is fine, but it shouldn't ship dangling.

---

**Verdict in one sentence:** Phase 1 is solid, secure, and spec-accurate with an
exemplary tested domain layer — it PASSES with only minor cleanups (one piece of dead
code, some duplication) plus one product decision to confirm on how expired stock
feeds "value at risk."
