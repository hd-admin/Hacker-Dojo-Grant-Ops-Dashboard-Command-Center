import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time';

const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('returns em-dash for undefined input', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('\u2014');
  });

  it('returns em-dash for null input', () => {
    expect(formatRelativeTime(null, NOW)).toBe('\u2014');
  });

  it('returns em-dash for an unparseable string', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('\u2014');
  });

  it('returns "just now" for a timestamp within the same second', () => {
    expect(formatRelativeTime(NOW.toISOString(), NOW)).toBe('just now');
  });

  it('returns "<N>m ago" for sub-hour diffs', () => {
    const fiveMinAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo, NOW)).toBe('5m ago');
  });

  it('returns "<N>h ago" for sub-day diffs', () => {
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo, NOW)).toBe('3h ago');
  });

  it('returns "yesterday" for a 24–48h diff', () => {
    const yesterday = new Date(NOW.getTime() - 30 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(yesterday, NOW)).toBe('yesterday');
  });

  it('returns "<N>d ago" for 2–6 day diffs', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo, NOW)).toBe('3d ago');
  });

  it('returns "<Mon> <DD>" for 7+ days in the same year', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(tenDaysAgo.toISOString(), NOW)).toBe(
      `${MONTH(tenDaysAgo)} ${tenDaysAgo.getUTCDate()}`,
    );
  });

  it('returns "<Mon> <DD>, <YYYY>" for 7+ days in a different year', () => {
    const longAgo = new Date('2025-03-10T12:00:00.000Z');
    expect(formatRelativeTime(longAgo.toISOString(), NOW)).toBe('Mar 10, 2025');
  });
});

function MONTH(d: Date): string {
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return MONTHS[d.getUTCMonth()] ?? '';
}
