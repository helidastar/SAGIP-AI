# Team Onboarding

How to get SAGIP-AI running on your computer and start contributing. Follow the steps in order.
This guide contains **no secrets**. Never put keys or passwords in the repository, screenshots, or the group chat.

**Related:** full documentation → [DOCUMENTATION.md](DOCUMENTATION.md) · AI status and test log → [handoffs/ai-benchmarking.md](handoffs/ai-benchmarking.md) · training data → [training/README.md](../training/README.md)

---

## 1. Access you need

Ask Charity ([@helidastar](https://github.com/helidastar)) for:

| Access | How you get it | What to do |
|---|---|---|
| GitHub repository | Invite as a collaborator | Accept the email invite from GitHub |
| Supabase project | Invite to the organization (Developer role) | Accept the email invite, then open the SAGIP-AI project |
| Staff account for the dashboard | Created in Supabase, then given a role | You receive an email and a temporary password; change it after signing in |

## 2. Install the tools

- [Node.js](https://nodejs.org) 20 or newer (check with `node -v`)
- [Git](https://git-scm.com)
- A code editor, e.g. [VS Code](https://code.visualstudio.com)

## 3. Get the code

```bash
git clone https://github.com/helidastar/SAGIP-AI.git
cd SAGIP-AI
git checkout development
npm install
```

`development` is the shared working branch. `main` only receives tested work through pull requests.

## 4. Create `.env.local`

Copy `.env.example` to a new file named `.env.local` in the project root, then fill in the values below.
`.env.local` is git-ignored, so it stays on your computer.

| Variable | Where to get it | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | **Yes**: full database access |
| `DATABASE_URL` | Supabase → Connect → connection string (pooled) | **Yes**: contains the database password |
| `DIRECT_URL` | Supabase → Connect → connection string (direct) | **Yes** |
| `AI_PROVIDER` | Set to `mock` | No |
| `AI_API_KEY` | Leave empty while `AI_PROVIDER=mock` | Yes |

Leave every other variable in `.env.example` as it is; the defaults work.

### About the AI key
- Keep `AI_PROVIDER=mock` for normal work. Reports then go straight to human review and **no AI quota is used**.
- The team uses the **free** Gemini tier only, which has a small daily limit. Do not share one key: everyone would use up the same quota.
- Only if you need to test the real AI: create your **own** free key at [aistudio.google.com](https://aistudio.google.com) (Get API key), then set `AI_PROVIDER=gemini`, `AI_API_KEY=<your key>` and `AI_MODEL=gemini-3.1-flash-lite`. Do not link a billing account to that Google project; without billing it can never charge you.

## 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Page | URL | Account |
|---|---|---|
| Report an incident | `/` | none |
| Confirmation | `/submitted?code=SGP-XXXXXX` | none |
| Track a report | `/track` | none |
| Staff login | `/login` | staff account |
| Ranked list and map | `/dashboard` | staff account |
| Review queue | `/dashboard/review` | staff account |
| Incident detail | `/dashboard/incidents/<id>` | staff account |

The current UI follows the initial wireframe sketch and is **for testing only**. The final design is still being worked on.

## 6. Staff accounts

Accounts are created by someone with Supabase access:

1. Supabase → **Authentication → Users → Add user** (email and a temporary password, auto-confirm on).
2. Give the account a role:

```bash
npm run make-admin -- someone@example.com --name "Full Name"
npm run make-admin -- someone@example.com --role responder
```

### Scripts you should know
| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run seed` | Load teams and areas into Supabase |
| `npm run make-admin -- <email>` | Set a staff role |
| `npm run benchmark -- --dry-run` | Check the labeled benchmark photos, free |
| `npm run dataset:prepare -- --dry-run` | Check training photos before building the dataset |
| `npm run export:training-data -- --dry-run` | Preview exporting reviewed reports into `training/raw/` as new training data |

`export:training-data` turns the review queue into free, human-checked training labels. Run it about
once a week, then re-run `dataset:prepare` before the next training run. It downloads real citizen
photos, so treat them as private and remove or blur identifying details.

`admin` can assign teams, override scores and re-run the AI. `responder` can review reports and update incidents assigned to their team. Test with both roles.

## 7. How we work

### Branches
1. Always start from the latest `development`:
   ```bash
   git checkout development
   git pull origin development
   ```
2. Create your own branch named `feat/<area>`, for example `feat/ui-dashboard` or `feat/backend-teams`:
   ```bash
   git checkout -b feat/<area>
   ```
3. AI work stays on `feat/ai`.
4. Before each work session, bring in the latest changes:
   ```bash
   git pull origin development
   ```
5. When a part is done, push your branch and open a pull request **into `development`**, never into `main`:
   ```bash
   git push origin feat/<area>
   ```

### Commit messages
One line, in the form `type(scope): what changed`. Examples:
- `feat(ui): add team filter to ranked list`
- `fix(backend): reject reports without a location`
- `docs(ai): log benchmark results`

Types: `feat`, `fix`, `refactor`, `docs`, `test`. Scopes: `ui`, `backend`, `ai`, `db`, `auth`, `docs`.

### Documentation
- Update the docs when you change how something works.
- No emojis in any documentation; keep it formal.
- Log AI tests and results in [handoffs/ai-benchmarking.md](handoffs/ai-benchmarking.md) (newest entry at the top).

### Shared database rules
Everyone uses the **same** Supabase project.
- Do not run database migrations or delete tables without telling the team first.
- Test reports are fine. Mention in the team chat if you create a lot of them, and delete junk data you created.
- Do not change other people's staff accounts.

## 8. What to test first

These have never been tested end to end:

1. **Citizen flow on a real phone** over mobile data: report with a photo, confirmation, tracking.
2. **Staff login and logout**, as admin and as responder.
3. **Review queue**: confirm and reject reports; check they leave the queue and get a priority.
4. **Incident detail**: assign a team, override the score, change status, re-run the AI (admin).
5. **Ranked list and map**: filters, ordering by priority, clicking a map marker.

When you find a bug, note: the page, what you did, what happened, and what you expected. Add it to the team tracker or open a GitHub issue.

## 9. Common problems

| Problem | Fix |
|---|---|
| `Another next dev server is already running` | Another copy is running. Close it, or use the one at `http://localhost:3000` |
| Login says "Invalid email or password" | Check the account exists in Supabase → Authentication → Users |
| Login says "This account is not registered as staff" | Run `npm run make-admin -- <email>` |
| Reports stay "Report received" forever | Check the terminal running `npm run dev` for errors; with `AI_PROVIDER=mock` they should move to review within seconds |
| Pages fail to load data, or Supabase errors in the terminal | Compare your `.env.local` with `.env.example`, then restart `npm run dev` |
| Changes from teammates are missing | `git pull origin development`, then `npm install` |
