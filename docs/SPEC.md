# SPEC.md — PharmaStock: Functional Specification (pure-code edition)

Status: locked for MVP. Changes require Alina's explicit approval (see STOP conditions in CLAUDE.md). This app makes **no LLM/AI calls at runtime** — all intelligence is deterministic, rules-based, and unit-tested.

## 1. Purpose

A public demo showing pharma supply-chain analytics. A visitor (recruiter) should, within 60 seconds and with zero instructions: see a credible pharma inventory dashboard, get one-click answers to the questions a supply analyst actually asks, and generate a written supply briefing. The app is a sandbox: visitors may modify data; everything resets automatically every 24h.

## 2. Features (MVP — nothing else)

**F1. Inventory dashboard.** Table of products with: name (INN + strength, e.g. "Amoxicillin 500mg caps"), category, total stock on hand (sum of batch quantities), unit cost, supplier, lead time, cold-chain flag, stock status badge (OK / Reorder / Critical), anomaly flag (see F5). Search by name, filters: category, supplier, cold-chain, status. Sortable columns. Click a product → detail panel with its batches and a 90-day demand sparkline.

**F2. Batch/lot view.** Per product: batch number, quantity, expiry date, days-to-expiry, FEFO rank (consume order = earliest expiry first), expiry badge (>90d green, 31–90d amber, ≤30d red, expired gray). Global "Expiry risk" page: all batches expiring ≤30/60/90 days with **value at risk** = Σ(qty × unit cost) per bucket, shown as headline KPI cards.

**F3. Reorder intelligence.** For each product, computed from seeded demand history:

- avg daily demand `d̄` and std dev `σd` over the last 90 days
- safety stock `SS = 1.65 × σd × √L` (L = supplier lead time in days; 1.65 ≈ 95% service level)
- reorder point `ROP = d̄ × L + SS`
- status: stock ≤ ROP → "Reorder"; stock ≤ SS → "Critical"
  A "Reorder alerts" section lists flagged products with suggested order qty = `d̄ × (L + 30) − stock` (floor 0, rounded to pack size of 10).

**F4. Supply briefing (deterministic rules engine).** Button "Generate briefing" produces a written report — Risks / Actions / Watchlist — assembled entirely by a pure-code rules engine in `src/lib/domain/briefing.ts`. Rules (each producing template sentences with real numbers interpolated):

- value at risk ≤30d above a threshold → risk line naming the top 3 batches by value
- any product at "Critical" → action line with suggested order qty and supplier lead time
- products at "Reorder" → grouped action line
- demand anomalies in last 14 days (F5) → watchlist lines ("demand for X spiked 3.1σ on <date>")
- cold-chain products expiring ≤60d → dedicated risk line
- nothing triggered → an explicit healthy-state summary (never an empty report)
  Rules, thresholds, and sentence templates are data (a typed rules table), so the engine is trivially extensible — and fully unit-tested: given a fixed metrics snapshot, the briefing output is exact and assertable. Render with a "How is this generated?" expandable note explaining it's rule-based, not an LLM (a feature, not an apology: deterministic = auditable).

**F5. Demand analytics & anomaly detection.** Per product: 90-day demand sparkline (recharts). Anomaly detection via z-score on daily demand: `|z| > 2.5` flags an anomaly (computed over the trailing window, min 14 datapoints). Anomalies appear as a badge on the dashboard row, in the product detail chart (highlighted points), and feed the briefing watchlist.

**F6. Quick questions (preset query chips).** On the dashboard, one-click chips that apply preconfigured filter/sort combinations: "Expiring ≤60 days", "Below reorder point", "Cold-chain at risk", "Top value at risk", "Recent demand anomalies". Pure routing + filter state — gives instant answers to the questions an analyst asks daily.

**F7. Sandbox CRUD + auto-reset.** Visitors can add/edit/delete products and batches (simple forms, server-validated with zod). A visible banner: "Demo sandbox — data resets every 24h." Reset: Vercel Cron hits `POST /api/admin/reset` (guarded by `CRON_SECRET` bearer header) which truncates and re-seeds. The seed script is idempotent and also runs locally via `npm run seed`.

**F8. Health endpoint.** `GET /api/health` does a trivial DB read and returns `{ ok: true }`. Used by a GitHub Actions cron (every 3 days) to keep the Supabase free project from pausing.

## 3. Data model (Postgres)

- `suppliers` (id, name, country, lead_time_days)
- `products` (id, name, category, unit_cost numeric, pack_size int default 10, cold_chain bool, supplier_id FK, created_at)
- `batches` (id, product_id FK, batch_number text unique, quantity int ≥0, expiry_date date, received_at)
- `demand_history` (id, product_id FK, date, qty int) — seeded 90 days per product, realistic noise + 3–4 deliberate anomaly spikes (so F5 has something to find)

Seed data: 6 suppliers (EU-flavored invented names, lead times 5–35 days), ~40 products across categories (Antibiotics, Analgesics, Cardiovascular, Vaccines [cold-chain], Oncology [cold-chain], Diabetes, Respiratory, Dermatology), ~150 batches with expiry dates spread from "already expired" (2–3 cases) to +18 months, realistic quantities/costs. All data fictional; no real company names. Deterministic seeded RNG so every reset looks identical.

Supabase Row Level Security: enabled, deny-all. All access goes through server code with the service role key.

## 4. Design system

Tone: calm enterprise dashboard (Linear/Vercel aesthetic), NOT a colorful bootcamp demo. Light + dark mode (system default, toggle). Layout: left sidebar nav (Dashboard, Expiry risk, Reorder, Briefing), topbar with app name + sandbox banner. Typography: Inter via next/font. Color: neutral grays, one accent (deep teal `#0f766e`), semantic green/amber/red only for status badges. Charts: minimal, no gridlines clutter, accent color. Density: comfortable tables, generous whitespace, no gradients, no emoji in UI. Fully responsive — must look intentional on a phone. Loading skeletons for async content; designed empty states.

## 5. The README's "How this was built" story (required content, phase 3)

The repo must document the engineering process: built with Claude Code in phased weekend sessions; every phase independently audited by two different models (Opus + Sonnet) with reports committed in `docs/audit/`; human-in-the-loop triage; and the deliberate decision to keep the runtime LLM-free because the domain math is exact and deterministic code is testable and auditable. This section is the project's answer to "how do you use AI?" — disciplined tooling, not bolted-on features.

## 6. Non-goals (README "Roadmap" section, not built)

Authentication/multi-user, ML forecasting models, optional LLM layer (natural-language queries / generated briefings) as a clearly-scoped future module, e-mail/Slack notifications, Telegram bot, CSV import/export, multi-warehouse. Listing these shows product judgment.

## 7. Quality gates (every phase must pass)

`lint` + `typecheck` + `test` green; no console errors in browser; domain functions ≥ 95% covered; briefing engine output snapshot-tested against fixed inputs; no TODOs left in code; Lighthouse (phase 3): Performance ≥ 90, Accessibility ≥ 95 on the dashboard page.
