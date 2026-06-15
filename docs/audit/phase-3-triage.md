# Triage — Phase 3 — 2026-06-15

Reconciles the two Phase 3 audit reports (`phase-3-opus.md`, `phase-3-sonnet.md`)
into one merged findings table, classifies each into Fix-now / Ask-Alina / Won't-fix,
and records the final status. Both audits returned **PASS WITH FIXES, no SEV-1**.

Decisions confirmed with Alina before fixing: F6 metadataBase → **add**; F7 CI build
step → **keep CI as-is** (documented deliberate decision); bucket A → **go**.

## Merged findings & final status

| # | Finding | Sev | Found by | Bucket | Status |
|---|---------|-----|----------|--------|--------|
| F1 | WALKTHROUGH names domain fns `computeReorderMetrics`/`computeExpiryMetrics` that don't exist | SEV-2 | both | A | **Fixed** @ `76ff941` — corrected to real fns (`demandStats`, `safetyStock`, `reorderPoint`, `daysToExpiry`, `valueAtRisk`, `detectAnomalies`) assembled by private `computeMetrics()` |
| F2 | WALKTHROUGH claims days-to-expiry computed by Postgres (`expiry_date - CURRENT_DATE`) | SEV-2 | both | A | **Fixed** @ `76ff941` — stated it's derived in TS via `daysToExpiry()` |
| F3 | WALKTHROUGH cites type `BriefingSnapshot` "in `types.ts`" | SEV-2 | both | A | **Fixed** @ `76ff941` — renamed to `BriefingInput`, located in `briefing.ts`. (Note: `types.ts` does exist — Sonnet's "doesn't exist" was inaccurate — it just doesn't house this type; file-map link unchanged.) |
| F4 | WALKTHROUGH: `toMatchInlineSnapshot` + "both healthy & all-firing snapshots committed" | SEV-2 | both | A | **Fixed** @ `76ff941` — one `toMatchSnapshot()` (all-rules-firing); healthy state via explicit assertions |
| F4b | WALKTHROUGH rule shape `RULES: BriefingRule[]`, `{ section, check: (snapshot) => string[] }` | SEV-2 | opus (hinted) | A | **Fixed** @ `76ff941` — real shape is `readonly RuleFn[]`, `(input: BriefingInput) => BriefingLine[]`; healthy line appended by engine |
| F5 | README setup points at non-existent `supabase/schema.sql` | SEV-2 | both | A | **Fixed** @ `c93652d` — points at `supabase/migrations/20260612120000_initial_schema.sql` |
| F6 | No `metadataBase` → OG image URL not pinned to production | SEV-3 | both | A (after Alina) | **Fixed** @ `62de9aa` — `metadataBase: https://pharmastock-kit-v2.vercel.app` |
| F8 | OG inline `<svg>` uses kebab-case attrs in JSX | SEV-3 | both | A | **Fixed** @ `62de9aa` — switched to camelCase; no visual change (Satori accepts both) |
| F9 | Heartbeat cron comment overstates "every 3 days" regularity | SEV-3 | both | A | **Fixed** @ `ae8762c` — comment reworded to actual cadence; no behaviour change |
| F7 | CI omits `npm run build` → build-only artifacts (OG route, metadata) unchecked | SEV-3 | both | B → Won't-fix | **Deferred / accepted.** Alina's call: keep CI as lint+typecheck+test. Already a documented deliberate decision in DECISIONS.md (build needs Supabase env); adding it would mean putting Supabase env/placeholders into CI. |

No disputed false positives. The only auditor inaccuracy was Sonnet's claim that
`src/lib/domain/types.ts` doesn't exist (it does); the substantive finding (wrong
type name + wrong home file) was correct and is fixed.

## Tests

No domain-logic bugs were among the findings — all fixes are documentation,
metadata config, and a cosmetic JSX-attribute change. No test additions apply.
The existing suite (76 tests) plus `lint` and `typecheck` all pass after the fixes.

## Verification

`npm run lint`, `npm run typecheck`, `npm run test` → all green (76/76 tests pass).

## Outcome

Phase 3 is **clear**. All SEV-2 documentation defects and the actionable SEV-3 items
are fixed; the one remaining SEV-3 (CI build step) is consciously accepted per Alina's
decision and was already documented. No SEV-1, no open security or correctness issues.
