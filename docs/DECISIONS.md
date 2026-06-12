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
