import { query, run } from './database';

const SESSION_KEY = 'session_user_id';

export function getSessionUserId(): number | null {
  const row = query<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    SESSION_KEY,
  ])[0];
  return row ? Number(row.value) : null;
}

export function setSessionUserId(userId: number) {
  run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
    SESSION_KEY,
    String(userId),
  ]);
}

/** Ends the session only; the patient's data stays on the device under their mobile number. */
export function clearSession() {
  run('DELETE FROM app_state WHERE key = ?', [SESSION_KEY]);
}
