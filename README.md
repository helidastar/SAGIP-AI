# SAGIP-AI — Developer Setup

Everything a developer needs to get the app running. Follow the steps in order.
This branch holds only this file. The code lives on `development`.

Ask **Charity ([@helidastar](https://github.com/helidastar))** for anything marked "ask Charity".

---

## 1. Get access (ask Charity)

| What | Why | How you get it |
|---|---|---|
| GitHub repository | To pull and push code | Invite as a collaborator, accept the email |
| Supabase project | Database, photo storage, staff logins | Invite to the organization (Developer role) |
| Staff account | To open the dashboard | Charity creates it, then sends you a temporary password |

## 2. Install

- [Node.js](https://nodejs.org) 20 or newer (check: `node -v`)
- [Git](https://git-scm.com)
- [VS Code](https://code.visualstudio.com) or any editor

## 3. Get the code

```bash
git clone https://github.com/helidastar/SAGIP-AI.git
cd SAGIP-AI
git checkout development
npm install
```

## 4. Create the `.env` file (ask Charity)

Copy `.env.example` to a new file named **`.env.local`** in the project root, then fill it in.
`.env.local` is git-ignored, so it stays on your computer. Never paste keys in the group chat.

After accepting the Supabase invite you can copy most values yourself:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key (secret, full database access) |
| `DATABASE_URL`, `DIRECT_URL` | Supabase → Connect (contains the database password) |
| `AI_PROVIDER` | type `mock` |
| `AI_API_KEY` | leave empty while `AI_PROVIDER=mock` |

Leave every other line as it is.

**Keep `AI_PROVIDER=mock` for normal work.** The team uses the free Gemini tier, which has a small
daily limit. Mock mode uses none of it, and reports simply go to human review. Only if you need to
test the real AI: get your **own** free key at [aistudio.google.com](https://aistudio.google.com),
then set `AI_PROVIDER=gemini`, `AI_API_KEY=<your key>`, `AI_MODEL=gemini-3.1-flash-lite`.
Do not link a billing account, so it can never charge you.

## 5. Run it

```bash
npm run dev
```

Open http://localhost:3000

| Page | URL | Login needed |
|---|---|---|
| Report an incident | `/` | no |
| Track a report | `/track` | no |
| Staff login | `/login` | yes |
| Dashboard (ranked list and map) | `/dashboard` | yes |
| Review queue | `/dashboard/review` | yes |

The interface is a temporary wireframe for testing. The final design is still being made.

## 6. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run seed` | Load teams and areas into Supabase |
| `npm run make-admin -- <email>` | Give a Supabase user a staff role (add `--role responder` to test the other role) |
| `npm run benchmark -- --dry-run` | Check the labeled AI benchmark photos, free |
| `npm run dataset:prepare -- --dry-run` | Check training photos before building the dataset |
| `npm run export:training-data -- --dry-run` | Preview exporting reviewed reports as new training data |
| `npm run lint` / `npm run build` | Check the code before opening a pull request |

## 7. How we work

1. Start from the latest `development`:
   ```bash
   git checkout development
   git pull origin development
   ```
2. Work on your own branch: `git checkout -b feat/<area>`, for example `feat/ui-dashboard`. AI work goes on `feat/ai`.
3. One-line commit messages: `type(scope): what changed`, for example `fix(ui): correct map marker size`.
4. Push your branch and open a pull request **into `development`**, never into `main`.
   `main` is protected and needs one approval.
5. No emojis in documentation. Keep it formal.

**Shared database:** everyone uses the same Supabase project. Do not run migrations or delete tables
without telling the team. Delete any junk test data you create.

## 8. If something breaks

| Problem | Fix |
|---|---|
| `Another next dev server is already running` | It is already running; open http://localhost:3000 |
| "Invalid email or password" | Check the account exists in Supabase → Authentication → Users |
| "This account is not registered as staff" | Ask Charity to run `npm run make-admin -- <your email>` |
| Reports stay on "Report received" | Check the `npm run dev` terminal for errors. With `AI_PROVIDER=mock` they should move within seconds |
| Pages load but no data appears | Compare `.env.local` with `.env.example`, then restart `npm run dev` |
| Teammates' changes are missing | `git pull origin development`, then `npm install` |

## 9. More detail

On the `development` branch:

- `docs/ONBOARDING.md` — the longer onboarding guide
- `docs/DOCUMENTATION.md` — architecture, data model, API endpoints
- `docs/handoffs/ai-benchmarking.md` — AI results and what is still untested
- `training/README.md` — training our own AI model
