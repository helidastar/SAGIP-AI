<div align="center">

# SAGIP-AI

**Smart AI for Geospatial Intelligence and Prediction**

An AI-assisted emergency reporting and incident prioritization platform. Citizens report emergencies in under a minute. Responders see a ranked, map-based view of what needs help first.

![Status](https://img.shields.io/badge/status-in%20testing-blue)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

**[Read the Full Documentation](docs/DOCUMENTATION.md)**

</div>

---

## About

Emergency reports often arrive through scattered channels such as phone calls, social media, and word of mouth. Responders have no single, prioritized view of what is happening and where.

**SAGIP-AI** gives citizens one simple way to report an incident with a photo, a short description, and their location. AI classifies each report, a transparent formula ranks it, and responders act on the most urgent incidents first. The AI assists and does not decide: uncertain and high-severity cases always go to a human for review.

## Key Features

- **Citizen Reporting** — photo, description, and GPS location, with no account needed
- **AI Classification** — incident type, severity, and confidence from a vision AI model
- **Human Review** — flagged cases are confirmed by a responder before ranking
- **Priority Scoring** — explainable ranking of incidents by urgency
- **Responder Dashboard** — live map, ranked list, assignment, and status tracking

## Tech Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + PostGIS, Auth, Storage) · Gemini free tier · our own ONNX image classifier (onnxruntime-node) · Vercel

The dashboard map is a dependency-free SVG component, not a map library.

## Project Status

Implemented and in testing, targeting the demonstration in November 2026. The citizen portal, responder dashboard, API, AI classification chain and priority scoring are built and integrated on `development`.

The current interface is a temporary wireframe used for testing; the final visual design is still in progress. Our own image classifier reaches 79.8 percent test accuracy across 6 incident types and runs free on the server, with the Gemini free tier as backup. See the [AI log](docs/handoffs/ai-benchmarking.md) for the measured results.

## Getting Started

New to the team? Follow the [onboarding guide](https://github.com/helidastar/SAGIP-AI/blob/development/docs/ONBOARDING.md): access, setup, `.env.local`, staff accounts and how we work.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run seed` | Load teams and areas into Supabase |
| `npm run make-admin -- <email>` | Give a Supabase user a staff role |
| `npm run benchmark -- --dry-run` | Check the labeled benchmark photos (free) |
| `npm run dataset:prepare -- --dry-run` | Check training photos before building the dataset |
| `npm run export:training-data -- --dry-run` | Preview exporting reviewed reports as new training data |

Set `AI_PROVIDER=mock` in `.env.local` while developing so testing does not consume the free Gemini quota.

## Documentation

> **The complete project documentation is in [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md).**
>
> It covers the system architecture, data model, API endpoints, setup instructions, common tasks, known issues, and the AI benchmarking plan.
>
> **New to the team?** Start with the [onboarding guide](https://github.com/helidastar/SAGIP-AI/blob/development/docs/ONBOARDING.md).

## Contributors

| Name | GitHub |
|------|--------|
| Charity Ricabo | [@helidastar](https://github.com/helidastar) |
| Maria Mhikyla Jayno | [@mhiksNmatch](https://github.com/mhiksNmatch) |
| Reign Marie Hamo-ay | [@Reignnnh04](https://github.com/Reignnnh04) |
| John Vincent Fabroa | [@Beynsz](https://github.com/Beynsz) |

<div align="center">

**CCRVIBE 2.0** · Instructor: Rex A. Seadiño Jr.

</div>
