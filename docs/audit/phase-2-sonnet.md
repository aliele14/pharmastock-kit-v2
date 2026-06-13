# Audit — Phase 2 — Sonnet — 2026-06-13

## Verdict: PASS WITH FIXES

Phase 2 (F4–F8) is structurally sound: the domain math is correct, all five
briefing rules fire on exactly the SPEC conditions, security invariants hold, and
the test suite covers the critical numeric paths thoroughly. I found the same two
functional blockers as the companion Opus audit, plus one additional crash vector
(invalid chip URL) that the Opus audit did not flag. No security holes, no data
loss. Fix the three SEV-2 items and Phase 2 is clean.

Note: `npm` is not on PATH in this environment. Quality-gate state (lint /
typecheck / test) was confirmed from the SCOPE-phase-2 handoff notes (75/75 tests
passing, lint and typecheck clean) rather than re-running locally.

---

## Findings

### [SEV-2 Major] Vercel Cron sends GET; route only exports POST — auto-reset never fires
`src/app/api/admin/reset/route.ts:266` — only `export async function POST` is
defined. Vercel Cron Jobs unconditionally use HTTP GET for the configured path
(method is not configurable in `vercel.json`). So the daily `0 3 * * *` schedule in
`vercel.json:3-6` hits `GET /api/admin/reset`, which Next.js App Router answers 405.
The visible sandbox banner ("data resets every 24h") silently never fires in
production; the database can only be re-seeded manually with `npm run seed`.

The existing bearer-token guard (`authHeader !== \`Bearer ${cronSecret}\``) would
work unchanged for a GET request — Vercel auto-attaches the `Authorization: Bearer
${CRON_SECRET}` header to its cron requests when `CRON_SECRET` is set in project
settings. Only the exported HTTP method needs to change.

Suggested fix: add a `GET` handler that performs the same guarded seed (or delegates
to the current `POST` body), keeping the bearer-token check unchanged. Verify against
current Vercel docs before implementing. Because SPEC §F7 literally specifies "Vercel
Cron hits **POST**", changing the method surface is a functionality-impact flag for
Alina — see below.

---

### [SEV-2 Major] Invalid `?chip=` URL param crashes the dashboard on mount
`src/components/dashboard/dashboard-view.tsx:136-148`.

```ts
const chipParam = searchParams.get('chip') as ChipId | null;  // unsafe cast
const [sortKey, setSortKey] = useState<SortKey>(() =>
  chipParam ? applyChip(products, chipParam).sortKey : 'name',
);
```

`searchParams.get('chip')` can return any string; the `as ChipId` cast silences
TypeScript but does nothing at runtime. `applyChip` is a switch with no `default`
branch — an unrecognised value causes the function to return `undefined` implicitly.
The `useState` lazy initializer then accesses `.sortKey` on `undefined`, throwing
`TypeError: Cannot read properties of undefined (reading 'sortKey')` before the
component mounts. The entire dashboard page crashes for any visitor whose URL
contains a chip query param that is not one of the five valid `ChipId` values (e.g.
a shared link that was manually edited, or a stale bookmark from a future rename).

The same `applyChip` call appears in the `visible` `useMemo` and would crash again
even if the initializer somehow survived.

Suggested fix: validate the param before using it:
```ts
const VALID_CHIPS = new Set<string>(['expiring-60','below-reorder','cold-at-risk','top-var','anomalies']);
const chipParam = VALID_CHIPS.has(searchParams.get('chip') ?? '')
  ? (searchParams.get('chip') as ChipId)
  : null;
```
Alternatively, add a `default: return { filtered: products, sortKey: 'name', sortDir: 'asc' }` branch to `applyChip`.

---

### [SEV-2 Major] Inline delete handlers swallow errors (Architecture Rule 4 violation)
`src/components/dashboard/dashboard-view.tsx:154-163` (`deleteProduct`) and
`:482-485` (`onDeleteBatch`).

`deleteProduct` wraps `fetch` in a `try/finally` but has no `catch` block and never
inspects `res.ok`. A network failure propagates as an unhandled promise rejection;
a server 500 causes the UI to silently refresh with the row still present and no
feedback to the user. `onDeleteBatch` is even balder — no try/finally at all,
fetch result ignored entirely.

