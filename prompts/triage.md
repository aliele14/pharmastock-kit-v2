# Triage prompt — reconcile audits and fix

Session type: FRESH session, after both audit reports for phase N exist. Read `CLAUDE.md`, `docs/SPEC.md`, then BOTH reports in `docs/audit/phase-N-*.md`.

## Step 1 — Reconcile

Build one merged findings table: finding, severity (take the higher if the two auditors disagree), found-by (opus/sonnet/both), and your own one-line assessment — auditors can be wrong; if you believe a finding is a false positive, say why and mark it `disputed` instead of silently dropping it.

## Step 2 — Classify into exactly three buckets

- **A. Fix now:** clear-cut fixes that do NOT change user-facing behavior, scope, or architecture (bugs, missing validation, error handling, test gaps, naming, dead code).
- **B. Ask Alina (STOP):** anything flagged as functionality-impact by an auditor, anything in bucket A you're unsure about, any fix touching SPEC.md behavior, security trade-offs, or new dependencies. Per CLAUDE.md STOP conditions: present problem → options → recommendation, then WAIT. Do not pre-implement.
- **C. Won't fix:** disputed false positives and SEV-3 items not worth the churn — each with one line of justification.

Present this classification to Alina BEFORE fixing anything. Proceed with bucket A only after her "go" (she may move items between buckets).

## Step 3 — Fix bucket A

One commit per finding or tight group (`fix: <finding> (audit phase N)`). Add or adjust tests so each fixed bug has a test that would have caught it. After all fixes: `lint`, `typecheck`, `test` green; quick manual smoke of affected screens/endpoints.

## Step 4 — Close out

Write `docs/audit/phase-N-triage.md`: the merged table with final status per finding (fixed @ commit / deferred to Alina / won't fix + reason). Summarize for Alina in chat: what was fixed, what awaits her decision, and whether the phase is now clear for the next one.
