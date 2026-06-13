# PharmaStock — Interview Walkthrough

Prepared for Alina. This document explains the technical choices behind the project and gives you strong, specific answers to the questions interviewers actually ask. All references point to real file paths so you can open the code during a call.

---

## Data flow: DB → server → UI

```
Postgres (Supabase)
  └─ src/lib/db/client.ts          server-only guarded client
       └─ src/lib/db/queries.ts    typed query functions (getDashboardData, getExpiryRisk, …)
            └─ src/lib/domain/     pure functions — compute metrics from raw DB rows
                 └─ Server Components (src/app/**/page.tsx)
                      └─ Client Components (src/components/**/)
```

### Step by step for the dashboard

1. `src/app/page.tsx` is a React Server Component. On each request (the page is `force-dynamic` — no caching), it calls `getDashboardData()` and `getSuppliers()` in parallel.
2. `getDashboardData()` in `src/lib/db/queries.ts` fetches all products, batches (with expiry computed by Postgres as `expiry_date - CURRENT_DATE`), and demand history (paginated with `.range()` to bypass Supabase's 1000-row default cap).
3. Domain functions — `computeReorderMetrics`, `computeExpiryMetrics`, `hasRecentAnomaly`, etc. — transform the raw rows into typed `ProductMetrics` objects. All the supply-chain math happens here, in pure functions.
4. The resulting data is passed as props to `DashboardView`, a client component that owns all the interactive state (search, sort, chip, selected product).
5. When the user edits or deletes a product, the client component calls the appropriate API route handler, then calls `router.refresh()` to re-run step 1.

**Why Server Components for the data fetch?**
The `SUPABASE_SERVICE_ROLE_KEY` must never reach the browser. The `server-only` package in `src/lib/db/client.ts` turns any accidental client import into a build error. Server Components fetch data on the server and pass plain serialisable props down — no secrets, no Supabase client, no auth token in the browser bundle.

---

## Domain formulas — what they are and where they live

All files in `src/lib/domain/` are pure TypeScript functions with no imports from the DB or framework layer. They can be tested in isolation with Vitest (and are).

### Safety stock & reorder point (`src/lib/domain/reorder.ts`)

```
d̄  = mean daily demand (rolling 90-day window)
σd = sample standard deviation (n − 1)
L  = supplier lead time in days (from suppliers table)

SS  = 1.65 × σd × √L        safety stock at 95% service level
ROP = d̄ × L + SS            reorder point
```

The 1.65 comes from the inverse normal CDF at 95% — it means that 95% of the time, demand during the lead-time period will be covered by ROP stock. If an interviewer asks "why 1.65?", that's your answer.

`suggestedOrderQty` uses `Math.ceil` to round UP to the nearest pack size (e.g. 10s). Ordering a partial pack isn't possible in practice.

### FEFO ranking (`src/lib/domain/expiry.ts`)

FEFO = First Expired, First Out. Batches are ranked by ascending expiry date. The function assigns a `fefoRank` integer starting at 1. The batch with rank 1 should be consumed next.

`valueAtRisk(batches, horizon)` sums `quantity × unit_cost` for all future-expiring batches within `horizon` days. Already-expired batches are excluded — they're sunk loss.

### Anomaly detection (`src/lib/domain/anomalies.ts`)

```
For a product's demand history (last 90 days):
  μ = mean(qty)
  σ = sample std dev(qty)     — requires ≥ 2 datapoints
  z = (qty - μ) / σ           — for each day

  |z| > 2.5  → anomaly
  σ = 0      → return []   (constant demand, no anomalies possible)
```

Minimum 14 datapoints to compute anomalies — below that, std dev estimates are unreliable and the threshold would produce false positives on normal variation.

`hasRecentAnomaly(anomalies, asOfDate)` checks whether any anomaly falls within the last 14 days of `asOfDate` — this is the badge shown on the dashboard row.

### Briefing rules engine (`src/lib/domain/briefing.ts`)

Five rules defined as a typed array `RULES: BriefingRule[]`. Each rule is:
```typescript
{
  section: 'Risks' | 'Actions' | 'Watchlist',
  check: (snapshot: BriefingSnapshot) => string[]   // returns 0+ sentences
}
```

The engine calls every rule, collects the sentences, and wraps them in a `BriefingReport`. If all rules return empty arrays, the healthy-state rule fires instead.

The `BriefingSnapshot` type in `src/lib/domain/types.ts` is the only input. Given the same snapshot, the same report is produced — the briefing is snapshot-tested in `briefing.test.ts` with a hardcoded fixture.

---

## Briefing: why snapshot tests are the right tool here

Snapshot tests (`toMatchInlineSnapshot`) capture the exact string output of the briefing engine against a fixed `BriefingSnapshot`. When you change a rule or template, the test fails and shows you the diff. You approve the new snapshot, and the test updates.

This is better than asserting "the report contains the word 'Amoxicillin'" because it catches regressions in any rule, not just the one you thought to test.

See `src/lib/domain/briefing.test.ts` — the snapshot for the full healthy report and the snapshot for a report with all five rules firing are both committed.

---

## The reset cron: how it works

Vercel Cron sends `GET /api/admin/reset` every 24h with an `Authorization: Bearer <CRON_SECRET>` header. The route handler:

1. Validates the header (returns 401 if wrong or missing).
2. Runs the full seed inside a sequential set of `DELETE` + `INSERT` calls — same Mulberry32 PRNG with seed `0x50484152` that the dev seed script uses, so every reset looks identical.
3. Returns `{ ok: true, reset: true }`.

The route also accepts `POST` for manual triggers (e.g., `curl -X POST -H "Authorization: Bearer $SECRET" $URL/api/admin/reset`).

**Why is the seed logic duplicated in the route handler?**
The `scripts/seed.ts` file calls `dotenv/config` and resolves the `.env.local` file path for the local dev environment. Importing it into a Next.js route handler would fail at runtime because the path resolution is different on Vercel. Duplicating the logic (same PRNG, same data) is simpler and more robust. See `docs/DECISIONS.md`.

---

## How the heartbeat prevents Supabase from pausing

Supabase free-tier projects pause after 7 days of inactivity. The GitHub Actions heartbeat (`/.github/workflows/heartbeat.yml`) pings `GET /api/health` every 3 days. The health endpoint does a trivial `SELECT 1` against the DB. Supabase counts this as activity, so the project never pauses.

Cost: zero. The workflow runs on GitHub's free tier for public repos. Setup requires one GitHub Actions repository variable: `PRODUCTION_URL` (the Vercel deployment URL).

---

## Deploy checklist (Vercel)

Run through this once after your first push to GitHub:

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `pharmastock-kit-v2` from GitHub.
2. Vercel detects Next.js automatically. No build config changes needed.
3. In **Environment Variables**, add:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role key (not the anon key)
   - `CRON_SECRET` — any random secret you choose (e.g., `openssl rand -hex 32`)
4. Click **Deploy**. After the build succeeds, open the deployment URL.
5. In Vercel **Settings → Cron Jobs**, confirm the reset cron is registered (it comes from `vercel.json` if present, or from the Next.js config — you may need to add the cron entry).
6. Smoke test checklist:
   - [ ] All four nav pages load without errors
   - [ ] Dashboard shows ~40 products with status badges
   - [ ] Clicking a product opens the detail panel with batches and a sparkline
   - [ ] All five quick-question chips filter and sort correctly
   - [ ] Expiry risk page shows KPI cards and a batch table
   - [ ] Reorder page lists flagged products with suggested order quantities
   - [ ] Briefing generates a non-empty report with Risks / Actions / Watchlist
   - [ ] Add a product via the CRUD form → product appears in table
   - [ ] Edit and delete the product → changes reflect immediately
   - [ ] `curl $URL/api/health` returns `{"ok":true}`
   - [ ] `curl -X POST $URL/api/admin/reset` (no auth) returns 401
   - [ ] `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/admin/reset` returns `{"ok":true,"reset":true}`
7. After confirming the deployment URL, add it as a GitHub Actions repository variable `PRODUCTION_URL` (Settings → Secrets and variables → Actions → Variables).
8. Update the live URL in `README.md` and push.

---

## Recording the demo GIF

**Recommended tool:** [ScreenToGif](https://www.screentogif.com/) (Windows, free) or [Kap](https://getkap.co/) (macOS, free).

**Click script (≈ 20 seconds at 1280 × 800):**

1. Start on the Dashboard — let the table load (2s)
2. Click the "Below reorder point" chip — table filters to 8 products (2s)
3. Click a Critical product row — detail panel opens with sparkline (2s)
4. Close the panel (1s)
5. Click "Expiry risk" in the nav — KPI cards + batch table (2s)
6. Click "Reorder" in the nav — card grid of flagged products (2s)
7. Click "Briefing" in the nav — click "Generate briefing" — report appears (4s)
8. Expand "How is this generated?" — show the explanation panel (3s)

Aim for 1280 × 800 or 1440 × 900. Keep it under 5 MB. Export as GIF (ScreenToGif) or convert with `ffmpeg -i demo.mp4 -vf "fps=10,scale=1280:-1" demo.gif`.

**Three screenshots to take:**

1. **Dashboard** — with the "Below reorder point" chip active and a product selected in the detail panel.
2. **Expiry risk** — KPI cards visible at the top.
3. **Briefing** — a generated report with all three sections (Risks, Actions, Watchlist).

---

## 10 interviewer questions with strong answers

### 1. "Walk me through what this app does."

"PharmaStock is a supply-chain analytics dashboard for a fictional pharma inventory. It solves the core questions a supply analyst asks every day: what's expiring and what's the financial exposure? What needs to be reordered and how much? Are there any unusual demand spikes I should investigate? And can I get a written summary I can put in a Monday morning briefing?

The app covers all four: an expiry risk page with value-at-risk bucketed by horizon, a reorder page with ROP-based alerts and suggested order quantities, z-score anomaly detection on demand history, and a one-click briefing that a deterministic rules engine assembles. It's a sandbox — visitors can add and edit anything, and a cron job resets it every 24 hours."

### 2. "Why no AI at runtime?"

"The questions this app answers have exact, well-defined answers. Reorder point is a formula: `ROP = d̄ × L + SS`. Safety stock is a formula. Value at risk is a sum. Z-score anomaly detection is a formula. If you use an LLM to compute these, you get an approximation that changes between runs, can't be unit-tested, costs money per inference, and can hallucinate a number. The deterministic approach is exact, fully covered by Vitest, produces the same output every time, and costs nothing to run.

AI (Claude Code) was used heavily as the *engineering tool* — writing code, auditing it, catching bugs. But the product's intelligence is pure math. If someone asks me 'why did the briefing say to order 200 units of Amoxicillin?', I can point to a line in `briefing.ts` and `reorder.ts` and show exactly how that number was computed."

### 3. "How does the reorder point calculation work?"

"It follows the standard safety-stock formula for a 95% service level. I compute the mean daily demand `d̄` and the sample standard deviation `σd` over the trailing 90 days. Safety stock is `SS = 1.65 × σd × √L` where L is the supplier's lead time in days and 1.65 is the inverse normal CDF at 95% — meaning 95% of the time, demand during the lead-time period will be covered. The reorder point is `d̄ × L + SS`.

The suggested order quantity is `ceil((d̄ × (L + 30) − stock) / pack_size) × pack_size` — I use ceiling so we always order whole packs, not fractions.

All of this is in `src/lib/domain/reorder.ts` with 18 unit tests covering edge cases like zero demand, single datapoint, and fractional pack sizes."

### 4. "What is FEFO and why does it matter in pharma?"

"FEFO stands for First Expired, First Out — the pharma equivalent of retail's FIFO. In food or pharma, you don't want to issue the newest stock first and let the oldest batch expire on the shelf. FEFO ensures you always consume the batch with the nearest expiry date first.

In the app, each product's batches are ranked by ascending expiry date (`fefoRank` 1 = consume first). The batch list in the detail panel shows this rank. The expiry risk page shows all batches within 90 days grouped by horizon, and the value-at-risk number tells you the financial exposure if you fail to consume or return them in time."

### 5. "How does anomaly detection work?"

"Z-score detection on daily demand. For each product, I compute the mean and sample standard deviation of its daily demand over the 90-day window. For each day, the z-score is `(qty − mean) / std_dev`. If the absolute z-score exceeds 2.5, that day is flagged as an anomaly.

The seed data has deliberate anomaly spikes built in — 3 or 4 per product — so the feature has something to find on the demo.

The threshold (2.5σ, ≈ 99th percentile) was chosen to balance sensitivity against false positives on sparse data. I require at least 14 datapoints before computing anomalies; below that, the standard deviation estimate is unreliable. If σ is 0 (constant demand), I return no anomalies rather than dividing by zero."

### 6. "How did you use AI to build this?"

"I used Claude Code — Anthropic's CLI — as the engineering tool throughout. The build was structured into three phases: data model and DB layer first, then the analytics features and CRUD, then polish and documentation. Each phase ended with two independent audit sessions using different Claude models (Opus and Sonnet) running against the same checklist. The audit reports are committed in `docs/audit/` — you can read them.

The audits found real bugs: the Vercel cron only issues GET requests, but the reset route only had POST; a Dialog component was missing an Escape handler and ARIA attributes; the chip sort order was wrong. Each finding was triaged by me, and I decided what to fix, what to defer, and what to reject. No AI wrote code without my explicit decision.

The key discipline: every non-trivial technical decision is in `docs/DECISIONS.md` with a rationale. If an AI assistant suggested an approach I didn't understand, I stopped and asked for an explanation before accepting it."

### 7. "What would you add if you had more time?"

"Planned roadmap in the README. In order of value:

First, an ML demand forecast — ARIMA or a simple exponential smoothing model — would improve the suggested order quantities beyond the rolling-average approach. Right now `d̄` is the past 90-day mean; a forecast that trends seasonality would be more accurate.

Second, an LLM layer for natural-language queries: 'show me everything expiring this month' as free text rather than chip filters. This would sit on top of the deterministic engine, not replace it — the LLM would translate the query into filter parameters, and the rule engine would compute the answer.

Third, email or Slack notifications when a product hits Critical — so the analyst doesn't have to check the dashboard daily.

The deliberate choice not to build these for the MVP is a product judgment call: the core analytics work without them, and adding them before they're validated would be over-engineering."

### 8. "How do you keep the Supabase DB from pausing?"

"Supabase free-tier pauses projects after 7 days of inactivity. I have a GitHub Actions workflow (`heartbeat.yml`) that runs on a cron every 3 days and does a `curl` on `GET /api/health`. The health endpoint does a trivial DB read. Supabase sees that as activity and resets the timer. The workflow is free for public repos; the setup requires one repository variable (`PRODUCTION_URL`) pointing at the Vercel deployment. I documented this decision in `docs/DECISIONS.md` because it's the kind of free-tier-aware ops thinking a small team would actually use."

### 9. "How did you handle security?"

"Three layers. First, secrets: `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` live only in environment variables, never in the repo. The `server-only` package in the DB client means any accidental import into a browser bundle is a build error, not a runtime mistake.

Second, input validation: every API route handler validates request bodies with Zod before touching the database. UUID path parameters are validated against the UUID format before being interpolated into queries.

Third, the reset endpoint: `GET /api/admin/reset` requires `Authorization: Bearer <CRON_SECRET>`. Without the header (or with the wrong value), it returns 401. I verified this with a curl test during development.

The Phase 2 audit specifically checked these surfaces — the audit report is in `docs/audit/`."

### 10. "Why this project for your portfolio?"

"I'm pivoting into pharma supply chain and data analyst roles. The two things I wanted to demonstrate are: first, that I understand the domain — FEFO, ROP, safety stock, VACC [Value At Risk] — not just as acronyms but well enough to implement them correctly in code. Second, that I can use AI tooling in a disciplined, auditable way, not just 'I asked ChatGPT to write my app'.

The dual-model audit protocol — committing the audit reports, triaging findings manually, writing rationale for every non-trivial decision — is a workflow I'd bring to any team. It shows that AI assistance doesn't mean less engineering rigour; it means higher throughput with the same standards."

---

## Quick reference: file map

| What | Where |
|---|---|
| Safety stock / ROP / suggested qty | [`src/lib/domain/reorder.ts`](../src/lib/domain/reorder.ts) |
| FEFO ranking / expiry buckets / VAR | [`src/lib/domain/expiry.ts`](../src/lib/domain/expiry.ts) |
| Z-score anomaly detection | [`src/lib/domain/anomalies.ts`](../src/lib/domain/anomalies.ts) |
| Briefing rules engine | [`src/lib/domain/briefing.ts`](../src/lib/domain/briefing.ts) |
| Domain types | [`src/lib/domain/types.ts`](../src/lib/domain/types.ts) |
| All domain tests | [`src/lib/domain/*.test.ts`](../src/lib/domain/) |
| DB queries | [`src/lib/db/queries.ts`](../src/lib/db/queries.ts) |
| Reset cron route | [`src/app/api/admin/reset/route.ts`](../src/app/api/admin/reset/route.ts) |
| Health endpoint | [`src/app/api/health/route.ts`](../src/app/api/health/route.ts) |
| Briefing Server Action | [`src/app/briefing/actions.ts`](../src/app/briefing/actions.ts) |
| CI workflow | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Heartbeat workflow | [`.github/workflows/heartbeat.yml`](../.github/workflows/heartbeat.yml) |
| Engineering decisions | [`docs/DECISIONS.md`](DECISIONS.md) |
| Phase audit reports | [`docs/audit/`](audit/) |
