import { query, run } from './database';

export type Gender = 'Male' | 'Female' | 'Other';

/** The signed-in patient, as cached on this phone from Supabase. */
export type User = {
  id: string;
  mobile: string;
  fullName: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  photoPath: string | null;
  photoUrl: string | null; // signed URL, refreshed on every sync
  doctorId: string | null;
  canEditExercises: boolean;
  counttillTourDone: boolean;
  createdAt: string; // ISO timestamp
  biometricEnabled: boolean; // device setting, never leaves the phone
};

type PatientRow = {
  id: string;
  mobile: string;
  full_name: string;
  gender: Gender;
  dob: string;
  photo_path: string | null;
  photo_url: string | null;
  doctor_id: string | null;
  can_edit_exercises: number;
  counttill_tour_done: number;
  created_at: string;
};

/** Shape of a row from the server's `patients` table. */
export type ServerPatient = {
  id: string;
  mobile: string;
  full_name: string;
  gender: Gender;
  dob: string;
  photo_path: string | null;
  doctor_id: string | null;
  can_edit_exercises: boolean;
  counttill_tour_done: boolean;
  created_at: string;
};

const biometricKey = (id: string) => `biometric:${id}`;

export function getUser(id: string): User | null {
  const row = query<PatientRow>('SELECT * FROM patients WHERE id = ?', [id])[0];
  if (!row) {
    return null;
  }
  const biometric = query<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    biometricKey(id),
  ])[0];
  return {
    id: row.id,
    mobile: row.mobile,
    fullName: row.full_name,
    gender: row.gender,
    dob: row.dob,
    photoPath: row.photo_path,
    photoUrl: row.photo_url,
    doctorId: row.doctor_id,
    canEditExercises: row.can_edit_exercises === 1,
    counttillTourDone: row.counttill_tour_done === 1,
    createdAt: row.created_at,
    biometricEnabled: biometric?.value === '1',
  };
}

export function cachePatient(patient: ServerPatient, photoUrl: string | null) {
  run(
    `INSERT OR REPLACE INTO patients
       (id, mobile, full_name, gender, dob, photo_path, photo_url, doctor_id,
        can_edit_exercises, counttill_tour_done, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patient.id,
      patient.mobile,
      patient.full_name,
      patient.gender,
      patient.dob,
      patient.photo_path,
      photoUrl,
      patient.doctor_id,
      patient.can_edit_exercises ? 1 : 0,
      patient.counttill_tour_done ? 1 : 0,
      patient.created_at,
    ],
  );
}

/** Updates cached fields after a successful server write. */
export function updateCachedPatient(
  id: string,
  changes: Partial<{
    full_name: string;
    gender: Gender;
    dob: string;
    photo_path: string | null;
    photo_url: string | null;
    doctor_id: string | null;
    can_edit_exercises: boolean;
    counttill_tour_done: boolean;
  }>,
) {
  for (const [column, value] of Object.entries(changes)) {
    const stored = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    run(`UPDATE patients SET ${column} = ? WHERE id = ?`, [stored ?? null, id]);
  }
}

export function setBiometricEnabled(id: string, enabled: boolean) {
  run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
    biometricKey(id),
    enabled ? '1' : '0',
  ]);
}
