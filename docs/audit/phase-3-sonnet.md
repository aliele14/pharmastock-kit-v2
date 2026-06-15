# Audit — Phase 3 — Sonnet 4.6 — 2026-06-15

## Verdict: PASS WITH FIXES

Phase 3 (PWA manifest, OG image, CI/CD workflows, README, WALKTHROUGH) introduces
no runtime code that violates a security or correctness invariant. **No SEV-1
findings.** The defects are concentrated in the documentation deliverables —
specifically `docs/WALKTHROUGH.md` (the interview-prep document) and `README.md`
(the local-setup guide), which together contain multiple verifiably wrong references
to code that does not exist. These are not cosmetic — they are the exact claims an
interviewer or recruiter will try to verify, and they will fail.

Scope audited: `757c5df..HEAD` (commits `6b12b1a` → `63d6c94`) — PWA
manifest/icon, OG image, root metadata/layout changes, focus styles, per-page
titles, CI and heartbeat workflows, README, WALKTHROUGH, SCOPE-phase-3, DECISIONS.
Also reviewed deploy-time touchpoints explicitly listed as Phase 3 smoke-test
items: `vercel.json`, `/api/health`, `/api/admin/reset`.

---

## Findings

### [SEV-1 Critical]

None.

- No LLM/AI SDK is present in `package.json` or anywhere in `src/`.
- `SUPABASE_SERVICE_ROLE_KEY` is read only in server-side code; the `server-only`
  guard on `src/lib/db/client.ts` makes any accidental browser import a build error.
- `/api/admin/reset` bearer check at `route.ts:266-269` uses `Boolean(cronSecret)`
  so a missing env var cannot authenticate via an empty string; applied to both GET
  and POST.
- `dangerouslySetInnerHTML` in `layout.tsx:51` injects a hardcoded constant string
  (`themeInitScript`) — no user input, no injection risk.
- Heartbeat workflow uses `vars.PRODUCTION_URL` (a GitHub Actions variable, not a
  secret) to build a URL passed to `curl`; it is not used in code that touches DB or
  secrets, so the exposure surface is correct.

---

### [SEV-2 Major] WALKTHROUGH.md references functions and types that do not exist

`docs/WALKTHROUGH.md` is the document Alina is meant to quote from during
interviews. Every code reference in it should be openable on screen. Several are
not:

**Line 22** — names domain functions `computeReorderMetrics` and
`computeExpiryMetrics`. Neither exists anywhere in `src/`. The actual pipeline in
`src/lib/db/queries.ts` (lines 119–121, 216, 314) calls `demandStats`,
`safetyStock`, `reorderPoint`, `detectAnomalies`, and `valueAtRisk` from
`src/lib/domain/`. An interviewer asking "show me `computeReorderMetrics`" will
find nothing.

**Line 21** — claims days-to-expiry is "computed by Postgres as
`expiry_date - CURRENT_DATE`". It is not. The query selects the raw `expiry_date`
column; the computation is done in TypeScript via `daysToExpiry(b.expiry_date,
asOf)` in `src/lib/db/queries.ts` (e.g. lines 152, 235, 241). The distinction
matters: a candidate claiming Postgres does it, when TypeScript does it, sounds
wrong to an interviewer who checks.

**Lines 84 and 90** — refers to the briefing input type as `BriefingSnapshot` "in
`src/lib/domain/types.ts`". The actual type is `BriefingInput`, defined and
exported from `src/lib/domain/briefing.ts`, and consumed under that name in
`src/app/briefing/actions.ts:7` and `briefing.test.ts:6`. `BriefingSnapshot` does
not exist (no matches in `src/`). `src/lib/domain/types.ts` also does not appear
to exist as the home of this type.

**Line 90** — claims snapshot tests use `toMatchInlineSnapshot`. The actual test
at `src/lib/domain/briefing.test.ts:373` uses `toMatchSnapshot()` (not inline).
**Line 94** — claims "the snapshot for the full healthy report and the snapshot
for a report with all five rules firing are both committed." In reality there is
one committed snapshot (the full all-rules-firing report); the healthy state is
verified with explicit string assertions (lines 34–56), not a snapshot. Both
claims in this paragraph are wrong.

Suggested fix: replace `computeReorderMetrics`/`computeExpiryMetrics` with the
real function names from `queries.ts`/`domain/`; correct the days-to-expiry
sentence to "computed in the domain layer via `daysToExpiry()`"; rename
`BriefingSnapshot` → `BriefingInput` and remove the reference to `types.ts`;
reword the snapshot section to "one committed snapshot of the all-rules-firing
report; healthy state covered by explicit assertions."

---

### [SEV-2 Major] README local-setup points at a non-existent schema file

`README.md:226` instructs the reader to "apply `supabase/schema.sql` in the
Supabase SQL editor". That path does not exist in the repository. The actual
schema is at `supabase/migrations/20260612120000_initial_schema.sql` — the only
`.sql` file present. A developer cloning the repo and following the documented
setup will not find `supabase/schema.sql`, the `npm run seed` step will fail
against an empty database, and the project will appear broken on first clone.

Suggested fix: update `README.md:226` to reference
`supabase/migrations/20260612120000_initial_schema.sql`, or add a stable
`supabase/schema.sql` symlink/copy and keep it in sync.

---

