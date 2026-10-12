# Supabase setup (one time, about 30 minutes)

Everything the app stores now lives in Supabase (free plan). Do these steps once, in order.

## 1. Create the project

1. Sign up at https://supabase.com (free plan is enough).
2. **New project** → name it `painflame`, choose region **South Asia (Mumbai)** so data stays in India,
   and save the database password somewhere safe.

## 2. Create the database

In the dashboard open **SQL Editor** → **New query**:

1. Paste all of `supabase/migrations/20261011000000_init.sql` and click **Run**.
2. New query: paste `supabase/seed.sql` (the starter exercise names) and **Run**.

## 3. Lock down sign-ups and create the clinic login

1. **Authentication → Sign In / Providers**: turn **off** “Allow new users to sign up”.
   (Patients are created only by the clinic; the clinic login is created below.)
2. **Authentication → Users → Add user → Create new user**: e-mail `clinic@painflame.com`
   (or your own), a strong password, tick **Auto confirm user**.
3. SQL Editor, run (use the same e-mail):

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "clinic"}'
   where email = 'clinic@painflame.com';
   ```

   This is the shared login for the admin panel, and the password therapists type in the app.
4. **Authentication → Rate Limits**: raise “sign-ups and sign-ins” to about **100 per 5 minutes**.
   All patient logins go through one server function, so they share this limit.

## 4. Deploy the server functions

From the project root on your PC (Node is already installed):

```
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set PIN_PEPPER=PASTE-A-LONG-RANDOM-STRING
npx supabase functions deploy patient-login activate-patient clinic-patients
```

- `YOUR-PROJECT-REF` is in the dashboard URL: `supabase.com/dashboard/project/<ref>`.
- For `PIN_PEPPER` use 40+ random characters (e.g. from a password manager).
  **Keep a copy and never change it**: every patient's PIN depends on it.

## 5. Connect the patient app

Edit `mobile/src/config/supabase.ts`:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: **Project Settings → API Keys**
  (the *publishable* key, or the legacy *anon* key; never the secret/service_role key).
- `CLINIC_LOGIN_EMAIL`: the clinic e-mail from step 3.

## 6. Run and publish the admin panel

```
cd admin
copy .env.example .env      (then fill in the same URL and publishable key)
npm install
npm run dev                 (opens http://localhost:5173)
```

To put it online for free: create a site on **Netlify**, **Vercel** or **Cloudflare Pages** from
the `admin` folder with build command `npm run build`, output folder `dist`, and the two
`VITE_SUPABASE_...` values as environment variables.

## 7. First use

1. Sign in to the admin panel with the clinic login.
2. **Doctors**: add your doctors with photos.
3. **Exercise Library**: add images (pick the thumbnail) and the 5-second video for each exercise.
4. **Patients → New patient**: enter the details; the panel shows an **8-digit code**.
5. On the patient's phone: **Activate with clinic code** → mobile number, code, new PIN, consent.
6. Forgotten PIN or new phone: open the patient in the admin panel → **Forgot PIN: create new code**.

## Good to know

- **Free plan limits**: 500 MB database, 1 GB files, 5 GB transfer per month: plenty for a clinic.
  A free project pauses after 7 days with **no** activity; daily patient use keeps it awake.
  If it pauses, click **Restore** in the dashboard.
- **Backups**: the free plan has no downloadable backups. Once a month run
  `npx supabase db dump --linked -f backup.sql` (and keep the file safe), or upgrade to Pro ($25/month).
- **Who sees what**: patients only ever see their own data; the clinic login sees everything.
  These rules are enforced by the database itself (row level security), not just by the app.

## Applying later updates

When a new file appears in `supabase/migrations/`, run it once in **SQL Editor** (paste the file,
click **Run**), in date order. The migrations so far:

| File | What it adds |
|---|---|
| `20261011000000_init.sql` | Everything (initial setup) |
| `20261012000000_exercise_description.sql` | “Instructions for the patient” text on each exercise |

If an Edge Function in `supabase/functions/` changed, redeploy it with
`npx supabase functions deploy <name>`.
