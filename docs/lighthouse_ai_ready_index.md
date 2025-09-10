# Lighthouse AI Readiness Index (Light) - v1.0

**By Arkology Studio**

---

## 1. Purpose and Outline

The **Lighthouse AI Readiness Index** measures how prepared a website is for the 'Agentic Web': i.e. whether it can be *discovered*, *understood*, and *acted* upon by AI agents and generative search engines.

The *Light* version is **practical, low-cost, and easily implementable**, while still offering a reliable assessment of 'AI readiness'.

**Goals:**

- Provide **transparent, measurable indicators**.
- Avoid computationally expensive methods (e.g., LLM parsing).
- Ensure **cross-platform compatibility** via an open JSON schema.
- Provide a **baseline readiness score** to track improvement over time.

---

## 2. Categories

The index has four primary categories. Indicators can contribute to multiple categories:

1. **Discovery** – How easily AI agents can find and identify the site.
2. **Understanding** – How well AI agents can interpret the site’s structure and meaning.
3. **Actions** – How easily AI agents can perform useful actions on the site.
4. **Trust** – Signals that establish the site as a credible, up-to-date source.

---

## 3. Site Type & Indicator Applicability

**Profiles** (declared or detected):

- `blog_content`
- `ecommerce`
- `saas_app`
- `kb_support`
- `gov_nontransacting`
- `custom`

**Applicability Matrix (v1)**:

| Indicator                 | blog\_content   | ecommerce | saas\_app | kb\_support | gov\_nontransacting |
| ------------------------- | --------------- | --------- | --------- | ----------- | ------------------- |
| MCP                       | not\_applicable | required  | required  | optional    | not\_applicable     |
| agents.json               | optional        | required  | required  | optional    | optional            |
| llms.txt                  | required        | optional  | optional  | required    | required            |
| JSON-LD                   | required        | required  | required  | required    | required            |
| XML Sitemap               | required        | required  | required  | required    | required            |
| Canonical                 | required        | required  | required  | required    | required            |
| Robots.txt (agent gating) | required        | required  | required  | required    | required            |
| Basic SEO                 | required        | required  | required  | required    | required            |

Inapplicable indicators are excluded from category averages.

---

## 4. Scoring

### Scoring pipeline (authoritative on the server)

**Detect profile (heuristics or client-declared):**

1. **Heuristics (example signals):**
   - Product/Offer/Cart schema, `/cart`, `/checkout` → `ecommerce`
   - OAuth/login endpoints, API docs, dashboard subpaths → `saas_app`
   - Many `FAQPage`, `Article`, `HowTo` → `kb_support` or `blog_content`
   - Government domains or policy/notice-heavy sites → `gov_nontransacting` *(Set sensible defaults, but allow user override.)*

