import { query, run } from './database';

// Which patient is signed in on this phone. The login tokens themselves are kept by
// the Supabase client in the Android Keystore (see services/supabase.ts).
const SESSION_KEY = 'session_patient_id';

export function getSessionUserId(): string | null {
  const row = query<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    SESSION_KEY,
  ])[0];
  return row?.value ?? null;
}

export function setSessionUserId(patientId: string) {
  run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [SESSION_KEY, patientId]);
}

/** Ends the session only; the patient's cached data stays on the device. */
export function clearSession() {
  run('DELETE FROM app_state WHERE key = ?', [SESSION_KEY]);
}

// A local, salted hash of the PIN, so the lock screen also works offline.
const pinKey = (patientId: string) => `pin:${patientId}`;

export type StoredPin = { salt: string; hash: string; iterations: number };

export function getLocalPin(patientId: string): StoredPin | null {
  const row = query<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    pinKey(patientId),
  ])[0];
  return row ? JSON.parse(row.value) : null;
}

export function setLocalPin(patientId: string, pin: StoredPin) {
  run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
    pinKey(patientId),
    JSON.stringify(pin),
  ]);
}
