# CLAUDE.md — PharmaStock (Project Memory)

This file is read at the start of EVERY Claude Code session. It is the single source of truth for conventions and rules. The full functional specification lives in `docs/SPEC.md` — read it before any implementation work.

## What this project is

A portfolio web app for Alina (Product Supply Analyst pivoting to pharma supply chain / data roles). Public demo on Vercel. A pharmaceutical inventory tracker with serious supply-chain analytics: batch/lot tracking, FEFO expiry risk, reorder intelligence, demand anomaly detection, and a deterministic rules-based supply briefing.

**Deliberate design decision: zero AI/LLM calls at runtime.** The product is pure, testable, deterministic code. AI (Claude Code) is used only as the engineering tool to build it, under a dual-model audit protocol — and that build process is itself documented in the README as a showcase of disciplined AI-assisted development.

Audience: recruiters and hiring managers who will click a link from a CV/LinkedIn. The bar is: code a senior software engineer would be proud of. Clean and correct, never over-engineered.

## Stack (fixed — do not substitute)

- Next.js (App Router) + TypeScript (strict mode) + Tailwind CSS
- Postgres on Supabase (server-side access only, via route handlers / server components)
- Vitest for tests, ESLint + Prettier, GitHub Actions for CI
- Deployed on Vercel (Hobby). Icons: lucide-react. Charts: recharts (sparklines/trends only). No other UI libraries, no LLM SDKs.

## Commands

- `npm run dev` — local dev server
- `npm run test` — Vitest
- `npm run lint` — ESLint
- `npm run typecheck` — tsc --noEmit
- `npm run seed` — idempotent seed/reset of demo data

## Architecture rules

1. **Secrets never leave the server.** `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are used only in server-side code, read from env vars. No Supabase client in browser code. `.env*` files are gitignored — verify before every commit.
2. **No LLM calls, no external AI services, anywhere in the app.** All "insights" come from deterministic, unit-tested rules in the domain layer. If a feature seems to need an LLM, that's a STOP condition — report to Alina.
3. **Domain logic is pure and tested.** All supply-chain math (FEFO ordering, days-to-expiry, value-at-risk, safety stock, reorder point, z-score anomaly detection, briefing rules) lives in pure functions under `src/lib/domain/`, fully covered by Vitest. UI components contain no business math.
4. **Errors are handled, not swallowed.** Every external call (DB) has explicit error handling and a meaningful user-facing message. No empty catch blocks.
5. **Simplicity wins.** No premature abstraction, no unused dependencies, no dead code, no clever one-liners that need a comment to decode. If a feature can be 50 lines instead of 200, it is 50 lines.

## Workflow rules

- **Commits:** small, per logical unit, Conventional Commits format (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). Run `npm run lint && npm run typecheck && npm run test` before every commit. Never one giant commit.
- **Decisions journal:** any non-trivial technical decision gets one line in `docs/DECISIONS.md` (date, decision, why).
- **Tests are written during the phase, not after.** New domain logic or API route = tests in the same commit.
- **Language:** all code, comments, UI copy, and docs in English.

## STOP conditions (mandatory)

Stop work and report to Alina in plain language — do NOT decide alone — when:

1. A problem requires changing functionality, scope, or architecture vs. `docs/SPEC.md`.
2. A fix would add a paid service, an external API, or a new dependency of significance.
3. Two reasonable approaches exist with different user-facing behavior.
4. Anything would weaken a security rule above, even temporarily.

When stopping: state the problem, the options, your recommendation, and wait.

## Phase protocol

Work happens in phases (`prompts/faza-1.md` … `faza-3.md`), each in a FRESH session. After each phase: audits run in separate sessions using `prompts/audit.md` (once with Opus, once with Sonnet), then fixes via `prompts/triage.md`. Audit sessions are read-only for code.