### [SEV-3 Minor] No `metadataBase` — OG image URL is not pinned to production

`src/app/layout.tsx:11-27` defines `openGraph` metadata and
`src/app/opengraph-image.tsx` generates the branded card, but no `metadataBase`
is set in the root metadata. Without it, Next.js resolves the absolute `og:image`
URL against `http://localhost:3000` in local builds and against `VERCEL_URL`
(a per-deployment preview hostname, e.g.
`pharmastock-kit-v2-abc123.vercel.app`) rather than the stable canonical URL on
Vercel production. The Phase 3 smoke-test item "OG image renders correctly at the
Vercel URL" and the goal of the card previewing well on LinkedIn are both
undermined when crawlers see a non-canonical or preview-tier URL.

Suggested fix: add `metadataBase: new URL('https://pharmastock-kit-v2.vercel.app')`
to the root `metadata` object. This requires confirming the canonical production URL
(see Functionality-impact flags).

### [SEV-3 Minor] OG image SVG uses kebab-case attributes in JSX

`src/app/opengraph-image.tsx:45-47` uses `stroke-width="2"`, `stroke-linecap="round"`,
`stroke-linejoin="round"` on the inline `<svg>` element. Satori (next/og's underlying
renderer) accepts these, and `tsc` does not flag them in this context, but they are
inconsistent with React JSX convention (`strokeWidth`, `strokeLinecap`,
`strokeLinejoin`) used throughout the rest of the codebase. Cosmetic only — no
runtime impact.

Suggested fix: rename to camelCase for consistency.

### [SEV-3 Minor] CI omits the build step — Phase 3's build-time artifacts go unchecked

`.github/workflows/ci.yml` runs lint + typecheck + test only. This is a deliberate,
documented decision (`docs/DECISIONS.md` Phase 3) because `npm run build` requires
Supabase env secrets not available in CI. The gap that matters specifically in Phase
3: the additions that are build-time only — `opengraph-image.tsx` (edge runtime OG
generation), the manifest wiring, and metadata resolution — are not exercised by any
of the three gate commands. A regression in the OG route (bad edge runtime export, a
`metadataBase` misconfiguration) could ship silently and fail only post-deploy.
Options: add a build job with placeholder env vars, or accept the gap consciously and
note it in the deploy checklist.

### [SEV-3 Minor] Heartbeat cron cadence overstated in inline comment

`.github/workflows/heartbeat.yml:14` — `cron: '0 8 */3 * *'` restarts the
day-of-month counter at the start of each month (runs on days 1, 4, 7 … 28/31,
then 1 again), so the actual gap across a month boundary can be as short as 1 day
(days 31 → 1) or as long as 4 days (days 28 → 1 in February). The inline comment
"every 3 days (1st, 4th, 7th …)" implies strict 3-day intervals. Harmless — the
worst-case gap is still well inside Supabase's 7-day pause window — but the comment
slightly overstates regularity.

---

## What is genuinely good

- **Reset route authorization is correctly implemented** (`route.ts:266-269`):
  `Boolean(cronSecret)` prevents an empty env var from matching an empty bearer
  token; the check is applied identically to both GET (Vercel cron) and POST
  (manual trigger); the failure path returns a clean 401; and the success/error paths
  both return structured JSON with a 500 on seed failure. This is exactly right.
- **Zero new dependencies** for all Phase 3 goals: OG image via `next/og`
  `ImageResponse` (built-in), PWA installability via a static manifest + SVG icon,
  keyboard focus ring via a single CSS rule. The dependency surface did not grow.
- **`vercel.json` is present and correct**: `"schedule": "0 3 * * *"` daily at
  03:00 UTC against `/api/admin/reset` — the SPEC §F7 24h auto-reset will register
  automatically on deploy without any additional Vercel UI configuration beyond env
  vars.
- **Per-page title metadata is clean and consistent**: root layout defines a `%s —
  PharmaStock` template; all four pages (`/`, `/expiry`, `/reorder`, `/briefing`)
  export correct, concise `metadata.title` strings. The pattern is right and
  uniform.
- **README "Why no LLM at runtime" section** is the most compelling prose in the
  repo for the target audience (recruiters): it frames the deterministic engine as
  an engineering choice with testability and auditability advantages, not as a
  limitation, and the roadmap positions an optional LLM layer as scoped future work.
  This reads well to a hiring manager asking "where's the AI?"

---

## Functionality-impact flags

- **`metadataBase` (SEV-3 #1)** — adding it requires hardcoding the canonical
  production URL (confirm whether `pharmastock-kit-v2.vercel.app` is the stable
  URL, or if a custom domain has been set). Small decision for Alina before the
  fix lands.
- **CI build step (SEV-3 #3)** — closing the gap means giving CI access to
  Supabase env vars or using dummy placeholders, and updates the documented
  "build requires secrets" decision. Your call; flagged because Phase 3 added
  exactly the class of code this gate doesn't cover.

All other findings (two SEV-2 doc fixes, SVG attribute renaming, heartbeat
comment) are text edits with no scope, architecture, or behavior impact.

---

**One-sentence verdict:** PASS WITH FIXES — Phase 3 app code and config are
correct with no security defects, but `docs/WALKTHROUGH.md` and `README.md`
contain multiple wrong code/file references that must be corrected before this
repo is shown to recruiters.
