# Audit scope — Phase 1

What was built this phase and where the important code lives. For the dual-model
audit (`prompts/audit.md`), run once with Opus and once with Sonnet.

## What was built (F1–F3 + foundation)

- **Scaffold & tooling.** Next.js 16 (App Router) + React 19 + Tailwind v4 + TS
  (strict, `noUncheckedIndexedAccess`). Vitest, ESLint, Prettier, npm scripts.
- **Database.** Schema for `suppliers`, `products`, `batches`, `demand_history`
  with constraints, indexes, and RLS enabled deny-all on every table.
- **Seed.** Idempotent, deterministic (seeded PRNG): 6 suppliers, 40 products, 144
  batches, 3600 demand rows; 3 expired batches, 4 demand anomalies, 3 critical +
  5 reorder products on purpose.
- **Domain layer.** Pure, 100%-tested supply-chain math (FEFO, expiry buckets,
  value at risk, demand stats, safety stock, reorder point, status, order qty).
- **UI.** App shell (sidebar, sandbox banner, dark/light toggle); Dashboard (F1)
  with search/filter/sort + batch detail panel; Expiry risk (F2) KPIs + table;
  Reorder (F3) alerts. Loading skeletons, empty states, error boundary.

## Files that matter most

- `src/lib/domain/` — expiry.ts, reorder.ts, types.ts (+ tests). The core logic.
- `src/lib/db/queries.ts` — fetch + compose view models; paginated reads.
- `src/lib/db/client.ts` — server-only Supabase client (service key).
- `supabase/migrations/20260612120000_initial_schema.sql` — schema + RLS.
- `scripts/seed.ts` — demo data generation.
- `src/components/dashboard/dashboard-view.tsx` — the main interactive client UI.
- `src/app/{page,expiry/page,reorder/page}.tsx` — the three pages.

## Deferred to Phase 2 (not in scope to flag as "missing")

Briefing engine (F4), demand anomaly detection + sparkline (F5), quick-question
chips (F6), sandbox CRUD + auto-reset endpoint (F7), health endpoint (F8).

## Known notes

- The demand sparkline is a deliberate placeholder slot (Phase 2).
- Quality gates green at handoff: `lint`, `typecheck`, `test` (35 tests, 100%
  domain coverage), and `build`.
