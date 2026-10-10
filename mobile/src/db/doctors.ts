import { query, run } from './database';

export type Doctor = {
  id: number;
  fullName: string;
  contact: string;
  photoUri: string | null;
  startMonth: number; // 1-12, month they started at Painflame
  startYear: number;
};

export type DoctorInput = Omit<Doctor, 'id'>;

type DoctorRow = {
  id: number;
  full_name: string;
  contact: string;
  photo_uri: string | null;
  start_month: number;
  start_year: number;
};

const toDoctor = (row: DoctorRow): Doctor => ({
  id: row.id,
  fullName: row.full_name,
  contact: row.contact,
  photoUri: row.photo_uri,
  startMonth: row.start_month,
  startYear: row.start_year,
});

export function listDoctors(): Doctor[] {
  return query<DoctorRow>('SELECT * FROM doctors ORDER BY full_name COLLATE NOCASE').map(
    toDoctor,
  );
}

export function getDoctor(id: number): Doctor | null {
  const row = query<DoctorRow>('SELECT * FROM doctors WHERE id = ?', [id])[0];
  return row ? toDoctor(row) : null;
}

export function addDoctor(input: DoctorInput): Doctor {
  const result = run(
    `INSERT INTO doctors (full_name, contact, photo_uri, start_month, start_year, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.fullName,
      input.contact,
      input.photoUri,
      input.startMonth,
      input.startYear,
      new Date().toISOString(),
    ],
  );
  return getDoctor(result.insertId!)!;
}

export function updateDoctor(id: number, input: DoctorInput) {
  run(
    `UPDATE doctors SET full_name = ?, contact = ?, photo_uri = ?, start_month = ?, start_year = ?
     WHERE id = ?`,
    [input.fullName, input.contact, input.photoUri, input.startMonth, input.startYear, id],
  );
}
