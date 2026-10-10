export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as 'YYYY-MM-DD'. */
export function toDayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** e.g. "9 October 2026" */
export function formatLongDate(key: string) {
  const date = fromDayKey(key);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** e.g. "October 2026" from a 1-based month. */
export function formatMonthYear(month: number, year: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Patients must be at least this old; limits the date-of-birth picker. */
export const MIN_PATIENT_AGE_YEARS = 5;

/** The latest date of birth allowed (today minus the minimum age). */
export function latestAllowedDob(today = new Date()) {
  return new Date(today.getFullYear() - MIN_PATIENT_AGE_YEARS, today.getMonth(), today.getDate());
}

export function addDays(key: string, delta: number) {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}
