import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';

let db: DB | null = null;

// Each entry upgrades the schema by one version. Append new migrations; never edit old ones.
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      dob TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_iterations INTEGER NOT NULL,
      photo_uri TEXT,
      biometric_enabled INTEGER NOT NULL DEFAULT 0,
      doctor_id INTEGER REFERENCES doctors(id),
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      photo_uri TEXT,
      start_month INTEGER NOT NULL,
      start_year INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE patient_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      hold_seconds INTEGER NOT NULL
    )`,
    `CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      report_date TEXT NOT NULL,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      file_uri TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT,
      created_at TEXT NOT NULL
    )`,
    // One row per day the patient exercised. No row = nothing done (red dot).
    `CREATE TABLE exercise_days (
      user_id INTEGER NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('complete', 'partial')),
      PRIMARY KEY (user_id, day)
    )`,
    `CREATE TABLE app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  ],
  // v2: remember whether the patient has seen the Counttill (exercise session) tour.
  ['ALTER TABLE users ADD COLUMN counttill_tour_done INTEGER NOT NULL DEFAULT 0'],
  // v3: data now lives in Supabase. These tables are an offline cache of the server,
  // per patient (several patients can use one phone). Old local-only data is dropped.
  [
    'DROP TABLE IF EXISTS reports',
    'DROP TABLE IF EXISTS patient_exercises',
    'DROP TABLE IF EXISTS exercise_days',
    'DROP TABLE IF EXISTS users',
    'DROP TABLE IF EXISTS doctors',
    "DELETE FROM app_state WHERE key = 'session_user_id'",
    `CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      mobile TEXT NOT NULL,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      dob TEXT NOT NULL,
      photo_path TEXT,
      photo_url TEXT,
      doctor_id TEXT,
      can_edit_exercises INTEGER NOT NULL DEFAULT 0,
      counttill_tour_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE doctors (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      photo_url TEXT,
      start_month INTEGER NOT NULL,
      start_year INTEGER NOT NULL
    )`,
    `CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_urls TEXT NOT NULL,
      thumbnail_index INTEGER NOT NULL,
      video_url TEXT,
      active INTEGER NOT NULL
    )`,
    `CREATE TABLE patient_exercises (
      patient_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      exercise_id TEXT NOT NULL,
      reps INTEGER NOT NULL,
      hold_seconds INTEGER NOT NULL,
      PRIMARY KEY (patient_id, position)
    )`,
    `CREATE TABLE reports (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      report_date TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT
    )`,
    // synced = 0: recorded on this phone, not yet sent to the server.
    `CREATE TABLE exercise_days (
      patient_id TEXT NOT NULL,
      day TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('complete', 'partial')),
      synced INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (patient_id, day)
    )`,
  ],
  // v4: the clinic's written instructions for each exercise.
  ["ALTER TABLE exercises ADD COLUMN description TEXT NOT NULL DEFAULT ''"],
];

function migrate(database: DB) {
  const current = Number(database.executeSync('PRAGMA user_version').rows[0]?.user_version ?? 0);
  for (let version = current; version < MIGRATIONS.length; version++) {
    database.executeSync('BEGIN');
    try {
      for (const statement of MIGRATIONS[version]) {
        database.executeSync(statement);
      }
      database.executeSync(`PRAGMA user_version = ${version + 1}`);
      database.executeSync('COMMIT');
    } catch (error) {
      database.executeSync('ROLLBACK');
      throw error;
    }
  }
}

export function getDb(): DB {
  if (!db) {
    db = open({ name: 'painflame.db' });
    db.executeSync('PRAGMA foreign_keys = ON');
    migrate(db);
  }
  return db;
}

export function query<T>(sql: string, params: Scalar[] = []): T[] {
  return getDb().executeSync(sql, params).rows as T[];
}

export function run(sql: string, params: Scalar[] = []) {
  return getDb().executeSync(sql, params);
}

export function transaction(work: () => void) {
  const database = getDb();
  database.executeSync('BEGIN');
  try {
    work();
    database.executeSync('COMMIT');
  } catch (error) {
    database.executeSync('ROLLBACK');
    throw error;
  }
}
