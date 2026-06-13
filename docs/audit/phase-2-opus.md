# Audit — Phase 2 — Opus — 2026-06-13

## Verdict: PASS WITH FIXES

Phase 2 (F4–F8) is well-built: the domain math is correct and exhaustively tested,
the hard security invariants all hold, and the three quality gates are green on my
machine (`eslint` exit 0, `tsc --noEmit` exit 0, 75/75 Vitest tests pass). The
findings below are one functionality bug that silently breaks the headline
"auto-reset every 24h" feature, one architecture-rule violation (swallowed delete
errors), and a handful of minor issues. None are security holes; none cause data
loss or wrong analytics output.

I independently re-derived the gates rather than trusting the SCOPE claims:
`node_modules`-pinned vitest reports `Test Files 4 passed, Tests 75 passed`; tsc and
eslint both exit 0. (Note for the environment: the machine PATH resolves an ancient
`node v6` from Brackets that shadows the real `node v26` in `C:\Program Files\nodejs`;
`npm` is not on PATH at all. Ran the toolchain by prepending the real Node dir. This
is a workstation issue, not a code finding.)

## Findings

### [SEV-2 Major] Vercel Cron will never trigger the reset — handler is POST-only, cron sends GET
`src/app/api/admin/reset/route.ts:266` (only `POST` exported) vs `vercel.json:1-8`.
Vercel Cron Jobs invoke the configured path with an **HTTP GET** request; the method
is not configurable in `vercel.json`. This route exports only `POST`, so the daily
`0 3 * * *` job will hit `GET /api/admin/reset`, which Next.js App Router answers with
**405 Method Not Allowed**. The result: the sandbox's central promise — "data resets
every 24h" (SPEC §F7/§F8, and the visible banner) — silently never fires in
production. The seed will only ever run via a manual `npm run seed`.
Note SPEC §F7 literally specifies "Vercel Cron hits **POST** /api/admin/reset", so the
spec's own assumption is the root of the mismatch. Vercel automatically attaches the
`Authorization: Bearer ${CRON_SECRET}` header to its (GET) cron requests when
`CRON_SECRET` is set, so the existing bearer guard would work unchanged once a GET
entry point exists.
Suggested fix (described, not implemented): add a `GET` handler that performs the same
guarded reset (or delegates to the POST logic), keeping the bearer-token check. Because
this touches the SPEC's stated contract and the route's public method surface, it is
also a functionality-impact flag for Alina (see below) — do not just silently flip the
method. Verify against current Vercel cron docs before changing.

