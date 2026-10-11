<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <!-- TODO: add a logo (e.g. public/logo.png) and show it here -->

  <h3 align="center">SAGIP-AI</h3>

  <p align="center">
    Smart AI for Geospatial Intelligence and Prediction
    <br />
    Citizens report emergencies in under a minute. AI classifies each report, a transparent formula ranks it, and responders act on the most urgent first. A person always decides.
    <br />
    <a href="docs/DOCUMENTATION.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    View Demo (TODO: not deployed yet)
    &middot;
    <a href="https://github.com/helidastar/SAGIP-AI/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/helidastar/SAGIP-AI/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

<!-- TODO: add a screenshot once the final UI replaces the testing wireframe -->

Emergency reports arrive through scattered channels: phone calls, social media posts and word of mouth. Responders have no single, ranked view of what is happening and where, so the most urgent incident is not always the one handled first.

SAGIP-AI gives citizens one simple way to report an emergency (photo, short description, GPS) **without logging in**, and gives staff a ranked list and map of open incidents with a score breakdown.

Here's how it works:
* **Report.** A citizen submits a photo, description and location from their phone and gets a tracking code (`SGP-XXXXXX`). Each IP can send 5 reports per 10 minutes.
* **Classify.** AI sorts the report into 1 of 8 incident types and 1 of 4 severity levels, with a confidence score and a hoax flag. The chain is: primary model, one retry, fallback Gemini, then a keyword matcher (`src/lib/ai/chain.ts`). It never fails a report.
* **Review.** A report goes to a person first if confidence is below 0.70, severity is high or critical, a hoax is suspected, or the keyword matcher answered (`src/lib/ai/review.ts`). A suspected hoax is flagged, never auto-rejected.
* **Rank.** A plain formula, not an AI call, scores each incident 0 to 100: `100 × (0.45·severity + 0.25·population + 0.15·location risk + 0.15·type)` (`src/lib/scoring/index.ts`). These weights are placeholders until the weights design doc is written.
* **Act.** Staff assign teams, update status and can override any score. Every change goes to the audit log.

What we know and don't know yet:
* Our own EfficientNet-B0 model scores **79.8% on its 1,005-photo test set** ([metrics](docs/training-runs/2026-09-23/metrics.json)) but covers only 6 of the 8 types (no `road_accident` or `fallen_debris` photos), so those rely on Gemini. It is not yet the primary provider; Gemini still is.
* AI accuracy on real Philippine phone photos is not measured yet. The 36-photo benchmark needs its severity labels first (ISS-009).
* A report needs GPS and an internet connection. There is no offline queue.
* The UI is still the testing wireframe. The analytics page is a placeholder and the definitions page is not started.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Next][Next.js]][Next-url] Next.js 16 App Router, pages and API in one app
* [![React][React.js]][React-url] React 19
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Tailwind][Tailwind]][Tailwind-url] Tailwind CSS 4
* [![Supabase][Supabase]][Supabase-url] Postgres + PostGIS, Auth, Storage
* [![Gemini][Gemini]][Gemini-url] free tier: `gemini-3.1-flash-lite` primary, `gemini-3.5-flash` fallback
* [![ONNX][ONNX]][ONNX-url] our own image classifier via `onnxruntime-node`
* [![Vercel][Vercel]][Vercel-url] hosting (not deployed yet)

The dashboard map is a custom SVG (`src/components/dashboard/IncidentMap.tsx`), not a map library. Everything runs on free tiers; no billing account is linked.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

