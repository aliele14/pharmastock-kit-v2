# Phase 1 — Foundation: scaffold, database, seed data, inventory dashboard

Session type: FRESH Claude Code session. First read `CLAUDE.md` and `docs/SPEC.md` in full. Target effort: one weekend (4–6h). Build features F1, F2, F3 and the domain layer. Briefing engine and analytics come in Phase 2.

## Pre-flight (do this first, report findings before writing code)

1. Confirm `.env.local` exists with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and that `.gitignore` covers `.env*`.
2. Confirm Node and npm versions are workable.
3. Restate in 5 bullets what you will build this phase and the order. Wait for Alina's "go" before scaffolding.

## Step 1 — Scaffold (commit: `chore: scaffold next.js app`)

`create-next-app` with TypeScript, App Router, Tailwind, ESLint, src dir. Add: Prettier config, Vitest setup, `lucide-react`, `zod`, `recharts`, `@supabase/supabase-js`. Add npm scripts per CLAUDE.md (`typecheck`, `seed`). Strict TypeScript. Remove all boilerplate content.

## Step 2 — Database & seed (commits: `feat: database schema`, `feat: seed script`)

- Write the schema per SPEC.md §3 as a SQL migration file in `supabase/migrations/`, including RLS enable + deny-all policies, and apply it (walk Alina through running it in the Supabase SQL editor if no CLI access).
- `scripts/seed.ts` (run via `npm run seed`): idempotent — truncates and inserts the full demo dataset per SPEC.md §3. Deterministic seeded RNG. Include 2–3 already-expired batches and 3–4 demand anomaly spikes on purpose (Phase 2's anomaly detection must have real material to find).

## Step 3 — Domain layer (commit: `feat: supply chain domain logic` + `test: domain logic`)

Pure functions in `src/lib/domain/`: `daysToExpiry`, `expiryBucket`, `fefoRank`, `valueAtRisk(batches, horizonDays)`, `demandStats(history)` (mean, std dev), `safetyStock`, `reorderPoint`, `stockStatus`, `suggestedOrderQty`. Vitest tests covering normal cases, boundaries (expiry today, zero demand, zero stock, single data point), and the exact formulas from SPEC.md §F3. This is the most interview-relevant code in the project — make it exemplary and well-named.

## Step 4 — Data access + dashboard UI (commits per logical unit)

- Thin data-access layer in `src/lib/db/` (server-only) returning typed rows.
- App shell per SPEC.md §4: sidebar, topbar, sandbox banner, dark/light toggle.
- Pages: Dashboard (F1 product table with search/filters/sort + product detail panel with batches F2 — sparkline placeholder slot for Phase 2), Expiry risk (F2 KPI cards + batch table), Reorder (F3 alerts list). Server components for data, client components only where interactivity requires it.
- Loading skeletons and designed empty states.

## Step 5 — Wrap-up

- Run `lint`, `typecheck`, `test` — all green. Manually verify the three pages against SPEC.md and list any deviations.
- Update `docs/DECISIONS.md` with decisions made this phase.
- Write `docs/audit/SCOPE-phase-1.md`: a 10-line summary of what was built and which files matter, for the auditors.
- Final report to Alina: what's done, what's deferred, anything that triggered a STOP condition, and remind her to run the audit protocol (`prompts/audit.md`) before Phase 2.

Throughout: respect every rule in CLAUDE.md, especially STOP conditions, the no-LLM rule, and commit discipline.
