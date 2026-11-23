# Launch runbook

The product owner follows this once, to put Askwell live on production (project.md §4, plan.md Phase 6).
It names variables only. Values live in the Supabase, Clerk, OpenAI, Arcjet and PostHog dashboards, and in Vercel. Never paste a value into a chat, a PR or this file.

**Before you start**

- [ ] Every Phase 6 PR is merged to `main`. The latest `main` build in Vercel is **Ready** (not promoted).
- [ ] The core flow passed on the latest `main` preview (PR for P6H-T05).
- [ ] You can sign in to Supabase, Vercel and Clerk (the same Clerk instance as dev: production keeps Clerk **test** keys, §9).

---

## 1. Create the Supabase prod project

1. Supabase dashboard → **New project**.
   - Organization: the same one as the dev project.
   - Name: `askwell-prod`.
   - Database password: generate one and keep it in your password manager. You need it in step 2.
   - Region: the same region as the dev project (Project Settings → General on dev shows it). Vercel functions run in `iad1` (Washington, D.C.), so **East US (North Virginia)** is the best fit if you're choosing.
   - Click **Create new project** and wait until it's ready.
2. **pgvector:** nothing to do by hand. The first migration runs `create extension if not exists vector with schema extensions`. To check it after step 2: Database → Extensions → `vector` is on.
3. **Clerk as third-party auth** (the same setup as dev):
   1. Clerk dashboard → the Askwell instance (the one dev uses) → **Integrations** → **Supabase**. It's already active from dev. Copy the **Clerk domain** it shows (`https://<something>.clerk.accounts.dev`).
   2. Supabase prod project → **Authentication** → **Sign In / Providers** → **Third Party Auth** → **Add provider** → **Clerk**.
   3. Paste the Clerk domain → **Create connection**.