The team shares one Supabase project that is already migrated and seeded. Ask Charity ([@helidastar](https://github.com/helidastar)) for access, then follow these steps. The full guide is [docs/ONBOARDING.md](docs/ONBOARDING.md).

### Prerequisites

* Node.js 20 or newer, with npm
  ```sh
  node -v
  ```
* Git
* Access to the team Supabase project, or your own project with the `postgis` extension enabled
* *(optional)* Your own free Gemini key from [aistudio.google.com](https://aistudio.google.com), with no billing account linked
* *(optional)* `sagip-classifier.onnx` and `labels.json` in `models/` (from the team Drive) to use `AI_PROVIDER=local`

### Installation

1. Clone the repo and switch to the working branch
   ```sh
   git clone https://github.com/helidastar/SAGIP-AI.git
   cd SAGIP-AI
   git checkout development
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill it in. Never commit it.
   ```sh
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=      # secret, server only
   DATABASE_URL=                   # secret
   DIRECT_URL=                     # secret
   AI_PROVIDER=mock                # mock uses no AI quota; or gemini | local
   AI_API_KEY=
   ```
   The other variables (fallback provider, `CONFIDENCE_THRESHOLD`, `AI_DAILY_BUDGET_USD`, `REPORT_RATE_LIMIT`, `REPORT_RATE_WINDOW_MS`) have working defaults in `.env.example`.
4. *(Only for a new Supabase project)* Run `supabase/migrations/0001_init.sql` to `0006_hoax_flag.sql` in order in the SQL Editor. They create the tables, row-level security and the private `report-photos` bucket. Then load teams and areas and make yourself staff:
   ```sh
   npm run seed
   npm run make-admin -- <email>
   ```
5. Start the app
   ```sh
   npm run dev   # http://localhost:3000
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

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

Useful commands:

```sh
npm run build                                # production build
npm run lint                                 # ESLint
npm run benchmark -- --dry-run               # check the labeled benchmark photos (free)
npm run dataset:prepare -- --dry-run         # check training photos before building the dataset
npm run export:training-data -- --dry-run    # preview reviewed reports as new training data
node --env-file=.env.local --env-file=.env.test.local scripts/smoke-staff.mjs   # staff API smoke test, with npm run dev running
```

There is no automated test runner in `package.json` yet; the staff smoke test is the one end-to-end check today.

_For the architecture, data model, all 16 API endpoints and the risk register, see [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md). For AI results, see the [AI log](docs/handoffs/ai-benchmarking.md)._

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Citizen report, submitted and track pages
- [x] Staff login, ranked list and map, incident detail, review queue
- [x] AI chain with fallback, keyword matcher and 4 human-review triggers
- [x] Deterministic priority score with per-factor breakdown
- [x] Own image classifier trained (79.8% test accuracy, 6 types)
- [ ] Fill severity labels and run the 36-photo benchmark (ISS-009)
- [ ] Make the local model the primary provider
- [ ] Write the priority weights design doc
- [ ] Define "severity %" and add it to the database, API and UI
- [ ] Analytics page and endpoint, definitions page
- [ ] Add Gemini 3.x prices to the cost tracker (ISS-007)
- [ ] Staff end-to-end test (ISS-010), load test (R-004), low-end phone and weak-connection test
- [ ] Final UI design on all 9 pages
- [ ] Deploy to Vercel from `main`

See the [open issues](https://github.com/helidastar/SAGIP-AI/issues) for more.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Work goes from a feature branch into `development`, then into `main` through pull requests. `main` is protected and needs one approval.

1. Branch from `development` (`git checkout -b feat/<area>`)
2. Commit with a one-line message in the form `type(scope): what changed` (e.g. `feat(ai): add local onnx classifier provider`)
3. Check your work (`npm run build` and `npm run lint`)
4. Push the branch (`git push origin feat/<area>`)
5. Open a pull request into `development`

### Top contributors:

<a href="https://github.com/helidastar/SAGIP-AI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=helidastar/SAGIP-AI" alt="contrib.rocks image" />
</a>

| Name | Role | GitHub |
|---|---|---|
| Charity Ricabo | AI integration | [@helidastar](https://github.com/helidastar) |
| John Vincent Fabroa | Backend | [@Beynsz](https://github.com/Beynsz) |
| Reign Marie Hamo-ay | Citizen portal | [@Reignnnh04](https://github.com/Reignnnh04) |
| Maria Mhikyla Jayno | Admin dashboard | [@mhiksNmatch](https://github.com/mhiksNmatch) |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

TODO: no license chosen yet. There is no `LICENSE` file in the repo.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Team CCRVibe 2.0 · CCRVIBE 2.0 · Instructor: Rex A. Seadiño Jr.

Project Link: [https://github.com/helidastar/SAGIP-AI](https://github.com/helidastar/SAGIP-AI)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* Public disaster photo datasets used to train our classifier, listed with their licenses in [training/README.md](training/README.md)
* [Google AI Studio](https://aistudio.google.com) for the Gemini free tier
* [Supabase](https://supabase.com) and [Vercel](https://vercel.com) free tiers
* [ONNX Runtime](https://onnxruntime.ai) and [sharp](https://sharp.pixelplumbing.com)
* [OpenStreetMap](https://www.openstreetmap.org) for incident location links
* [Img Shields](https://shields.io)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/helidastar/SAGIP-AI.svg?style=for-the-badge
[contributors-url]: https://github.com/helidastar/SAGIP-AI/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/helidastar/SAGIP-AI.svg?style=for-the-badge
[forks-url]: https://github.com/helidastar/SAGIP-AI/network/members
[stars-shield]: https://img.shields.io/github/stars/helidastar/SAGIP-AI.svg?style=for-the-badge
[stars-url]: https://github.com/helidastar/SAGIP-AI/stargazers
[issues-shield]: https://img.shields.io/github/issues/helidastar/SAGIP-AI.svg?style=for-the-badge
[issues-url]: https://github.com/helidastar/SAGIP-AI/issues
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Tailwind]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Supabase]: https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[Gemini]: https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white
[Gemini-url]: https://ai.google.dev/
[ONNX]: https://img.shields.io/badge/ONNX_Runtime-005CED?style=for-the-badge&logo=onnx&logoColor=white
[ONNX-url]: https://onnxruntime.ai/
[Vercel]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[Vercel-url]: https://vercel.com/
