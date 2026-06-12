# Phase 2 — Insights engine, demand analytics, sandbox

Session type: FRESH Claude Code session. First read `CLAUDE.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, and the Phase 1 audit triage report in `docs/audit/`. Target: one weekend (4–6h). Build F4, F5, F6, F7, F8. Prerequisite: Phase 1 audits triaged and fixes merged. Reminder: zero LLM/external-AI calls — everything here is deterministic code.

## Pre-flight

1. Confirm `CRON_SECRET` exists in `.env.local` (if missing, give Alina the exact command to generate one — `openssl rand -hex 32` — and wait).
2. Restate the no-LLM rule and the secrets rule from CLAUDE.md.
3. Outline the build order in 5 bullets; wait for "go".

## Step 1 — Demand analytics & anomaly detection, F5 (commits: `feat: demand analytics`, `test: anomaly detection`)

- `src/lib/domain/anomalies.ts`: z-score anomaly detection per SPEC.md §F5 (`|z| > 2.5`, trailing window, min 14 datapoints; guard division-by-zero when σ = 0). Pure functions, exhaustively tested — including the seeded spikes (the tests should find exactly the anomalies the seed planted).
- Product detail: 90-day demand sparkline (recharts), anomalous points visually highlighted. Anomaly badge on dashboard rows.

## Step 2 — Briefing rules engine, F4 (commits: `feat: briefing rules engine`, `test: briefing snapshots`)

- `src/lib/domain/briefing.ts`: a typed rules table per SPEC.md §F4 — each rule = predicate over a metrics snapshot + a sentence template with interpolated real numbers, mapped to a section (Risks / Actions / Watchlist). Engine: compute snapshot → evaluate rules → assemble report object → render.
- Healthy-state path: if no rules fire, an explicit "all clear" summary with the key numbers. Never an empty report.
- Tests: unit tests per rule + snapshot tests of the full briefing against fixed metric inputs (exact text assertable — that's the whole point of deterministic design).
- UI: "Briefing" page with a Generate button, the rendered report, and the expandable "How is this generated?" note explaining the rules-based design.

## Step 3 — Quick questions, F6 (commit: `feat: preset query chips`)

Dashboard chips per SPEC.md §F6, each applying a preconfigured filter/sort state. Pure client-side state + URL params (so each chip's view is shareable/bookmarkable).

## Step 4 — Sandbox CRUD + reset + health, F7 + F8 (commits per unit)

- Add/edit/delete forms for products and batches; all mutations through route handlers with zod validation server-side; meaningful error messages.
- `POST /api/admin/reset`: requires `Authorization: Bearer ${CRON_SECRET}`; reuses the seed logic. `vercel.json` cron entry daily at 03:00 UTC. Document in DECISIONS.md.
- `GET /api/health` per SPEC.md §F8.

## Step 5 — Wrap-up

Same protocol as Phase 1 step 5: green gates, manual verification of F4–F8 against SPEC, DECISIONS.md updated, `docs/audit/SCOPE-phase-2.md` written, final report to Alina + reminder to run audits. Tell the auditors (in the scope file) to pay extra attention to: the math in anomalies/briefing, the reset endpoint guard, and mutation validation.
