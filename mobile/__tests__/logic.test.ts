jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));

import { groupReports, type Report } from '../src/db/reports';
import { currentStreak, longestStreak, summariseMonth } from '../src/db/tracking';
import { latestAllowedDob, toDayKey } from '../src/utils/date';

const report = (id: number, reportDate: string, doctorId: number, doctorName: string): Report => ({
  id,
  title: `Report ${id}`,
  reportDate,
  doctorId,
  doctorName,
  fileUri: 'file:///x',
  mimeType: 'application/pdf',
  fileName: null,
});

describe('groupReports', () => {
  it('groups by date (newest first) then by doctor', () => {
    const groups = groupReports([
      report(1, '2026-10-01', 1, 'Dr A'),
      report(2, '2026-10-05', 1, 'Dr A'),
      report(3, '2026-10-05', 2, 'Dr B'),
      report(4, '2026-10-05', 1, 'Dr A'),
    ]);
    expect(groups.map(g => g.date)).toEqual(['2026-10-05', '2026-10-01']);
    expect(groups[0].doctors.map(d => d.doctorName)).toEqual(['Dr A', 'Dr B']);
    expect(groups[0].doctors[0].reports.map(r => r.id)).toEqual([2, 4]);
  });
});

describe('summariseMonth', () => {
  it('counts days from sign-up to today and colours dots', () => {
    const statuses = new Map([
      ['2026-10-03', 'complete' as const],
      ['2026-10-04', 'partial' as const],
    ]);
    // October 2026, signed up on the 2nd, today is the 5th
    const summary = summariseMonth(2026, 9, statuses, '2026-10-02', '2026-10-05');
    expect(summary.countedDays).toBe(4);
    expect(summary.exercisedDays).toBe(2);
    expect(summary.dots.get('2026-10-01')).toBeNull();
    expect(summary.dots.get('2026-10-02')).toBe('red');
    expect(summary.dots.get('2026-10-03')).toBe('green');
    expect(summary.dots.get('2026-10-04')).toBe('orange');
    expect(summary.dots.get('2026-10-06')).toBeNull();
  });
});

describe('PIN hashing', () => {
  it('stores a salted hash, never the PIN, and verifies correctly', async () => {
    const { hashPin, verifyPin } = require('../src/security/pin');
    const first = await hashPin('123456', 1000);
    const second = await hashPin('123456', 1000);
    expect(first.hash).not.toContain('123456');
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
    expect(await verifyPin('123456', first)).toBe(true);
    expect(await verifyPin('654321', first)).toBe(false);
  });
});

describe('streaks', () => {
  const days = new Set(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04']);

  it('counts back from today', () => {
    expect(currentStreak(days, '2026-10-04')).toBe(2);
  });

  it('keeps the streak alive until a whole day is missed', () => {
    expect(currentStreak(days, '2026-10-05')).toBe(2); // nothing yet today
    expect(currentStreak(days, '2026-10-06')).toBe(0); // missed the 5th
  });

  it('finds the longest run, across month ends', () => {
    expect(longestStreak(days)).toBe(4);
    expect(longestStreak(new Set())).toBe(0);
  });
});

describe('date of birth limit', () => {
  it('requires patients to be at least 5 years old', () => {
    expect(toDayKey(latestAllowedDob(new Date(2026, 9, 10)))).toBe('2021-10-10');
  });
});
