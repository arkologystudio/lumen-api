# Lighthouse **AI‑Ready Diagnostics Dashboard** — High‑Level Design Specification

## 1. Purpose & Scope

Lighthouse’s Diagnostics Dashboard provides site owners with an **instant, actionable audit** of their website’s readiness for the coming *agentic web*. It scans across standards (llms.txt, Schema, MCP endpoints, etc.), GEO/SEO quality, and structural metadata, surfaces a clear score, and links directly to remediation services.

## 2. User Personas

| Persona            | Goals                                                        | Pain‑Points                                             |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------- |
| *Visitor (free)*   | Quick health‑check; decide if Lighthouse is worth purchasing | No technical knowledge, wants plain‑language next steps |
| *Site Owner (pro)* | Deep insights; fix issues automatically                      | Needs granular page data, batch fixes, ROI visibility   |
| *Agency Partner*   | Audit multiple clients; export reports                       | White‑label, API/CSV export                             |

## 3. Feature Matrix

| Indicator                              | Free        | Pro          |
| -------------------------------------- | ----------- | ------------ |
| llms.txt                               | ✔           | ✔            |
| agent.json                             | ✔           | ✔            |
| /.well‑known/ai‑agent.json             | ✔           | ✔            |
| Basic GEO / SEO                        | ✔           | ✔            |
| Advanced GEO / SEO (LLM‑assisted)      |             | ✔            |
| Structured Data (JSON‑LD)              | ✔           | ✔            |
| Robots / `noai` / `noimageai` tags     | ✔           | ✔            |
| Canonical URLs                         | ✔           | ✔            |
| XML Sitemap                            | ✔           | ✔            |
| Page‑level scoring                     |             | ✔            |
| Improve AI‑Readiness (one‑click fixes) | CT‑A locked | CT‑A enabled |
| Scheduled Audits                       |             | ✔            |

## 4. Audit Workflow

1. **Crawler ⇢ Queue** — Headless browser fetches homepage, sitemaps, `robots.txt`, `llms.txt`.
2. **Indicator Scanners** (parallel)

   * *Standards*: file existence + schema validation.
   * *Structured Data*: JSON‑LD extraction ➔ schema.org type map ➔ graph consistency check.
   * *GEO/SEO*: LLM prompt chains score titles, meta, entity coverage.
3. **Result Aggregator** — merges scanner outputs ➔ compute scores ➔ writes to datastore.
4. **Cache & Delta** — subsequent audits diff only changed URLs; 24h cache for free tier.
5. **Notification Bus** — triggers webhooks / email for pro users when score drops > X%.

## 5. Scoring Model

* **Indicator Score (0‑10)**: weight × pass/fail/quality.
* **Page Score** = Σ indicator scores / max.
* **Site Score** = traffic‑weighted mean of top N pages + critical globals (root files, robots).
* *Robots / noai / noimageai* **never penalise**; instead flagged “Access Intent ➜ Allow / Partial / Block”.

## 6. UI / UX Components

* **Overall Gauge** — big % with colour band.
* **Indicator Cards** — title • status chip (Pass / Warn / Fail) • *Why it matters* (≤ 120 chars) • *Fix Recommendation* accordion.
* **Access Intent Banner** — shows current AI allow/deny posture with neutral language + 🔒 icon; tooltip explains trade‑offs.
* **Improve AI‑Readiness Button** — launches guided wizard or upsell modal (free users).
* **Page‑Level Tab** (pro) — table view with sortable columns + CSV export.

## 7. Technology Stack

| **Layer**          | **Tech**                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawler            | Playwright (Node, headless Chromium) running in **Vercel Edge Functions**; fetch queue persisted in Supabase                                                  |
| Indicator Scanners | **Serverless TypeScript functions** (Vercel) for quick checks; optional Python micro‑services (containerised) for heavy NLP; OpenAI SDK for LLM scoring       |
| Storage            | **Supabase PostgreSQL** with `pgvector` for scores & embeddings; **Supabase Object Storage** for raw HTML, JSON‑LD, screenshots (Edge‑cached via Vercel)      |
| API                | **Express.js** (Node/TS) deployed as Vercel Serverless Functions; GraphQL layer for rich queries                                                              |
| Front‑end          | **Next.js 14 + React + TypeScript + TailwindCSS + shadcn/ui** on Vercel                                                                                       |
| Auth & RBAC        | **Supabase Auth** (JWT) with RLS in Postgres                                                                                                                  |
| Background Jobs    | **Supabase Cron** (single scheduler) — daily/weekly re‑audits *and* on‑demand re‑scores triggered via a lightweight `/trigger‑rescore` RPC from the dashboard |

## 8. Extensibility Extensibility Extensibility

* **Plugin Interface** — new indicator = drop‑in Docker micro‑service exposing `/scan` REST.
* **Versioning** — results store versioned spec ID to allow re‑scores when standards evolve.
* **Webhooks** — third‑party services can consume audit deltas (e.g., CI pipelines).

## 9. Privacy & Compliance

* Crawl obeys `robots.txt`; user opts to allow deep‑crawl.
* PII scrubbed before LLM calls (Edge redaction).
* ISO 27001 / SOC 2 for infrastructure; GDPR & POPIA FAQ on data retention.

## 10. Roadmap (M‑mix)

| Milestone          | Month | Notes                                  |
| ------------------ | ----- | -------------------------------------- |
| MVP (Free tier)    | M+3   | Core indicators, site score            |
| Pro v1             | M+6   | Page‑level, advanced GEO, CT‑A fixes   |
| Partner API        | M+9   | Agency white‑label, Zapier integration |
| Real‑time monitors | M+12  | Continuous audit & alerting            |

---

**End of Spec — v0.1**
