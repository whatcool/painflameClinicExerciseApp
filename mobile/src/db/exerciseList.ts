import { query, run, transaction } from './database';

export type PatientExercise = {
  exerciseId: string; // id in the Exercise Library
  reps: number;
  holdSeconds: number;
};

export const DEFAULT_REPS = 10;
export const DEFAULT_HOLD_SECONDS = 10;

/** The patient's exercises in execution order. */
export function getExerciseList(userId: number): PatientExercise[] {
  return query<{ exercise_id: string; reps: number; hold_seconds: number }>(
    'SELECT exercise_id, reps, hold_seconds FROM patient_exercises WHERE user_id = ? ORDER BY position',
    [userId],
  ).map(row => ({
    exerciseId: row.exercise_id,
    reps: row.reps,
    holdSeconds: row.hold_seconds,
  }));
}

/** Replaces the whole list; the array order becomes the execution order. */
export function saveExerciseList(userId: number, items: PatientExercise[]) {
  transaction(() => {
    run('DELETE FROM patient_exercises WHERE user_id = ?', [userId]);
    items.forEach((item, position) => {
      run(
        `INSERT INTO patient_exercises (user_id, exercise_id, position, reps, hold_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, item.exerciseId, position, item.reps, item.holdSeconds],
      );
    });
  });
}
