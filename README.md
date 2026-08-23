# Family Portal

A private household app: budgets, debt tracking, chores, shared calendar, grocery list, house maintenance, documents, family member profiles (school/doctor/clothing sizes), and emergency contacts.

Built with Next.js 16 + Supabase (Postgres, Auth, Storage). Not indexed by search engines — this is meant to stay private to your household.

## What's here vs. what's deliberately left out

- **Debt tracking, not auto-pay.** You add debts and log payments manually. There's no bank linking (Plaid) or automated money movement — that requires real compliance/security work and shouldn't be bolted on casually. If you want to revisit that later (e.g. read-only balance syncing via Plaid), it's a separate project.
- **Multi-user, household-scoped.** Everyone signs in with their own account and joins a household via an invite code. All data is scoped to your household with Postgres row-level security — one household can never see another's data.

## Updating the database schema

[supabase/schema.sql](supabase/schema.sql) is written to be safe to re-run any time it changes — re-paste the whole file into the Supabase SQL Editor and run it again after pulling code changes that mention new tables/columns. It only adds things that are missing; it won't touch or delete existing data.

## 1. Create a Supabase project (free tier is plenty)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates every table, sets up row-level security, and creates the private `documents` storage bucket.
3. In **Project Settings > API**, copy the **Project URL** and **anon public** key.

## 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values from step 1:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
```

The first two come from **Settings > API > Project URL / Publishable key** and are safe to expose in the browser. `SUPABASE_SECRET_KEY` comes from the **Secret keys** section on that same page — it must never get a `NEXT_PUBLIC_` prefix, and is only used server-side (in `src/app/onboarding/actions.ts`) to create/join a household after the server has already verified who's asking.

## 3. Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, then create a household on the onboarding screen. Share the invite code (shown once you're in) with the rest of the family so they can join the same household.

## 4. Deploy so the whole family can use it

This repo deploys to [Netlify](https://netlify.com), which auto-detects Next.js and builds it with zero config (a `netlify.toml` pins the Node version it needs).

1. In Netlify: **Add new site > Import an existing project**, and pick the `family-portal` GitHub repo.
2. Leave the build settings as detected (build command `npm run build`) and deploy once so the site exists.
3. In **Site configuration > Environment variables**, add the same two variables from step 2 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), then trigger a redeploy so the build picks them up.
4. In **Site configuration > Domain management**, add **MahalaHQ.org** as a custom domain and follow Netlify's DNS instructions at your domain registrar (either point nameservers at Netlify DNS, or add the A/CNAME records it gives you).

Once DNS propagates, everyone in the household can sign in from their phone or laptop at `MahalaHQ.org`.

## Project structure

- `supabase/schema.sql` — full database schema + row-level security policies.
- `src/lib/supabase/` — browser/server Supabase clients and the auth session middleware.
- `src/lib/household.ts` — loads the signed-in user's household context; redirects to onboarding/login as needed.
- `src/app/(app)/` — the authenticated app, one folder per module (budget, debts, chores, calendar, groceries, maintenance, documents, family, contacts), each with a `page.tsx` and an `actions.ts` (Server Actions for mutations).
