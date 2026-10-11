import { query, run, transaction } from './database';

export type Doctor = {
  id: string;
  fullName: string;
  contact: string;
  photoUrl: string | null;
  startMonth: number; // 1-12, month they started at Painflame
  startYear: number;
};

type DoctorRow = {
  id: string;
  full_name: string;
  contact: string;
  photo_url: string | null;
  start_month: number;
  start_year: number;
};

const toDoctor = (row: DoctorRow): Doctor => ({
  id: row.id,
  fullName: row.full_name,
  contact: row.contact,
  photoUrl: row.photo_url,
  startMonth: row.start_month,
  startYear: row.start_year,
});

export function listDoctors(): Doctor[] {
  return query<DoctorRow>('SELECT * FROM doctors ORDER BY full_name COLLATE NOCASE').map(
    toDoctor,
  );
}

export function getDoctor(id: string): Doctor | null {
  const row = query<DoctorRow>('SELECT * FROM doctors WHERE id = ?', [id])[0];
  return row ? toDoctor(row) : null;
}

export function cacheDoctors(doctors: Doctor[]) {
  transaction(() => {
    run('DELETE FROM doctors');
    for (const d of doctors) {
      run(
        `INSERT INTO doctors (id, full_name, contact, photo_url, start_month, start_year)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.id, d.fullName, d.contact, d.photoUrl, d.startMonth, d.startYear],
      );
    }
  });
}

export function cacheDoctor(d: Doctor) {
  run(
    `INSERT OR REPLACE INTO doctors (id, full_name, contact, photo_url, start_month, start_year)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [d.id, d.fullName, d.contact, d.photoUrl, d.startMonth, d.startYear],
  );
}
