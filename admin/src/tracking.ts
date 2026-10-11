// Same rules as the patient app (mobile/src/db/tracking.ts).
import type { ExerciseDay } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export function currentStreak(days: Set<string>, today: string) {
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function longestStreak(days: Set<string>) {
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) {
      continue;
    }
    let length = 0;
    let cursor = day;
    while (days.has(cursor)) {
      length++;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, length);
  }
  return best;
}

/** Dot colour per day of a month; days before sign-up or after today get none. */
export function monthDots(
  year: number,
  monthIndex: number,
  days: ExerciseDay[],
  signupDay: string,
  today: string,
) {
  const status = new Map(days.map(d => [d.day, d.status]));
  const count = new Date(year, monthIndex + 1, 0).getDate();
  let exercised = 0;
  let counted = 0;
  const cells = Array.from({ length: count }, (_, i) => {
    const key = dayKey(new Date(year, monthIndex, i + 1));
    if (key < signupDay || key > today) {
      return { day: i + 1, color: null as string | null };
    }
    counted++;
    const s = status.get(key);
    if (s) {
      exercised++;
    }
    return {
      day: i + 1,
      color: s === 'complete' ? 'var(--green)' : s === 'partial' ? 'var(--orange)' : 'var(--red)',
    };
  });
  return { cells, exercised, counted, leading: new Date(year, monthIndex, 1).getDay() };
}
