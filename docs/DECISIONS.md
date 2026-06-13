# Decisions Journal

One line per non-trivial technical decision: date — decision — why.

## Phase 1

- 2026-06-12 — Stack pinned by scaffold: Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript strict. — Latest `create-next-app` defaults; matches the fixed stack in CLAUDE.md.
- 2026-06-12 — Enabled `noUncheckedIndexedAccess` and `noImplicitOverride` on top of `strict`. — Domain layer does array/index math (FEFO, demand windows); forcing undefined-checks at indices prevents a whole class of bugs and raises the code-quality bar.
- 2026-06-12 — Dark mode via class-based `@custom-variant dark` + a pre-paint inline script reading `localStorage`/`prefers-color-scheme`. — SPEC §4 wants system default + manual toggle without a flash of the wrong theme; Tailwind v4 defaults to media-query dark mode which can't be toggled.
- 2026-06-12 — Secret server key stored under env name `SUPABASE_SERVICE_ROLE_KEY` even though the value is a new-format `sb_secret_…` key. — Keeps code/docs consistent with CLAUDE.md/SPEC naming; the new secret key fills the same server-only role.
- 2026-06-12 — `vitest` configured with `passWithNoTests: true` and 95% coverage thresholds scoped to `src/lib/domain/**`. — Lets the gate pass before Step 3 lands tests, while enforcing SPEC §7's ≥95% domain coverage once they exist.
- 2026-06-12 — `tsx` chosen to run `scripts/seed.ts` via `npm run seed`. — Zero-config TypeScript execution for a Node script without adding a build step.
- 2026-06-12 — `SETUP-ALINA.md` and `.claude/settings.local.json` added to `.gitignore`. — Private run-book and per-developer editor settings must not reach the public portfolio repo.
- 2026-06-12 — Server DB client isolated in `src/lib/db/client.ts` and guarded with the `server-only` package. — Makes any accidental import into a client bundle a build error, hard-enforcing Architecture Rule 1 (service key never reaches the browser).
- 2026-06-12 — All Supabase reads paginate via `.range()` over a stable `.order()`. — PostgREST caps a response at 1000 rows; demand_history (~3600 rows) was silently truncated, zeroing most products' demand stats. Pagination is correct regardless of the server cap.
- 2026-06-12 — Seed computes each product's safety stock / reorder point (via the domain layer) and sizes stock to force a deliberate status spread (3 critical, 5 reorder, rest OK). — A demo where everything is "OK" hides the reorder feature; reusing the domain math guarantees the seeded statuses are correct.
- 2026-06-12 — Data pages use `export const dynamic = 'force-dynamic'`. — The sandbox data changes (edits, 24h reset), so pages must render per request rather than be statically cached.
- 2026-06-12 — `valueAtRisk(batches, horizon)` includes already-expired stock and is cumulative (days ≤ horizon). — "Value at risk within N days" should capture the worst case (already-expired) and nest naturally for the ≤30/≤60/≤90 KPI cards; pinned by unit tests.
- 2026-06-12 — Demand stats use the sample standard deviation (n−1), 0 for fewer than two points. — Standard estimator for demand variability feeding safety stock and (Phase 2) z-score anomaly detection; the guard handles the single-/zero-point boundaries cleanly.
- 2026-06-13 — `suggestedOrderQty` rounds UP (Math.ceil) to the nearest pack size, not to nearest-integer. — Ordering a partial pack is not possible in practice; ceiling ensures the order clears the reorder point.
