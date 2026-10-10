# Painflame Clinic – Exercise Guide App

Physiotherapy exercise app for Painflame Clinic patients.

```
painflameTherapies/
├── mobile/    React Native app (Android 11+, minSdk 30)
└── backend/   Node.js + Express API (not used by the app yet)
```

## Mobile app (`mobile/`)

- React Native 0.87, TypeScript, package `com.painflame.therapies`
- All data is stored on the phone (SQLite). Several patients can use one phone; each
  account is identified by its mobile number and keeps its own data after logout.

### Source layout

```
mobile/src/
├── config/therapist.ts     Doctor's password (the only place it is defined)
├── theme/                  Brand colours (from the logo), font sizes, spacing
├── db/                     SQLite schema + data access (users, doctors, exercise lists, reports, tracking)
├── data/exerciseLibrary.ts Exercise Library (bundled seed data)
├── security/               PIN hashing (PBKDF2-SHA256, salted), fingerprint unlock
├── services/files.ts       Pick images/PDFs and copy them into app storage
├── context/                Auth/session state, therapist password gate
├── navigation/             Screen stack
├── components/             Shared UI (buttons, fields, doctor card, doctor library, ...)
└── screens/                auth/ (login, sign-up, lock) and main/ (dashboard, profile, tracking, exercise list, reports)
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

### Exercise Library (adding exercises)

Edit `mobile/src/data/exerciseLibrary.ts`. Put images and the 5-second video in
`mobile/src/assets/exercises/` and reference them with `require(...)`. `thumbnailIndex` picks
which image is the thumbnail. Never change an existing exercise `id` (patients' lists store it).
Until images are added, the list shows the exercise's initials.

### Doctor Library

Managed inside the app, behind the doctor's password: Dashboard → doctor card → Add/Change,
or Reports → Add → Issuing doctor. Both screens let the clinic add or edit doctors.

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

## Backend (`backend/`)

```
cd backend
npm install
copy .env.example .env
npm run dev
```

Health check: `GET http://localhost:3000/api/health`
