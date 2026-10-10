import { hashPin, verifyPin } from '../security/pin';
import { query, run } from './database';

export type Gender = 'Male' | 'Female' | 'Other';

export type User = {
  id: number;
  mobile: string;
  fullName: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  photoUri: string | null;
  biometricEnabled: boolean;
  doctorId: number | null;
  createdAt: string; // ISO timestamp
  counttillTourDone: boolean;
};

type UserRow = {
  id: number;
  mobile: string;
  full_name: string;
  gender: Gender;
  dob: string;
  photo_uri: string | null;
  biometric_enabled: number;
  doctor_id: number | null;
  created_at: string;
  counttill_tour_done: number;
  pin_salt: string;
  pin_hash: string;
  pin_iterations: number;
};

const toUser = (row: UserRow): User => ({
  id: row.id,
  mobile: row.mobile,
  fullName: row.full_name,
  gender: row.gender,
  dob: row.dob,
  photoUri: row.photo_uri,
  biometricEnabled: row.biometric_enabled === 1,
  doctorId: row.doctor_id,
  createdAt: row.created_at,
  counttillTourDone: row.counttill_tour_done === 1,
});

export function getUser(id: number): User | null {
  const row = query<UserRow>('SELECT * FROM users WHERE id = ?', [id])[0];
  return row ? toUser(row) : null;
}

export function mobileExists(mobile: string) {
  return query('SELECT id FROM users WHERE mobile = ?', [mobile]).length > 0;
}

export async function createUser(input: {
  mobile: string;
  fullName: string;
  gender: Gender;
  dob: string;
  pin: string;
}): Promise<User> {
  const pin = await hashPin(input.pin);
  const result = run(
    `INSERT INTO users (mobile, full_name, gender, dob, pin_salt, pin_hash, pin_iterations, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.mobile,
      input.fullName,
      input.gender,
      input.dob,
      pin.salt,
      pin.hash,
      pin.iterations,
      new Date().toISOString(),
    ],
  );
  return getUser(result.insertId!)!;
}

/** Returns the user if the mobile number and PIN match, otherwise null. */
export async function checkCredentials(mobile: string, pin: string): Promise<User | null> {
  const row = query<UserRow>('SELECT * FROM users WHERE mobile = ?', [mobile])[0];
  if (!row) {
    return null;
  }
  const ok = await verifyPin(pin, {
    salt: row.pin_salt,
    hash: row.pin_hash,
    iterations: row.pin_iterations,
  });
  return ok ? toUser(row) : null;
}

export function updateProfile(
  id: number,
  changes: { fullName: string; gender: Gender; dob: string },
) {
  run('UPDATE users SET full_name = ?, gender = ?, dob = ? WHERE id = ?', [
    changes.fullName,
    changes.gender,
    changes.dob,
    id,
  ]);
}

export function setPhoto(id: number, photoUri: string | null) {
  run('UPDATE users SET photo_uri = ? WHERE id = ?', [photoUri, id]);
}

export function setBiometricEnabled(id: number, enabled: boolean) {
  run('UPDATE users SET biometric_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

export function setDoctor(id: number, doctorId: number) {
  run('UPDATE users SET doctor_id = ? WHERE id = ?', [doctorId, id]);
}

export function setCounttillTourDone(id: number) {
  run('UPDATE users SET counttill_tour_done = 1 WHERE id = ?', [id]);
}