**Assign applicability from the matrix → set ****\`\`****.**

- For each indicator, determine `status` (`required`|`optional`|`not_applicable`) and whether to include it in category means for this site profile.

**Run audit → compute indicator sub‑scores.**

- Each indicator returns a **0..1** score (`0.0` absent/broken, `0.5` partial, `1.0` valid), plus evidence.
- Keep scoring **deterministic** (no LLMs or external authority lookups in Light v1).

**Aggregate categories excluding N/A indicators.**

- For each category `C ∈ {Discovery, Understanding, Actions, Trust}`:
  ```
  C_score = mean( indicator.score for indicator where indicator.applicability.included_in_category_math )
  ```
  - If no indicators are included for a category, set `C_score = 0` and flag in notes.

**Compute overall using fixed category weights.**

- Default weights (can be stored in the report):
  - Discovery **0.30**
  - Understanding **0.30**
  - Actions **0.25**
  - Trust **0.15**

```
Overall_raw_0_1 = 0.30*Discovery + 0.30*Understanding + 0.25*Actions + 0.15*Trust
Overall_0_100 = round(100 * Overall_raw_0_1)
```

### Per‑indicator scoring rubric (Light v1)

- **0.0** – Missing, unreachable, invalid format, or violates baseline rules.
- **0.5** – Present but incomplete or with minor validation issues (e.g., partial coverage, missing examples, missing `lastmod`).
- **1.0** – Present and valid according to v1 checks (fetch/parse/validate passes; minimum coverage thresholds met).

> **Sampling:** audit up to 200 pages per site (homepage, hubs, PDPs/articles, FAQ, contact). Respect `robots.txt`. Treat 4xx/5xx as failures for that URL without aborting the run.

### Error handling & reproducibility

- Record all validation errors/warnings in the indicator `evidence` block.
- Store unrounded category scores to **two decimals** for reproducibility; UIs may round for display.
- The server is the source of truth for profile, applicability, and inclusion decisions; clients **must not** re‑decide scoring math.

---

## 5. JSON Schema

JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LighthouseAIReadinessReportV1",
  "type": "object",
  "required": ["site", "categories", "total_score"],
  "properties": {
    "site": {
      "type": "object",
      "required": ["url", "scan_date", "category"],
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "scan_date": { "type": "string", "format": "date" },
        "category": {
          "type": "string",
          "enum": ["ecommerce", "blog_content", "knowledge_base", "saas_app", "gov_nontransacting", "custom"]
        }
      }
    },
    "categories": {
      "type": "object",
      "required": ["discovery", "understanding", "actions", "trust"],
      "properties": {
        "discovery": { "$ref": "#/definitions/category" },
        "understanding": { "$ref": "#/definitions/category" },
        "actions": { "$ref": "#/definitions/category" },
        "trust": { "$ref": "#/definitions/category" }
      }
    },
    "total_score": { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "definitions": {
    "category": {
      "type": "object",
      "required": ["score", "indicators"],
      "properties": {
        "score": { "type": "number", "minimum": 0, "maximum": 1 },
        "indicators": {
          "type": "array",
          "items": { "$ref": "#/definitions/indicator" }
        }
      }
    },
    "indicator": {
      "type": "object",
      "required": ["name", "score", "applicability"],
      "properties": {
        "name": { "type": "string" },
        "score": { "type": "number", "minimum": 0, "maximum": 1 },
        "applicability": {
          "type": "object",
          "required": ["status", "reason", "included_in_category_math"],
          "properties": {
            "status": { "type": "string", "enum": ["required", "optional", "not_applicable"] },
            "reason": { "type": "string" },
            "included_in_category_math": { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

---

## 6. Implementation Guidelines

- **Server is authoritative** for: site profile, applicability, and `included_in_category_math`. Clients must not re‑decide math.
- **Profile detection**: apply heuristics (or client‑declared override) before any checks; persist `site.profile` and detection traces.
- **Apply applicability**: set each indicator’s `status` and `included_in_category_math` from the matrix for the chosen profile.
- **Lightweight checks only**: HTML/JSON/XML parsing, HTTP header/file fetches; no LLMs or off‑site authority lookups in Light v1.
- **Sampling**: up to 200 pages (home, hubs, PDPs/articles, FAQ, contact). Respect `robots.txt`. Treat 4xx/5xx as URL‑level failures.
- **Evidence & errors**: record fetch URLs, booleans (reachable/valid), and validation errors under each indicator’s `evidence`.
- **Category aggregation**: compute category means from indicators where `included_in_category_math=true`; if none, set category to 0 and note.
- **Weights**: store weights in the report (default: Discovery 0.30, Understanding 0.30, Actions 0.25, Trust 0.15). They must sum to 1.0.
- **Overall score**: `Overall_raw_0_1 = Σ(weight_c * score_c)`; `Overall_0_100 = round(100 * Overall_raw_0_1)`; keep raw unrounded for reproducibility.
- **Timeouts & retries**: use sane timeouts per request (e.g., 8–12s) and at most one retry; mark as failed if exceeded.
- **Client UX**: clients display per‑indicator applicability and notes; they do not change scoring decisions.

---

```ts
  
```

---

## 7. Example TypeScript

### Types

```
export type Applicability = {
  status: 'required' | 'optional' | 'not_applicable';
  reason: string;
  included_in_category_math: boolean;
};

export type Indicator = {
  name: string;
  score: number; // 0..1
  applicability: Applicability;
  evidence?: Record<string, unknown>;
};

export type Category = {
  score: number; // computed 0..1
  indicators: Indicator[];
};

export type Weights = {
  discovery: number;
  understanding: number;
  actions: number;
  trust: number;
};

export type LighthouseAIReport = {
  site: { url: string; scan_date: string; category: string };
  categories: {
    discovery: Category;
    understanding: Category;
    actions: Category;
    trust: Category;
  };
  weights: Weights; // must sum to 1.0
  overall: { raw_0_1: number; score_0_100: number };
};

```

### Constants

```
export const DEFAULT_WEIGHTS: Weights = {
  discovery: 0.30,
  understanding: 0.30,
  actions: 0.25,
  trust: 0.15,
};

```

### Functions

```
export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export const categoryScore = (indicators: Indicator[]): number => {
  const included = indicators.filter(i => i.applicability.included_in_category_math);
  return mean(included.map(i => i.score));
};

export const compute = (
  report: { categories: LighthouseAIReport['categories']; weights?: Partial<Weights> }
): { raw_0_1: number; score_0_100: number } => {
  const w = { ...DEFAULT_WEIGHTS, ...(report.weights || {}) } as Weights;

  const D = (report.categories.discovery.score = categoryScore(report.categories.discovery.indicators));
  const U = (report.categories.understanding.score = categoryScore(report.categories.understanding.indicators));
  const A = (report.categories.actions.score = categoryScore(report.categories.actions.indicators));
  const T = (report.categories.trust.score = categoryScore(report.categories.trust.indicators));

  const raw = w.discovery * D + w.understanding * U + w.actions * A + w.trust * T;
  const score_0_100 = Math.round(100 * raw);

  return { raw_0_1: raw, score_0_100 };
};

```



