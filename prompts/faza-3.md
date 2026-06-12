# Phase 3 — Polish, CI/CD, deploy, presentation

Session type: FRESH Claude Code session. Read `CLAUDE.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, Phase 2 triage report. Target: one weekend (4–6h). Prerequisite: Phase 2 audits triaged.

## Step 1 — Visual polish & responsive (commits per unit)

- Full pass against SPEC.md §4: consistency of spacing, table density, badge colors, chart styling, dark mode parity, focus states, keyboard navigation on forms.
- Mobile: sidebar collapses to a sheet/menu; tables become cards or scroll gracefully; the Briefing page reads well on a phone.
- PWA basics: `manifest.json`, app icons, theme color. No service worker complexity — installability is enough.
- Accessibility: labels on inputs, aria on interactive elements, contrast check. Target Lighthouse Accessibility ≥ 95, Performance ≥ 90 on Dashboard; run Lighthouse and fix what it flags.

## Step 2 — CI/CD + keep-alive (commit: `chore: github actions ci and heartbeat`)

- `.github/workflows/ci.yml`: on push/PR → install, lint, typecheck, test. Add the status badge to README.
- `.github/workflows/heartbeat.yml`: cron every 3 days → `curl` the deployed `/api/health` (URL via repo variable). Purpose: prevents the Supabase free project from pausing after 7 days of inactivity. Document this in DECISIONS.md — it is a deliberate, free-tier-aware ops decision worth mentioning in interviews.

## Step 3 — Deploy (walk Alina through it interactively)

Import the GitHub repo into Vercel; set env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`); confirm the cron registered; run the production smoke test checklist: all pages load, chips work, briefing generates, sandbox CRUD works, reset endpoint rejects without the secret (test with curl), health returns ok. Fix anything that fails. Set a custom OG image + title/description metadata so the link previews well on LinkedIn.

## Step 4 — README + WALKTHROUGH (commits: `docs: readme`, `docs: walkthrough`)

- `README.md`: structure it, but leave the opening paragraph as `<!-- ALINA: write 3-4 sentences in your own voice: why you built this, what it demonstrates -->`. Required sections: demo GIF placeholder at the top, live URL, feature list with screenshot placeholders, architecture diagram (mermaid), tech stack, "Supply chain logic" (the ROP/safety-stock/z-score formulas, written for a hiring manager), "Why no LLM at runtime" (deterministic = exact, testable, auditable, free — and the LLM layer listed as a scoped roadmap item), **"How this was built"** per SPEC.md §5: Claude Code, phased weekend sessions, dual-model audits with reports committed in `docs/audit/`, human-in-the-loop triage. This section is the project's answer to "how do you use AI?". Plus Roadmap (SPEC §6) and local setup instructions.
- `docs/WALKTHROUGH.md`: interview prep for Alina. Explain, in plain English with file references: the data flow from DB to dashboard, how each domain formula works and where it lives, how the briefing rules engine evaluates and why it's snapshot-testable, how anomaly detection works, how the reset cron and heartbeat work, and 10 likely interviewer questions with strong answers grounded in this codebase — including "why didn't you use AI in the product?" and "how did you use AI to build it?".
- Tell Alina exactly how to record the demo GIF (suggest a free tool and a 20-second click script) and which 3 screenshots to take.

## Step 5 — Final wrap-up

Green gates, `docs/audit/SCOPE-phase-3.md`, final audit round reminder. Then produce for Alina (in chat, not in the repo): a one-line CV "Projects" entry, a 2-sentence LinkedIn Featured description, and a 60-second verbal pitch covering both the supply-chain analytics and the disciplined AI-assisted build process.