### [SEV-2 Major] Inline delete handlers swallow API failures (Architecture Rule 4)
`src/components/dashboard/dashboard-view.tsx:154-163` (`deleteProduct`) and
`:482-485` (`onDeleteBatch`). Both call `fetch(..., { method: 'DELETE' })` and then
`router.refresh()` without inspecting `res.ok`. If the route returns 500 (e.g. a
cascade-delete error from `products/[id]/route.ts`), the UI just refreshes, the row
re-appears, and the user gets **no feedback** — the failure is silently swallowed.
This violates CLAUDE.md Architecture Rule 4 ("Errors are handled, not swallowed;
every external call has a meaningful user-facing message"). The CRUD *forms*
(`product-form.tsx:88`, `batch-form.tsx:66`) handle this correctly with `res.ok`
checks and an error banner — the delete buttons are the inconsistent path.
Suggested fix: check `res.ok` on both deletes and surface an error (toast/inline
message); also wrap in try/catch for network failure, matching the forms' pattern.

### [SEV-3 Minor] Reset route duplicates ~230 lines of seed logic/data from `scripts/seed.ts`
`src/app/api/admin/reset/route.ts:12-260` re-implements the Mulberry32 PRNG, the full
`SUPPLIERS`/`PRODUCTS`/`ANOMALIES` tables, the gaussian/expiry helpers, and the entire
row-building pipeline already present in `scripts/seed.ts`. This is a documented
decision (`docs/DECISIONS.md:31`) justified by `scripts/seed.ts` calling
`dotenv/config` at import time — but that is solvable by extracting the *pure* seed
data + row-builder into a shared module under `src/lib/` that both the script (env +
`createClient` wiring) and the route handler (`getServerSupabase`) import. As written,
the two product catalogs can silently drift, so a manual `npm run seed` and the cron
reset would produce different datasets — directly weakening CLAUDE.md Rule 5
("no duplicated logic"). Recommend extracting the shared pure layer; low urgency.

### [SEV-3 Minor] `hasRecentAnomaly` window has no upper bound
`src/lib/domain/anomalies.ts:43-51`. The check is only `a.date >= cutoff` (lower
bound = asOf − 13 days); there is no `a.date <= asOfIso` guard. The docstring claims
"within the last `recentDays` days", but any anomaly dated *after* `asOfIso` would
also return true. In practice this is unreachable (demand history is always ≤ today),
so it is not a live bug — but it is a latent correctness gap if the function is ever
reused with forward-dated data. Suggested fix: add the upper-bound comparison, or
document that input is assumed to be ≤ asOf. The same single-sided window is repeated
in `queries.ts:390-408` (`cutoff14`); fine today, same caveat.

### [SEV-3 Minor] Quick-question chips sort by name, not by the dimension they advertise
`src/components/dashboard/dashboard-view.tsx:72-108`. `top-var` ("Top value at risk")
filters `valueAtRisk30d > 0` but sets `sortKey: 'name'`; `expiring-60` filters
`minDaysToExpiry <= 60` but also sorts by name. A user clicking "Top value at risk"
expects the highest-value-at-risk products first, and "Expiring ≤60 days" expects
soonest-expiry first. The filtering is correct; only the ordering under-delivers on
the label. (The table has no sort key for `valueAtRisk30d`/`minDaysToExpiry`, so this
needs either a synthetic sort or a new column.) Cosmetic, but it is the F6 "instant
answer" promise. Suggested fix: sort these two chips by their headline metric.

### [SEV-3 Minor] PATCH/DELETE id params are not validated and missing rows return 204
`src/app/api/products/[id]/route.ts:25,59` and `src/app/api/batches/[id]/route.ts:14,48`.
The `id` path param is passed straight to `.eq('id', id)` without a `z.string().uuid()`
check, so a malformed id produces a caught Supabase 500 rather than a clean 400. Also,
updating/deleting a non-existent id returns 204 (Supabase reports no error for a
zero-row match) instead of 404, so callers can't distinguish "updated" from "no such
row". Both are low-impact for a public sandbox. Suggested fix: validate the id as a
UUID (return 400 on failure); optionally `.select()` the affected rows to return 404
when none matched.

### [SEV-3 Minor] `Dialog` modal lacks dialog semantics and Escape/focus handling
`src/components/ui.tsx:62-97`. The CRUD `Dialog` overlay has no `role="dialog"`,
`aria-modal`, `aria-labelledby`, no Escape-to-close, and no focus trap/restore — unlike
the `DetailPanel` (`dashboard-view.tsx:713`), which sets these correctly. With the
SPEC §7 Lighthouse Accessibility ≥95 gate landing in Phase 3, this is worth fixing now.
Suggested fix: mirror the `DetailPanel` ARIA wiring on `Dialog`, add an Escape key
listener, and move initial focus into the dialog.

## What is genuinely good

- **Anomaly math is correct and honestly tested.** `detectAnomalies`
  (`anomalies.ts:20-37`) uses the sample std dev (n−1), guards `length < 14` and
  `stdDev === 0` before dividing, and the test at `anomalies.test.ts:81-97`
  re-derives the expected z-score by hand against the implementation — I verified the
  19×10 + one-100 case by hand (mean 14.5, sample σ ≈ 20.12, z ≈ 4.25 > 2.5) and it
  matches. This is the kind of test that would fail if the formula were wrong.
- **Briefing engine is a clean, data-driven rules table** (`briefing.ts:82-144`) with
  a real full-output snapshot plus per-rule boundary tests (≤30d, ≤60d, threshold
  equality, singular/plural, |z| absolute value, healthy-state). All five rules fire
  on exactly the SPEC §F4 conditions; the VAR threshold is 5,000; healthy fires only
  when `lines.length === 0`. Snapshot and rules agree.
- **Security invariants hold.** `SUPABASE_SERVICE_ROLE_KEY` appears only in the
  `server-only`-guarded `db/client.ts`; no Supabase client or service key is reachable
  from any `'use client'` component; `.env*` is gitignored and no env file is tracked;
  the reset guard fails closed (`!cronSecret || authHeader !== ...` → 401) and leaks no
  secret in any response; zero LLM/AI SDKs anywhere in deps or `src`.
- **All mutations are zod-validated at the boundary** with the SPEC category enum,
  UUID supplier/product ids, `YYYY-MM-DD` regex on dates, non-negative quantity, and
  422 on parse failure with field errors — no raw SQL, no string interpolation into
  queries (Supabase query builder throughout).
- **The "no-LLM" decision is turned into a feature**: the briefing's "How is this
  generated?" panel (`briefing-view.tsx:94-122`) explains the deterministic engine,
  exactly the auditable story SPEC §F4/§5 asks for.

## Functionality-impact flags (for Alina)

- **Reset cron is non-functional as wired (SEV-2 above).** Fixing it changes the
  route's public method surface and reconciles a conflict with SPEC §F7's literal
  "Vercel Cron hits POST" wording (Vercel cron only issues GET). Two reasonable
  approaches with different surface: (a) add a guarded `GET` handler to the existing
  route, or (b) keep POST and trigger it from an external scheduler that can issue POST
  with the bearer header (e.g. a GitHub Actions cron, which §F8 already uses for the
  health check). Recommendation: option (a) — smallest change, keeps everything on
  Vercel, the auto-attached `CRON_SECRET` bearer still guards it. Please confirm the
  direction (and update SPEC §F7's "POST" wording) before it's changed.

---

**One-sentence verdict for Alina:** PASS WITH FIXES — the analytics, tests, and
security invariants are solid, but the daily auto-reset silently never runs because
Vercel cron sends GET while the route only handles POST, and the dashboard's delete
buttons swallow API errors; fix those two and Phase 2 is clean.
