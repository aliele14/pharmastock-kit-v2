# Audit — Phase 3 — Opus — 2026-06-15

## Verdict: PASS WITH FIXES

Phase 3 (polish, PWA, CI/CD, deploy prep, docs) introduces no runtime code that
violates a security or correctness invariant. There are **no SEV-1 findings**.
The defects are concentrated in the documentation deliverables — most importantly
`docs/WALKTHROUGH.md`, which is interview-prep material Alina is meant to quote
verbatim and which currently cites functions, types, and test mechanisms that do
not exist in the codebase. Those are real, verifiable errors and are worth fixing
before this repo is shown to a hiring manager.

Scope audited: `757c5df..HEAD` (commits `6b12b1a` → `63d6c94`) — CI/heartbeat
workflows, PWA manifest/icon, OG image, metadata, focus styles, README, WALKTHROUGH,
SCOPE-phase-3, DECISIONS. Plus the deploy-checklist touchpoints (`vercel.json`,
`/api/health`, `/api/admin/reset`) since they are explicit Phase 3 smoke-test items.

---

## Findings

### [SEV-1 Critical]
None. No secrets reach the client, no LLM/AI SDK is present anywhere, the reset
endpoint is bearer-guarded on both GET and POST, and the heartbeat/CI workflows
contain no injectable secrets. Explicitly: nothing in this category.

---

### [SEV-2 Major] WALKTHROUGH.md cites code that does not exist
`docs/WALKTHROUGH.md` — this is the interview-prep doc; every claim in it should be
checkable by opening the named file during a call. Several are not:

- **Line 22** — names domain functions `computeReorderMetrics`, `computeExpiryMetrics`,
  `hasRecentAnomaly`. Only `hasRecentAnomaly` exists. The real pipeline in
  `src/lib/db/queries.ts:119-121,216,314` uses `demandStats`, `safetyStock`,
  `reorderPoint`, `detectAnomalies`, `valueAtRisk` — there is no `compute*Metrics`
  function anywhere in `src/` (verified by grep, no matches).
- **Line 21** — claims days-to-expiry is "computed by Postgres as
  `expiry_date - CURRENT_DATE`". It is not: expiry is computed in TypeScript via
  `daysToExpiry(b.expiry_date, asOf)` (`src/lib/db/queries.ts:152,235,241,327,374`).
  The query selects the raw `expiry_date` column only.
- **Lines 74-84** — describes the briefing rule input type as `BriefingSnapshot`
  "in `src/lib/domain/types.ts`". The actual type is `BriefingInput`, exported from
  `src/lib/domain/briefing.ts` and consumed as such in
  `src/app/briefing/actions.ts:7` and `briefing.test.ts:6`. `BriefingSnapshot` does
  not exist (grep: no matches). The rule shape `{ section, check: (snapshot) => string[] }`
  should also be verified against the real `BriefingRule` definition.
- **Lines 90, 94** — claims snapshot tests use `toMatchInlineSnapshot` and that
  "the snapshot for the full healthy report and the snapshot for a report with all
  five rules firing are both committed." Reality (`src/lib/domain/briefing.test.ts`):
  a single `toMatchSnapshot()` at line 373 covers only the full all-rules-firing
  report; the healthy state is verified with explicit assertions (lines 34-56), not
  a snapshot. So "both committed as snapshots" and "`toMatchInlineSnapshot`" are
  both wrong.

Why it matters: this document's entire value is that it is grounded in the real
code. An interviewer who asks Alina to "show me `computeReorderMetrics`" or "open
`BriefingSnapshot`" will find nothing, which undercuts the credibility the doc is
meant to build.

Suggested fix (described, not applied): correct the function names to the ones
actually in `queries.ts`/`domain`; state that days-to-expiry is computed in the
domain layer, not Postgres; rename `BriefingSnapshot` → `BriefingInput` and point to
`briefing.ts`; reword the snapshot section to "one committed snapshot of the full
report; healthy state covered by assertions" and fix `toMatchInlineSnapshot` →
`toMatchSnapshot`.

### [SEV-2 Major] README local-setup points at a non-existent schema file
`README.md:226` — "apply `supabase/schema.sql` in the Supabase SQL editor". That
path does not exist. The actual schema is
`supabase/migrations/20260612120000_initial_schema.sql` (the only `.sql` file in the
repo; there is no `supabase/schema.sql`). A recruiter cloning the repo and following
the documented setup will not find the file and cannot create the tables, so
`npm run seed` will fail.

Suggested fix: reference the real migration path, or add a stable
`supabase/schema.sql` and keep it in sync.

---

