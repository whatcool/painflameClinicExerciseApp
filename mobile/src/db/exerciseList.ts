import { query, run, transaction } from './database';

export type PatientExercise = {
  exerciseId: string; // id in the Exercise Library
  reps: number;
  holdSeconds: number;
};

export const DEFAULT_REPS = 10;
export const DEFAULT_HOLD_SECONDS = 10;

/** The patient's exercises in execution order (cached from the server). */
export function getExerciseList(patientId: string): PatientExercise[] {
  return query<{ exercise_id: string; reps: number; hold_seconds: number }>(
    'SELECT exercise_id, reps, hold_seconds FROM patient_exercises WHERE patient_id = ? ORDER BY position',
    [patientId],
  ).map(row => ({
    exerciseId: row.exercise_id,
    reps: row.reps,
    holdSeconds: row.hold_seconds,
  }));
}

/** Replaces the cached list; the array order is the execution order. */
export function cacheExerciseList(patientId: string, items: PatientExercise[]) {
  transaction(() => {
    run('DELETE FROM patient_exercises WHERE patient_id = ?', [patientId]);
    items.forEach((item, position) => {
      run(
        `INSERT INTO patient_exercises (patient_id, position, exercise_id, reps, hold_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [patientId, position, item.exerciseId, item.reps, item.holdSeconds],
      );
    });
  });
}
