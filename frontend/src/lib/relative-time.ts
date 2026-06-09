/**
 * Relative-time formatter.
 *
 * Renders an ISO timestamp as a human-friendly relative phrase ("just now",
 * "5m ago", "yesterday", "Mon 14"). Sibling to the absolute `formatDate` in
 * `frontend/src/components/GrantDrawer/utilities.ts` — that one is used for
 * deadlines where the absolute day matters; this one is for lastSeenAt /
 * lastUpdatedAt badges where the relative freshness is what the operator
 * needs at a glance.
 *
 * Branches:
 *   undefined/null → "—"
 *   < 60s          → "just now"
 *   < 60m          → "<N>m ago"
 *   < 24h          → "<N>h ago"
 *   24–48h         → "yesterday"
 *   2–6 days       → "<N>d ago"
 *   7+ days, same year → "<Mon> <DD>"
 *   7+ days, prior year → "<Mon> <DD>, <YYYY>"
 */
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
] as const;

export function formatRelativeTime(
  iso: string | undefined | null,
  now: Date = new Date(),
): string {
  if (!iso) {
    return '\u2014';
  }
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return '\u2014';
  }
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) {
    // Future timestamps are unusual but render cleanly with the day-level form.
    return formatDay(then, now);
  }
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return 'just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) {
    return 'yesterday';
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return formatDay(then, now);
}

function formatDay(then: Date, now: Date): string {
  const sameYear = then.getFullYear() === now.getFullYear();
  const month = MONTHS[then.getMonth()] ?? '';
  const day = then.getDate();
  return sameYear ? `${month} ${day}` : `${month} ${day}, ${then.getFullYear()}`;
}