### [SEV-3 Minor] No `metadataBase` set — OG image URL is not pinned to production
`src/app/layout.tsx:11-27` defines `openGraph` and `src/app/opengraph-image.tsx`
generates the card, but no `metadataBase` is configured anywhere (grep: no matches).
Without it, Next.js resolves the absolute `og:image` URL against `http://localhost:3000`
in plain builds, and on Vercel against the per-deployment `VERCEL_URL` (a preview-style
hostname) rather than the stable `https://pharmastock-kit-v2.vercel.app`. Step 3's
stated goal is "so the link previews well on LinkedIn"; a non-pinned/localhost base
makes that fragile. Fix: set `metadataBase: new URL('https://pharmastock-kit-v2.vercel.app')`
in the root metadata. (Behavior-affecting for link previews — see flags below.)

### [SEV-3 Minor] CI gate omits `npm run build`
`.github/workflows/ci.yml` runs lint + typecheck + test only (a deliberate,
documented choice — `docs/DECISIONS.md` Phase 3, build needs Supabase env). The gap:
the Phase 3 additions that are *build-time only* — the `opengraph-image.tsx` edge
route, metadata resolution, the manifest wiring — are not exercised by lint, tsc, or
Vitest. A regression there (e.g. an OG render error, a bad `metadataBase`) ships
silently. Worth noting since this phase added exactly that class of code. Options for
Alina: add a `build` job with placeholder env vars, or accept the gap consciously.

### [SEV-3 Minor] OG SVG uses kebab-case SVG attributes in JSX
`src/app/opengraph-image.tsx:38-42` uses `stroke-width`, `stroke-linecap`,
`stroke-linejoin` on the inline `<svg>`. Satori (next/og) tolerates these, and
typecheck passes, but it's inconsistent with React's camelCase convention used
elsewhere. Cosmetic; switch to `strokeWidth` etc. for consistency.

### [SEV-3 Minor] Heartbeat cron cadence drifts at month boundaries
`.github/workflows/heartbeat.yml` — `cron: '0 8 */3 * *'` restarts the day-of-month
count each month (1, 4, 7 … 28, 31, then 1), so the interval is not a strict 3 days
across the month boundary. This is harmless: the worst-case gap is still well under
the 7-day Supabase pause window, so the stated purpose is met. Note only; the inline
comment slightly overstates the regularity ("every 3 days (1st, 4th, 7th …)").

---

## What is genuinely good

- **Reset endpoint is correctly guarded** (`src/app/api/admin/reset/route.ts:266-292`):
  constant `Bearer ${CRON_SECRET}` check, `Boolean(cronSecret)` guard so a missing
  env var can't auth an empty token, applied to both GET (Vercel cron) and POST
  (manual), with error handling that surfaces a message and a 500 — no swallowed
  failures.
- **Zero new dependencies for OG and PWA**: `next/og` `ImageResponse` and a static
  manifest/SVG icon deliver social previews and installability without bloating the
  bundle — squarely matches CLAUDE.md's "simplicity wins" / no-new-deps stance, and
  the SVG-only icon trade-off is honestly documented in DECISIONS.
- **No-AI invariant fully respected**: nothing added in Phase 3 introduces an LLM SDK
  or external AI call; the README's "Why no LLM at runtime" section frames the
  deterministic engine as a feature, consistent with SPEC §F4/§5.
- **`vercel.json` cron is real and correct** (`0 3 * * *` → `/api/admin/reset`),
  so the SPEC §F7 24h auto-reset will actually register on deploy — the smoke-test
  item is backed by config, not just prose.
- **Focus-visible accessibility rule** (`src/app/globals.css`) is the right, minimal
  way to satisfy keyboard-nav focus rings without per-component noise; metadata title
  template + per-page titles are clean and consistent across all four pages.

---

## Functionality-impact flags (for Alina)

- **`metadataBase` (SEV-3 #1)** — adding it changes the user-facing OG/LinkedIn
  preview URL behavior. It needs the production domain hard-coded, so it's a small
  decision for you (confirm the canonical URL) rather than a free mechanical fix.
- **CI `build` step (SEV-3 #2)** — closing this gap means giving CI access to
  Supabase env vars (or placeholders), which touches the documented "no build in CI"
  decision and the security posture around where the service key lives. Your call;
  I'm flagging it, not changing it.

Everything else (the two SEV-2 doc fixes, the SVG attributes, the heartbeat comment)
is text/config correction with no scope or architecture impact.

---

**One-sentence verdict:** PASS WITH FIXES — the Phase 3 app code and config are
sound with no security or correctness defects, but the WALKTHROUGH and README contain
several verifiably wrong code/file references that should be corrected before the
repo is shown to recruiters.
