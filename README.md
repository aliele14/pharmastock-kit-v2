# PharmaStock

A pharmaceutical inventory tracker with serious supply-chain analytics: batch/lot tracking,
FEFO expiry risk, reorder intelligence, demand anomaly detection, and a deterministic
rules-based supply briefing.

**Design decision: zero AI/LLM calls at runtime.** All "insights" come from pure, unit-tested
rules in the domain layer (`src/lib/domain/`). Deterministic means auditable.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Postgres (Supabase, server-side
only) · Vitest · ESLint + Prettier · Deployed on Vercel.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Create a `.env.local` (never committed) with:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

## Scripts

| Script              | Purpose                         |
| ------------------- | ------------------------------- |
| `npm run dev`       | Local dev server                |
| `npm run build`     | Production build                |
| `npm run test`      | Vitest (run once)               |
| `npm run coverage`  | Vitest with coverage            |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | `tsc --noEmit`                  |
| `npm run seed`      | Idempotent demo data seed/reset |

## Project status

Built in phased weekend sessions, each independently audited. See `docs/SPEC.md` for the full
functional specification and `docs/DECISIONS.md` for the engineering decisions journal.
