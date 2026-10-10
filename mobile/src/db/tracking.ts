import { addDays, daysInMonth, toDayKey } from '../utils/date';
import { query, run } from './database';

export type DayStatus = 'complete' | 'partial';
export type DotColor = 'green' | 'orange' | 'red' | null; // null = no dot

/**
 * Records the result of a day's session. To be called by the Start (exercise session)
 * flow: 'complete' when every exercise in the list was finished, 'partial' when some
 * were skipped. A 'complete' day is never downgraded.
 */
export function recordExerciseDay(userId: number, day: string, status: DayStatus) {
  run(
    `INSERT INTO exercise_days (user_id, day, status) VALUES (?, ?, ?)
     ON CONFLICT (user_id, day) DO UPDATE SET status =
       CASE WHEN exercise_days.status = 'complete' THEN 'complete' ELSE excluded.status END`,
    [userId, day, status],
  );
}

export function getMonthStatuses(userId: number, year: number, monthIndex: number) {
  const first = toDayKey(new Date(year, monthIndex, 1));
  const last = toDayKey(new Date(year, monthIndex, daysInMonth(year, monthIndex)));
  const rows = query<{ day: string; status: DayStatus }>(
    'SELECT day, status FROM exercise_days WHERE user_id = ? AND day BETWEEN ? AND ?',
    [userId, first, last],
  );
  return new Map(rows.map(row => [row.day, row.status]));
}

export type MonthSummary = {
  dots: Map<string, DotColor>;
  exercisedDays: number; // X: green + orange
  countedDays: number; // Y: days from sign-up (or 1st of month) up to today
};

/**
 * Pure function so it can be unit tested. Days before sign-up and after today get no dot.
 */
export function summariseMonth(
  year: number,
  monthIndex: number,
  statuses: Map<string, DayStatus>,
  signupDay: string,
  today: string,
): MonthSummary {
  const dots = new Map<string, DotColor>();
  let exercisedDays = 0;
  let countedDays = 0;
  for (let d = 1; d <= daysInMonth(year, monthIndex); d++) {
    const key = toDayKey(new Date(year, monthIndex, d));
    if (key < signupDay || key > today) {
      dots.set(key, null);
      continue;
    }
    countedDays++;
    const status = statuses.get(key);
    if (status === 'complete') {
      dots.set(key, 'green');
      exercisedDays++;
    } else if (status === 'partial') {
      dots.set(key, 'orange');
      exercisedDays++;
    } else {
      dots.set(key, 'red');
    }
  }
  return { dots, exercisedDays, countedDays };
}

export function signupDayOf(createdAtIso: string) {
  return toDayKey(new Date(createdAtIso));
}

/** Every day the patient exercised (complete or partial). */
export function getExercisedDays(userId: number): Set<string> {
  const rows = query<{ day: string }>('SELECT day FROM exercise_days WHERE user_id = ?', [userId]);
  return new Set(rows.map(row => row.day));
}

/**
 * Consecutive exercised days ending today. If today has nothing yet, the streak
 * still counts up to yesterday, so it only breaks once a whole day is missed.
 */
export function currentStreak(exercisedDays: Set<string>, today: string) {
  let day = exercisedDays.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (exercisedDays.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function longestStreak(exercisedDays: Set<string>) {
  let best = 0;
  for (const day of exercisedDays) {
    // Only start counting at the first day of a run.
    if (exercisedDays.has(addDays(day, -1))) {
      continue;
    }
    let length = 0;
    let cursor = day;
    while (exercisedDays.has(cursor)) {
      length++;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, length);
  }
  return best;
}