4. **Data API:** Project Settings → **Data API**. Leave the exposed schemas as they are (`public`). Don't turn on aggregate functions (§9).
5. **Keys:** Project Settings → **API Keys**. You'll copy three values into Vercel in step 3:
   - the **Project URL** (Project Settings → Data API, or the project's Connect dialog),
   - the **publishable key** (`sb_publishable_…`),
   - a **secret key** (`sb_secret_…`; create one if the list is empty).

## 2. Apply every migration

The migrations are in `supabase/migrations`. Apply all of them, oldest first:

| # | File |
|---|---|
| 1 | `20261109175804_init.sql` |
| 2 | `20261110114736_functions.sql` |
| 3 | `20261112101326_knowledge_bucket.sql` |

If `main` gets more files in `supabase/migrations` before you launch, apply those too, in name order.

**Option A: Supabase CLI (recommended, it records each version)**

1. On your machine, check out the latest `main`.
2. Supabase prod project → **Connect** → **Connection string** → **Session pooler**. Copy it and put your database password in it.
3. From the repo root:
   ```bash
   npx supabase db push --db-url "<prod session pooler connection string>"
   ```
4. It lists the 3 migrations and asks to confirm. Type `Y`. It ends with `Finished supabase db push.`
5. Run it again. It must say the remote database is up to date.

**Option B: SQL editor (if the CLI won't run)**

1. Supabase prod project → **SQL Editor** → **New query**.
2. Paste the whole of file 1, click **Run**, and wait for `Success`. Then do the same for file 2, then file 3. Don't skip a file or change the order.
3. Record the versions, so a later `db push` doesn't run them again:
   ```bash
   npx supabase migration repair --db-url "<prod connection string>" --status applied 20261109175804 20261110114736 20261112101326
   ```

**Check (either option):** in the SQL editor, run:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'knowledge';
select count(*) as tables from pg_tables where schemaname = 'public';
```

- The first query returns one row: `knowledge`, `public = false`, `10485760`, `{application/pdf,text/markdown,text/plain}`.
- Storage in the dashboard also lists the **knowledge** bucket as private.
- Table Editor lists `accounts`, `projects`, `widget_configs`, `knowledge_sources`, `knowledge_chunks`, `conversations`, `messages` (the `tables` count is 7).

## 3. Set Vercel Production variables

Vercel → askwell project → **Settings** → **Environment Variables**.

Change the **Production** values only. Preview and Development must keep pointing at the dev project (§11). If a variable is one row for all environments, edit it, untick Production, save, then add a new Production-only row for it.

| Variable (§11) | Production value comes from | Same as dev? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase **prod** → Project URL (step 1.5) | No: prod |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase **prod** → API Keys → publishable key | No: prod |
| `SUPABASE_SECRET_KEY` | Supabase **prod** → API Keys → secret key. Mark it **Sensitive**. | No: prod |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API keys (the `pk_test_` key, §9 test keys only) | Yes |
| `CLERK_SECRET_KEY` | Clerk → API keys (the `sk_test_` key). Sensitive. | Yes |
| `CLERK_WEBHOOK_SIGNING_SECRET` | The **new** production webhook endpoint (step 4). Sensitive. | No: its own endpoint |
| `OPENAI_API_KEY` | OpenAI → API keys. Sensitive. | Yes |
| `ARCJET_KEY` | Arcjet dashboard → the Askwell site → SDK key. Sensitive. | Yes |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project settings → Project API key | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (e.g. `https://us.i.posthog.com`) | Yes |
| `NEXT_PUBLIC_APP_URL` | The production URL, no trailing slash. Vercel → Settings → **Domains** (e.g. `https://askwell-<team>.vercel.app` or your own domain) | No: prod URL |
| `LANDING_WIDGET_KEY` | Leave **empty** for now. Step 6 sets it. | No: a prod project's key |

Notes:

- Never put `VERCEL_AUTOMATION_BYPASS_SECRET` or any other variable in Production unless this table lists it.
- `NEXT_PUBLIC_*` values are built into the app. Any change needs a new build (step 5 does one).

## 4. Clerk webhook for production

1. Clerk dashboard → the same instance → **Configure** → **Webhooks** → **Add Endpoint**.
2. Endpoint URL: `<NEXT_PUBLIC_APP_URL>/api/clerk/webhook` (e.g. `https://askwell-<team>.vercel.app/api/clerk/webhook`).
3. Subscribe to every **`subscriptionItem.*`** event (the same events as the dev endpoint). The route only acts on those.
4. Click **Create**.
5. On the new endpoint's page, copy the **Signing Secret** (`whsec_…`).
6. Vercel → Environment Variables → `CLERK_WEBHOOK_SIGNING_SECRET` → **Production** only → paste → Save.

Keep the dev endpoint as it is. Both endpoints get every event from the shared Clerk instance. Each one writes only to its own database.

## 5. Promote the build

The `main` build that's already in Vercel was built with the old Production values. Build it again first:

1. Vercel → **Deployments** → filter Environment: **Production** → the newest deployment from `main` (its commit is the latest on `main`).
2. **⋯** → **Redeploy**. Untick **Use existing Build Cache**. Click **Redeploy** and wait for **Ready**.
3. On that new deployment: **⋯** → **Promote** → confirm. Production now serves it.
4. Check that the public can open it: open the production URL in a private window. It must load the landing page without a Vercel login. If it asks for one: Settings → **Deployment Protection** → make sure Vercel Authentication covers **Preview deployments only**, not production. (`/widget.js` must load on any customer's site.)

## 6. Landing widget bootstrap

The landing page's widget needs a project in the **prod** database.

1. Open the production URL → **Sign up**. Use the email you'll own the Askwell project with.
2. Dashboard → **Create project** → name it `Askwell`.
3. **Knowledge** → upload `docs/askwell-knowledge.md` from the repo. Wait until it says **Ready**.
4. **Install** → copy the project's public key (the `pk_…` value inside `data-key="…"`).
5. Vercel → Environment Variables → `LANDING_WIDGET_KEY` → **Production** only → paste → Save.
6. Deployments → the production deployment → **⋯** → **Redeploy** (Vercel only applies a variable change to a new deployment). Once it's **Ready**, promote it if Vercel doesn't do it by itself (it shows **Current** next to the live one).
7. Open the production URL. The chat button is in the corner. Ask "How much is Pro?" It answers $19 per month.

## 7. Core flow on production (§2)

Use a fresh account for this, not the Askwell owner account. A Clerk test email works: `you+clerk_test@example.com`, code `424242`. Tick each step:

- [ ] **1.** Open the production URL. The Askwell chat widget is in the corner.
- [ ] **2.** Ask it a product question (e.g. "What file types can I upload?"). It answers from its knowledge.
- [ ] **3.** Sign up. Create a project. Upload a product PDF in **Knowledge**. It reaches **Ready**.
- [ ] **4.** **Install** → copy the script tag. Paste it into a plain HTML file and open that from another origin (e.g. `npx serve` in that folder, then `http://localhost:3000`). The widget button appears.
- [ ] **5.** Ask a question on that page whose answer is only in the PDF. The answer comes from the PDF.
- [ ] **6.** Dashboard → **Conversations**. The chat from step 5 is there.
- [ ] **7.** **Customize**. It shows the Pro paywall.
- [ ] **8.** **Billing** → upgrade to Pro with Clerk's test card ("Pay with test card", or `4242 4242 4242 4242`, any future date, any CVC). Customize unlocks.
- [ ] **9.** Change the button color → Save. Reload the HTML page. The button has the new color.

Also check:

- [ ] Supabase prod → Table Editor → `accounts`: the test account's `plan` is `pro`.
- [ ] Clerk → Webhooks → the production endpoint: the `subscriptionItem.*` deliveries succeeded (200).

If a step fails, don't fix it on production. Roll back (below) if it's serious, and send the lead what you saw.

## Rollback

Vercel keeps every deployment. Rolling back points production at an older one. No rebuild is needed.

1. Vercel → **Deployments** → filter Environment: **Production**.
2. Find the last deployment that worked (it says **Current** until you promote another).
3. **⋯** → **Promote** (or **Instant Rollback** from the project's overview). Confirm.
4. Open the production URL in a private window and check the landing page loads.

Notes:

- On the very first launch there's no earlier production deployment. Rolling back then means taking the site down: Settings → Deployment Protection → protect production too, until a fix is promoted.
- A rollback doesn't undo migrations. They're additive (§4), so an older build keeps working on the newer schema.
- A rollback keeps the current environment variables, but an old build still has the `NEXT_PUBLIC_*` values it was built with.
