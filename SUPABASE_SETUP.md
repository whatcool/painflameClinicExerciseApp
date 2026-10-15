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
| `20261015000000_google_login.sql` | Google sign-in for patients (app 1.2) |

If an Edge Function in `supabase/functions/` changed, redeploy it with
`npx supabase functions deploy <name>`.

## Google sign-in (app 1.2)

Patients sign in with their Google account. The first time, the app asks for their mobile number
and the 8-digit code from the clinic, which links that Google account to their record. Google
sign-in is free. Do these steps once, in order.

### A. Google Cloud (about 15 minutes)

1. Open https://console.cloud.google.com, create a project called **Painflame**.
2. **APIs & Services → OAuth consent screen**: user type **External**, app name
   *Painflame Clinic Exercise*, your support e-mail, then publish the app (**In production**).
   The scopes needed are only the default *email*, *profile* and *openid*.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, three times:

   | Type | Name | Package name | SHA-1 certificate fingerprint |
   |---|---|---|---|
   | Web application | Painflame Supabase | – | – |
   | Android | Painflame release | `com.painflame.therapies` | `23:B2:CA:61:7E:6F:30:35:46:87:C1:37:ED:0D:A6:4F:AA:AD:B4:40` |
   | Android | Painflame debug | `com.painflame.therapies.debug` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

   For the Web application client, add the redirect URI
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
   Keep the Web client's **Client ID** and **Client secret**: you need them below.
   The Android clients have nothing to copy; they only tell Google that the app is genuine.

### B. Supabase

1. **Authentication → Sign In / Providers → Google**: enable it, paste the Web **Client ID** and
   **Client secret**. Leave **Skip nonce checks** turned off (the app sends a nonce).
2. **Authentication → Sign In / Providers**: turn **on** “Allow new users to sign up”.
   Google sign-in needs this to create the account the first time. It is safe: a new account sees
   nothing until it is linked to a patient with the clinic's code.
3. SQL Editor: run `supabase/migrations/20261015000000_google_login.sql`.
4. Deploy the new function:
   `npx supabase functions deploy link-google`

### C. The app

In `mobile/src/config/supabase.ts` set `GOOGLE_WEB_CLIENT_ID` to the **Web** client ID
(it ends with `.apps.googleusercontent.com`).

### Notes

- Patients using app 1.1 (PIN) keep working until they update. After updating to 1.2 they
  tap *Continue with Google* once and link with a new code from the admin panel.
- New phone, or a different Google account: in the admin panel open the patient →
  **New phone / Google account: create new code**.
- If you ever create a new release keystore, add its SHA-1 as another Android client.