The CRUD *forms* handle this correctly: they check `res.ok`, render an error
banner, and catch network errors (`product-form.tsx:82-98`, `batch-form.tsx:60-76`).
The delete buttons are the inconsistent path, violating CLAUDE.md Architecture Rule
4 ("Errors are handled, not swallowed; every external call has a meaningful
user-facing message").

Suggested fix: mirror the forms' pattern — check `res.ok`, extract the error
message from the JSON body, show it in-line (or a transient toast), and wrap in
`try/catch` for network failures. Set a per-row `deletingId`-style error state
rather than a global one so concurrent operations don't clobber each other.

---

### [SEV-3 Minor] `hasRecentAnomaly` has no upper-bound guard
`src/lib/domain/anomalies.ts:49-51`.

```ts
const cutoff = new Date(asOfMs - (recentDays - 1) * MS_PER_DAY).toISOString().slice(0, 10);
return anomalies.some((a) => a.date >= cutoff);
```

The check is `date >= cutoff` only; an anomaly dated *after* `asOfIso` (a future
date) would return `true`. In the current system, demand history is always ≤ today
so this is unreachable, but the function's contract ("within the last `recentDays`
days of `asOfIso`") is unenforceable if the function is ever reused with
forward-dated input. The same single-sided window is duplicated in
`queries.ts:390-408` (`cutoff14`). Suggested fix: add `&& a.date <= asOfIso`, or
document the "input assumed ≤ asOf" invariant in the JSDoc.

---

### [SEV-3 Minor] `top-var` and `expiring-60` chips sort by name, not by their headline metric
`src/components/dashboard/dashboard-view.tsx:94-107`.

`top-var` ("Top value at risk") filters `valueAtRisk30d > 0` but sets
`sortKey: 'name'`. A visitor clicking it expects the highest-value-at-risk products
first. `expiring-60` ("Expiring ≤60 days") filters `minDaysToExpiry <= 60` but also
sorts by name, where soonest-expiry-first would answer the question a supply analyst
actually asks. The filtering is correct; the sort direction under-delivers the F6
"instant answer" promise. Neither `valueAtRisk30d` nor `minDaysToExpiry` is a
current `SortKey`, so a new sort path is needed (or a secondary sort on the
computed field at the chip level).

---

### [SEV-3 Minor] PATCH and DELETE route handlers do not validate the `id` path param
`src/app/api/products/[id]/route.ts:25,59` and
`src/app/api/batches/[id]/route.ts:14,48`.

The `id` param from the URL is passed directly to `.eq('id', id)` without a UUID
format check. A malformed id (e.g. `foo`) produces a Supabase 500 rather than a
clean 400. More subtly, updating or deleting a non-existent but well-formed UUID
returns 204, since Supabase reports no error for a zero-row match — callers cannot
distinguish "success" from "no such row". Low impact for a public sandbox but
inconsistent with the POST routes' validated inputs.

Suggested fix: add `z.string().uuid()` validation on `id` at the top of each
handler; return 400 on failure. To detect missing rows, chain `.select('id')` on
updates/deletes and return 404 if the result is empty.

---

### [SEV-3 Minor] `Dialog` modal missing ARIA semantics, Escape handler, and focus trap
`src/components/ui.tsx:62-97`.

The `Dialog` overlay has no `role="dialog"`, no `aria-modal="true"`, and no
`aria-labelledby` pointing at its `<h2>` title. It has no `keydown` listener for
Escape, and no focus-trap/focus-restore logic. Compare with `DetailPanel` in
`dashboard-view.tsx:713-716`, which sets all three ARIA attributes correctly. With
the Phase 3 Lighthouse Accessibility ≥ 95 gate, this gap will surface then at the
latest. Suggested fix: mirror the `DetailPanel` ARIA wiring on `Dialog`; add an
`useEffect` Escape listener; move focus to the first focusable element on open, and
restore it on close.

---

### [SEV-3 Minor] Misleading test name contradicts the assertion body
`src/lib/domain/anomalies.test.ts:23-27`.

```ts
it('returns [] on exactly MIN_DATAPOINTS with one spike (boundary ≥ is accepted)', () => {
  const qtys = [...Array<number>(MIN_DATAPOINTS - 1).fill(10), 200];
  expect(detectAnomalies(makeSeries(qtys))).toHaveLength(1);  // expects 1, not []
```

The test name says "returns []" but the assertion expects `toHaveLength(1)`. The
underlying behaviour tested is correct (exactly 14 points IS accepted; the anomaly
IS detected), but a reader encountering a red test for the first time would be
confused about the intended contract. Suggested fix: rename to `'detects anomaly on
exactly MIN_DATAPOINTS (lower boundary is inclusive)'`.

---

### [SEV-3 Minor] Product-edit form resolves supplier by name — fragile in edge cases
`src/components/dashboard/dashboard-view.tsx:511`.

```ts
supplier_id: suppliers.find((s) => s.name === dialog.product.supplierName)?.id ?? '',
```

`ProductMetrics` carries `supplierName: string` but no `supplierId`, so the edit
form must reverse-lookup the supplier ID from the name. If two suppliers shared the
same name, the wrong `supplier_id` would be pre-populated silently (the Zod schema
validates UUID format but not identity). In the current seeded data all six supplier
names are unique, so this is not a live bug — but it is fragile by design. Suggested
fix (Phase 3 or if suppliers expand): add `supplierId` to `ProductMetrics` and pass
it directly, or assert supplier-name uniqueness in the seed.

---

### [SEV-3 Minor] Reset route duplicates ~230 lines of seed logic already in `scripts/seed.ts`
`src/app/api/admin/reset/route.ts:12-260`. The full Mulberry32 PRNG, SUPPLIERS /
PRODUCTS / ANOMALIES tables, gaussian helper, and row-builder pipeline are
re-implemented here. The DECISIONS.md entry (2026-05-25) justifies the duplication
because `scripts/seed.ts` imports `dotenv/config` at load time, which cannot run in
a Next.js route handler. That reason is valid but the fix is extractable: the
*pure* data (SUPPLIERS, PRODUCTS, ANOMALIES, PRNG, row-builder) lives in a shared
`src/lib/seed-data.ts` module with no env or DB coupling; both the script and the
route handler then import it and wire their own DB client. As written, the two
product catalogues can drift silently if one is updated and the other is not —
weakening CLAUDE.md Rule 5 ("no duplicated logic").

---

## What is genuinely good

- **Domain math is correct and re-verifiable.** `detectAnomalies`
  (`anomalies.ts:20-37`) uses sample std dev (n−1), guards `length < 14` and
  `stdDev === 0`, and the test at `anomalies.test.ts:81-97` re-derives the expected
  z-score algebraically against the implementation. I independently verified the
  19×10 + one-100 case: mean 14.5, sample σ ≈ 20.12, z ≈ 4.25 > 2.5 — matches.
  This test would fail if the formula switched to population std dev (n).

- **Briefing rules match SPEC §F4 exactly.** All five rules fire on the exact
  conditions specified: VAR_RISK_THRESHOLD = 5,000 ✓; Rule 1 filters ≤30d then
  sorts descending by `lineValue` ✓; Rule 5 gates on `coldChain && daysToExpiry <=
  60` ✓; the healthy-state path fires only when `lines.length === 0` ✓ and includes
  both the threshold and the current value in its text ✓. The snapshot test
  (`briefing.test.ts.snap`) locks the full output for a five-rule-firing fixture.

- **Security invariants hold completely.** `db/client.ts` is guarded by
  `import 'server-only'` (line 1); `queries.ts` repeats the guard; no Supabase
  client or service key is importable from any `'use client'` component. The reset
  bearer check fails closed (`!cronSecret || authHeader !== \`Bearer ${cronSecret}\``
  → 401); no secret is reflected in any response body. Zero LLM/AI SDKs in
  dependencies or source.

- **Mutation validation is thorough and consistent across both POST routes.** Both
  product and batch POST handlers use Zod, enforce the full SPEC category enum,
  validate `supplier_id`/`product_id` as UUIDs, enforce `YYYY-MM-DD` on dates,
  reject non-positive cost, and return 422 with field-level errors — no raw SQL, no
  string interpolation into queries.

- **The "deterministic, not LLM" framing is a first-class UI feature.** The
  briefing's "How is this generated?" panel (`briefing-view.tsx:94-122`) names the
  five rules, explains determinism, and cites the source file. This is exactly the
  story SPEC §§F4–5 and the README "How this was built" section need to tell
  recruiters.

---

## Functionality-impact flags (for Alina)

- **Reset cron is non-functional as wired (SEV-2 above).** SPEC §F7 says "Vercel
  Cron hits POST /api/admin/reset" — but Vercel cron only issues GET, so the spec
  itself contains the mismatch. Two options: (a) add a `GET` handler with the same
  bearer guard to the existing route (smallest change, no infra cost); (b) keep POST
  and trigger it from the existing GitHub Actions cron (which already hits
  `/api/health`) by adding a POST step with the bearer header — that flow is already
  described in SPEC §F8. Option (a) is recommended: stays on Vercel, zero new
  infrastructure, the auto-attached `CRON_SECRET` bearer still guards it. Update
  SPEC §F7's "POST" wording to "GET" after the direction is confirmed.

---

**One-sentence verdict for Alina:** PASS WITH FIXES — the analytics, tests, and
security invariants are solid; fix the three SEV-2 items (cron GET/POST mismatch,
delete buttons swallowing errors, and dashboard crash on an invalid chip URL param)
and Phase 2 is ready.
