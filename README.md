# Painflame Clinic – Exercise Guide App

Physiotherapy exercise app for Painflame Clinic patients.

```
painflameTherapies/
├── mobile/     React Native patient app (Android 11+, minSdk 30)
├── admin/      Clinic admin panel (React + Vite web app)
├── supabase/   Database schema, security rules, Edge Functions, seed data
└── backend/    Old Node/Express skeleton: no longer used (Supabase replaces it)
```

**First-time setup of the server: see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).**

## How data is stored

- **Supabase** (Postgres + file storage, region Mumbai) holds patients, doctors, the Exercise
  Library with its images/videos, exercise lists, reports and tracking. Row level security
  makes sure a patient only ever sees their own data; the shared clinic login sees everything.
- **On the phone**: the login tokens (Android Keystore), fingerprint setting, theme, a local PIN
  hash for the offline lock screen, and an offline cache (SQLite) of the patient's data.
  Exercise days recorded offline are sent when the phone is back online.
- **Accounts**: the clinic creates each patient in the admin panel and gives them a one-time
  8-digit code; the patient activates the app with it and chooses a 6-digit PIN. A forgotten PIN
  is reset the same way. 5 wrong PINs lock the account for 15 minutes.
- **Exercise lists**: only therapists edit them, unless the clinic unlocks editing for that patient
  (admin panel, or the switch on the app's edit page behind the clinic password).

## Mobile app (`mobile/`)

- React Native 0.87, TypeScript, package `com.painflame.therapies`
- Several patients can use one phone; each keeps their cached data after logout.
- Server settings: `src/config/supabase.ts`.

### Source layout

```
mobile/src/
├── config/supabase.ts      Supabase URL, publishable key, clinic login e-mail
├── theme/                  Brand colours (from the logo), font sizes, spacing
├── db/                     Offline cache (SQLite) of the patient's server data
├── data/exerciseLibrary.ts Exercise Library cache
├── security/               Local PIN hash for the lock screen, fingerprint unlock
├── services/               supabase.ts (client), sync.ts (server → cache), api.ts (writes),
│                           files.ts (pickers), coach.ts (exercise session voice/sounds)
├── context/                Auth/session state, clinic password gate
├── navigation/             Screen stack
├── components/             Shared UI (buttons, fields, doctor card, doctor library, ...)
└── screens/                auth/ (login, activate, lock) and main/ (dashboard, profile, tracking, exercise list, reports)
```

### Exercise session ("Counttill")

START on the dashboard opens the guided session. Voice, sounds and keep-screen-on come from a
small app-local native module:

- JS spec: `mobile/specs/NativeCoach.ts` (codegen config in `mobile/package.json`)
- Android: `mobile/android/app/src/main/java/com/painflameapp/coach/`
- JS wrapper with Skip/End handling: `mobile/src/services/coach.ts`
- Sounds: `mobile/android/app/src/main/res/raw/whistle.wav` and `bell.wav` (synthesised; replace
  with any short WAV/MP3 of the same name)

Voice commands use the phone's built-in speech recogniser (Google). Words that start a rep:
"go", "start", "chalo", "shuru". Patients can always tap the counter instead.

### Dark theme

Toggle in the dashboard's hamburger menu. Colours live in `mobile/src/theme/index.ts`
(`lightColors` / `darkColors`); components get them through `makeStyles` / `useTheme`
in `mobile/src/theme/ThemeContext.tsx`.

### Exercise Library and Doctor Library

Managed in the admin panel (`admin/`): names, images (with the thumbnail), the 5-second video,
and doctors with photos. Therapists can also add or edit doctors in the app after entering the
clinic password (Dashboard → doctor card, or Reports → Add → Issuing doctor).

### Run in development (Android Studio)

```
cd mobile
npm install
npm start            # Metro bundler
```
Then press Run in Android Studio with `mobile/android` open (or `npm run android`).

### Build a signed release APK

```
cd mobile/android
gradlew.bat assembleRelease
```
Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`

### Signing

- Keystore: `mobile/android/app/painflame-release.keystore`
- Credentials: `mobile/android/app/keystore.properties`
- Both are git-ignored. **Back them up somewhere safe.** If they're lost you can't ship updates
  that install over the existing app.

### Tests

```
cd mobile
npm test
```

## Admin panel (`admin/`)

```
cd admin
copy .env.example .env     (fill in Supabase URL + publishable key)
npm install
npm run dev
```

Sign in with the shared clinic login. Patients, Exercise Library and Doctors pages; each patient
page has profile, exercise list (with the "patient can edit" switch), reports, tracking and
account actions (new setup code, delete). Deploy free on Netlify / Vercel / Cloudflare Pages
(build `npm run build`, output `dist`).

## Server (`supabase/`)

- `migrations/`: tables, row level security, storage buckets and policies
- `functions/`: `patient-login`, `activate-patient`, `clinic-patients` (Edge Functions)
- `seed.sql`: starter exercise names

Setup steps: [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
