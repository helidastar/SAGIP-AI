<div align="center">

# SAGIP-AI

**Smart AI for Geospatial Intelligence and Prediction**

Report it in under a minute. Classify it with AI. Rank it with a formula you can read. Keep a human in command.

CCRVIBE 2.0 capstone · Team CCRVibe 2.0 · Instructor: Rex A. Seadiño Jr.

![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20TypeScript-black?logo=next.js&logoColor=white)
![Maps](https://img.shields.io/badge/maps-custom%20SVG-0EA5E9)
![DB](https://img.shields.io/badge/db-Supabase%20%2B%20PostGIS-3FCF8E?logo=supabase&logoColor=white)
![AI](https://img.shields.io/badge/AI-Gemini%20free%20tier%20%2B%20local%20ONNX-4285F4?logo=googlegemini&logoColor=white)
![Deploy](https://img.shields.io/badge/deploy-Vercel%20(not%20yet%20live)-000000?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

Pilot area: **TODO** (no named pilot partner yet, see Risk Log R-002) · Focus: citizen emergency reporting and responder triage in the Philippines

**[For Reviewers](#for-reviewers-and-panelists)** · **[Quickstart](#collaborator-quickstart)** · **[Local Setup](#local-setup)** · **[Docs](#documentation-map)**

</div>

---

## The problem

Emergency reports arrive through scattered channels: phone calls, social media posts and word of mouth. Responders have no single, ranked view of what is happening and where, so they triage by hand, guess at severity, and the most urgent incident is not always the one handled first.

## What SAGIP-AI does

SAGIP-AI gives citizens one simple way to report an emergency (photo, short description, GPS) **without logging in**, and gives staff a ranked list and map of open incidents with a score breakdown. Every AI output is assistive: uncertain, urgent or suspicious reports always go to a human first, staff can correct any classification or override any score, and the AI never dispatches.

```
  citizen report  (photo + description + GPS, no login, 5 per IP per 10 min)
        |
        v
  POST /api/reports ──▶ Supabase  (Postgres + PostGIS, private photo bucket)
        |
        v
  AI chain:  primary model ──▶ fallback Gemini ──▶ keyword matcher
             (8 incident types · 4 severity levels · confidence · hoax flag)
        |
        v
  needs review?  confidence < 0.70 · high/critical · suspected hoax · keyword fallback
        |  yes ──▶ review queue ──▶ staff confirm or correct
        |  no
        v
  priority score 0–100  ──▶  ranked list + map  ──▶  staff assign team, update status
  (severity, population,                              citizen tracks by code
   location risk, type)
```

| Users can… | How |
|---|---|
| Report an emergency without an account | Mobile-first form at `/` (`src/components/citizen/ReportForm.tsx`), per-IP rate limit in `src/lib/rate-limit.ts` |
| Track their report | Tracking code (`SGP-XXXXXX`) at `/track`, served by `GET /api/reports/track/{trackingCode}` |
| Get an AI classification | `src/lib/ai/chain.ts`: primary provider, one retry, fallback provider, then keyword matcher. Never throws |
| Have doubtful reports checked by a person | `needsReview()` in `src/lib/ai/review.ts` sends them to `/dashboard/review` |
| See incidents ranked with the reason | Deterministic formula in `src/lib/scoring/index.ts`; the dashboard shows each factor's contribution |
| Assign, update and override | Staff API under `src/app/api/incidents/[id]/` (assign, status, priority, reclassify), all written to `audit_logs` |

---

## For reviewers and panelists

**Start here:**

1. Read [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) sections 3 to 7: problem, user flow, core concepts and architecture.
2. Read the [AI log](docs/handoffs/ai-benchmarking.md) for what the AI has actually been measured to do so far.
3. Run the app locally with the [Collaborator Quickstart](#collaborator-quickstart). A public URL is **TODO**: the app is not deployed yet.

**What we want you to notice:**

- **Honest by design.** The AI suggests; people decide. Four review triggers (confidence below 0.70, high or critical severity, suspected hoax, keyword fallback) always send a report to a person. A suspected hoax is flagged, never auto-rejected.
- **Explainable ranking.** The priority score is plain code, not an AI call: `100 × (0.45·severity + 0.25·population + 0.15·location risk + 0.15·type)`. These weights are **placeholders** until the weights design doc is written.
- **Free tiers only.** Vercel Hobby, Supabase Free, the Gemini free tier and our own ONNX model running on the server. No billing account is linked.
- **Fails safe.** If the Gemini quota runs out or the model errors, the chain falls back to the keyword matcher and human review instead of failing the report.
- **Our own model.** An EfficientNet-B0 image classifier trained in Colab scores **79.8% on its 1,005-photo test set** ([metrics](docs/training-runs/2026-09-23/metrics.json)).

**Known limits, stated plainly:**

- The local model covers only **6 of the 8 types** (no training photos for `road_accident` or `fallen_debris`), so those rely on Gemini. It is **not yet the primary provider**; Gemini still is.
- AI accuracy on real Philippine phone photos is **not measured yet**. The 36-photo benchmark cannot run until its severity labels are filled in (ISS-009).
- A report needs GPS and an internet connection. There is no offline queue.
- The UI is still the testing wireframe. The analytics page is a placeholder and the definitions page is not started.

| Question | Where it's answered |
|---|---|
| How good is the AI, really? | [docs/handoffs/ai-benchmarking.md](docs/handoffs/ai-benchmarking.md) · [docs/training-runs/2026-09-23/](docs/training-runs/2026-09-23/) · [DOCUMENTATION.md Appendix B](docs/DOCUMENTATION.md#appendix-b--ai-classification-benchmarking-plan) |
| How is the human kept in the loop? | [DOCUMENTATION.md §6.4–6.5](docs/DOCUMENTATION.md#64-ai-estimated-vs-confirmed-severity) |
| How is a report ranked? | [DOCUMENTATION.md §6.6–6.7](docs/DOCUMENTATION.md#66-priority-score-proposed--to-be-finalized-in-its-own-design-doc) · `src/lib/scoring/index.ts` |
| How is the data protected? | [DOCUMENTATION.md §9.3](docs/DOCUMENTATION.md#93-security-supabase-rls) (row-level security, private photo bucket) |
| What are the known risks and gaps? | [DOCUMENTATION.md §16](docs/DOCUMENTATION.md#16-known-issues-caveats--open-questions) |
| How was the model trained? | [training/README.md](training/README.md) |

---

## Tech stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend + API | Next.js 16 App Router, React 19, TypeScript | Citizen portal, staff dashboard and route handlers in one app |
| Styling | Tailwind CSS 4 | Temporary wireframe UI (final design in progress) |
| Maps | Custom SVG (`src/components/dashboard/IncidentMap.tsx`) | Incident pins on the dashboard, no map library; detail view links to OpenStreetMap |
| Database | Supabase Postgres + PostGIS | Reports, classifications, scores, areas; spatial queries |
| Auth & storage | Supabase Auth, Supabase Storage | Staff login (responder, admin); private `report-photos` bucket |
| AI (cloud) | Gemini free tier via `@google/genai` | `gemini-3.1-flash-lite` primary, `gemini-3.5-flash` fallback |
| AI (local) | Own EfficientNet-B0 model, `onnxruntime-node` + `sharp` | Free on-server classification of 6 types |
| AI (last resort) | Keyword matcher (`src/lib/ai/keyword.ts`) | Always answers with confidence 0, so the report goes to review |
| Ranking | Deterministic weighted formula | Explainable 0–100 priority score and P1–P4 bands |
| Deployment | Vercel + Supabase | Free-tier hosting (**not deployed yet**) |

`claude` and `llama` providers also exist in `src/lib/ai/` but are not configured; the team uses free tiers only.

## Team — CCRVibe 2.0

| Avatar | Name | Role | Program | GitHub |
|---|---|---|---|---|
| <img src="https://github.com/helidastar.png?size=60" width="40" alt="Charity Ricabo avatar"> | Charity Ricabo | AI integration | TODO | [@helidastar](https://github.com/helidastar) |
| <img src="https://github.com/Beynsz.png?size=60" width="40" alt="John Vincent Fabroa avatar"> | John Vincent Fabroa | Backend | TODO | [@Beynsz](https://github.com/Beynsz) |
| <img src="https://github.com/Reignnnh04.png?size=60" width="40" alt="Reign Marie Hamo-ay avatar"> | Reign Marie Hamo-ay | Citizen portal | TODO | [@Reignnnh04](https://github.com/Reignnnh04) |
| <img src="https://github.com/mhiksNmatch.png?size=60" width="40" alt="Maria Mhikyla Jayno avatar"> | Maria Mhikyla Jayno | Admin dashboard | TODO | [@mhiksNmatch](https://github.com/mhiksNmatch) |

---

## Repository structure

```
SAGIP-AI/
├── README.md            # You are here: overview, reviewer guide, setup.
├── .env.example         # Every environment variable, with defaults. Copy to .env.local.
├── src/
│   ├── app/
│   │   ├── (citizen)/   # Report (/), submitted (/submitted), track (/track). No login.
│   │   ├── (dashboard)/ # /dashboard list + map, incidents/[id], review, analytics (placeholder).
│   │   ├── login/       # Staff login.
│   │   └── api/         # 16 route handlers: reports, incidents, review queue, auth, teams, areas.
│   ├── components/      # citizen/, dashboard/ (incl. IncidentMap.tsx), ui/.
│   ├── lib/
│   │   ├── ai/          # Provider chain, Gemini/local/keyword classifiers, review rules.
│   │   ├── scoring/     # Deterministic priority score and bands.
│   │   ├── reports/     # Intake, classify, score and incident queries.
│   │   ├── supabase/    # Server and admin (service-role) clients.
│   │   └── constants.ts # Types, severities, statuses, thresholds, weights. Single source of truth.
│   └── types/           # Shared TypeScript types.
├── supabase/
│   └── migrations/      # 6 SQL migrations: schema, staff accounts, views, map/areas, locks, hoax flag.
├── scripts/             # seed, make-admin, benchmark, dataset prep, training export, staff smoke test.
├── benchmark/           # Labeled-photo benchmark (dataset itself is git-ignored).
├── training/            # Colab notebook and guide for our own ONNX classifier.
├── models/              # Trained .onnx + labels.json (git-ignored, shared via Drive).
└── docs/                # DOCUMENTATION.md, ONBOARDING.md, AI log, training-run metrics.
```

One Next.js app holds both the pages and the API (a modular monolith), so there is one thing to deploy to Vercel. The database lives as SQL migrations under `supabase/`, and the AI tooling (benchmark, training) sits beside the app because it is run by hand, not deployed.

---

## Collaborator Quickstart

The team shares one Supabase project, already migrated and seeded, so there is no backend to set up.

1. Ask Charity ([@helidastar](https://github.com/helidastar)) for access to the repo and the Supabase project (see [ONBOARDING.md](docs/ONBOARDING.md)).
2. Clone and install:

   ```bash
   git clone https://github.com/helidastar/SAGIP-AI.git
   cd SAGIP-AI
   git checkout development
   npm install
   ```

3. Copy `.env.example` to `.env.local`, fill in the Supabase values, and set `AI_PROVIDER=mock` so you don't use the shared free Gemini quota.
4. Run it:

   ```bash
   npm run dev   # http://localhost:3000
   ```

---

## Local Setup

### Prerequisites

- Node.js 20+ and npm
- Git
- A Supabase project with the `postgis` extension enabled
- *(optional)* Your own free Gemini key from [aistudio.google.com](https://aistudio.google.com), with no billing account linked
- *(optional)* The trained model files `sagip-classifier.onnx` and `labels.json` in `models/` (from the team Drive) to use `AI_PROVIDER=local`

### Environment variables

Everything is read from one file. Copy `.env.example` and fill in real values only on your machine or in the Vercel dashboard. Never commit secrets.

| File | Block | Used by |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server Supabase clients |
| `.env.local` | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` | Server-only admin client, seed and admin scripts (secret) |
| `.env.local` | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS` | Primary classifier (`gemini`, `local`, `claude`, `llama` or `mock`) |
| `.env.local` | `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_API_KEY`, `AI_FALLBACK_MODEL`, `AI_FALLBACK_BASE_URL` | Fallback classifier |
| `.env.local` | `CONFIDENCE_THRESHOLD` (default `0.7`), `AI_DAILY_BUDGET_USD` | Review trigger and daily spend cap |
| `.env.local` | `REPORT_RATE_LIMIT` (default `5`), `REPORT_RATE_WINDOW_MS` (default `600000`) | Per-IP limit on `POST /api/reports` |
| `.env.test.local` | `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_RESPONDER_EMAIL`, `TEST_RESPONDER_PASSWORD` | `scripts/smoke-staff.mjs` only |

`AI_DAILY_BUDGET_USD` does not yet count Gemini 3.x spend, because their prices are missing from `src/lib/ai/normalize.ts` (ISS-007).

### Database (Supabase)

1. Enable the `postgis` extension.
2. Run the files in `supabase/migrations/` in order (`0001_init.sql` to `0006_hoax_flag.sql`) in the SQL Editor or with the Supabase CLI. They create the tables, row-level security policies and the private `report-photos` bucket.
3. Load teams and areas, then give a staff user a role:

   ```bash
   npm run seed
   npm run make-admin -- <email>
   ```

### Web app

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint
```

| Page | URL | Account |
|---|---|---|
| Report an incident | `/` | none |
| Confirmation | `/submitted?code=SGP-XXXXXX` | none |
| Track a report | `/track` | none |
| Staff login | `/login` | staff |
| Ranked list and map | `/dashboard` | staff |
| Incident detail | `/dashboard/incidents/<id>` | staff |
| Review queue | `/dashboard/review` | staff |
| Analytics | `/dashboard/analytics` | staff (placeholder) |
| Definitions | TODO | not started |

### AI tooling

```bash
npm run benchmark -- --dry-run              # check the labeled benchmark photos (free)
npm run dataset:prepare -- --dry-run        # check training photos before building the dataset
npm run export:training-data -- --dry-run   # preview reviewed reports as new training data
```

See [benchmark/README.md](benchmark/README.md) and [training/README.md](training/README.md).

### Tests

There is no automated test runner in `package.json` yet. The one end-to-end check today is the staff API smoke test, run against `npm run dev`:

```bash
node --env-file=.env.local --env-file=.env.test.local scripts/smoke-staff.mjs
```

TODO: staff-side end-to-end test (ISS-010), load test (R-004), and low-end phone and weak-connection test.

---

## Documentation map

| Doc | What's inside |
|---|---|
| [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) | Full project documentation: scope, user flow, architecture, data model, API, setup, risks, schedule. |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Team access, setup, `.env.local`, staff accounts and how we work. |
| [docs/handoffs/ai-benchmarking.md](docs/handoffs/ai-benchmarking.md) | AI status, live test log and open AI issues. |
| [docs/training-runs/2026-09-23/](docs/training-runs/2026-09-23/) | Local model metrics, labels and confusion matrix. |
| [benchmark/README.md](benchmark/README.md) | How to build and run the labeled-photo benchmark. |
| [training/README.md](training/README.md) | Photo sources and how to train the local model. |

## Core data model

`reports` · `classifications` · `reviews` · `priority_scores` · `assignments` · `teams` · `profiles` · `areas` · `audit_logs`

A report moves through 7 statuses: `received`, `pending_review`, `classified`, `assigned`, `in_progress`, `resolved`, `rejected`.

---

<div align="center">

**SAGIP-AI** — the AI assists; a person always decides.

Built for CCRVIBE 2.0 · License: TODO (no LICENSE file in the repo yet)

</div>
