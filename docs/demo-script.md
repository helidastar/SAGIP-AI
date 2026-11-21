# Demo script (final presentation, 2026-11-23)

Simulation mode on a Cebu City map (no pilot partner, R-002). About 8 minutes. Two people: one on a phone (citizen), one on a laptop (staff).

## Before the demo (day before, then 30 min before)

| Step | Command / place | Pass mark |
|---|---|---|
| 1. Clear test reports and photos (Others 17) | Supabase: delete reports that are not `SGP-DEM…`, empty old files in `report-photos` | Only demo reports left |
| 2. Load demo data | `npm run seed` then `npm run seed:demo` (pointing at the production Supabase) | Ranked list shows the Cebu City demo reports |
| 3. Demo accounts | `npm run make-admin -- <email>` and `npm run make-admin -- <email> --role responder` | Both log in at `/login` |
| 4. Live URL | TODO: production Vercel URL once deployed | Citizen page loads on the phone over mobile data |
| 5. Fallback check (Others 21) | Vercel: remove `AI_FALLBACK_API_KEY`, redeploy, submit one report, then put the key back | Report still saved and appears in the review queue (keyword or local answer) |

## Script

1. **Problem (30 s).** Reports reach responders as calls and chat messages with no ranking. SAGIP-AI takes a photo report with no login and gives staff a ranked list.
2. **Citizen report (2 min, phone).** Open the URL, take a photo, add a short description, drag the map pin, submit. Show the tracking code and the safety steps. Open Track to show the status timeline.
3. **Review queue (2 min, laptop).** Log in as responder. The new report is in the review queue with the AI's draft type, severity and severity % (for example `High · 82%`) and a "Check first" tag if a trigger fired. Confirm or correct it. Say: "The AI drafts and ranks; a person confirms every report."
4. **Ranked list and map (1 min).** Show the report's place in the list and the score breakdown (severity 0.45, population 0.25, location risk 0.15, type 0.15).
5. **Incident detail (1 min).** Assign a team, move status to In progress. Show the audit trail.
6. **Analytics and Definitions (1 min).** Volume by type, day and area; the Definitions page with the 8 types, 4 levels, bands and 4 triggers.
7. **Limits (30 s).** Say them plainly (below).

## Numbers to say (and where they come from)

| Claim | Value | Source |
|---|---|---|
| Local model, 50-photo benchmark | 88% type, 54% severity exact, 2 missed urgent | `docs/handoffs/ai-benchmarking.md`, run 2026-11-18 |
| Local model, 77 real Facebook/news photos | 50.6% type (below the 86% pass mark) | same file, 2026-11-20 |
| Gemini free tier | 15 requests per minute (`gemini-3.1-flash-lite`) | ai-benchmarking.md |
| Submission limit | 5 reports per IP per 10 minutes | `src/lib/rate-limit.ts` |

## Limits to state

- Accuracy on real Philippine phone photos is lower (50.6% type on 77 news photos), which is why every report goes to a person.
- If the Gemini quota runs out, the app falls back to the local model or the keyword matcher and human review; it does not fail.
- A report needs GPS and internet (no offline queue).
- The rate limit is counted per server instance on Vercel (ISS-019), so it is not a hard limit yet.
- Area population and risk are sample data (ISS-020), so those two score factors are illustrative.

## If something breaks

| Problem | Do this |
|---|---|
| Phone has no signal | Submit from the laptop at `/` instead |
| Live site down | Run `npm run dev` on the laptop with the same `.env.local` |
| AI slow | Keep talking; the report is saved first and classified in the background |
