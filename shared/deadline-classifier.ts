/**
 * Deadline Classifier
 *
 * Single source of truth for the four-bucket urgency classification
 * used by the Pipeline (overdue / urgent / soon / normal) and the
 * Calendar view (overdue / urgent / soon / normal). Per spec section
 * 04 'Deadline Intelligence':
 *   - Overdue: deadline has passed AND grant status is below 'submitted'
 *   - Urgent:  within DEADLINE_URGENT_DAYS (30) days
 *   - Soon:    within DEADLINE_SOON_DAYS (60) days
 *   - Normal:  more than DEADLINE_SOON_DAYS (60) days away, or rolling,
 *              or unknown, or null
 *
 * Pure functions only — no Date.now() inside the module. Callers
 * must inject "now" (or accept a real-time default) for testability.
 */

import { z } from 'zod';
import type { GrantStatus } from './types';

export const DEADLINE_URGENT_DAYS = 30;
export const DEADLINE_SOON_DAYS = 60;

export type UrgencyBucket = 'overdue' | 'urgent' | 'soon' | 'normal';

export const URGENCY_BUCKETS: readonly UrgencyBucket[] = [
  'overdue',
  'urgent',
  'soon',
  'normal',
] as const;

export const urgencyBucketSchema = z.enum(['overdue', 'urgent', 'soon', 'normal']);

/**
 * Bucket that indicates the grant has already been submitted or
 * resolved in some way. Per spec, an "overdue" classification is
 * only meaningful for grants still in the pre-submission states.
 */
const PRE_SUBMISSION_STATUSES: readonly GrantStatus[] = [
  'matched',
  'draft',
  'review',
  'approved',
  'submission-ready',
];

/**
 * Classify a deadline into one of the four urgency buckets.
 *
 * @param deadline   ISO date string (YYYY-MM-DD or full ISO 8601), a Date,
 *                   or null/undefined for unknown deadlines.
 * @param status     The current grant status. If the status is past
 *                   submission (submitted / follow-up / awarded / declined
 *                   / closed / archived), an "overdue" deadline is
 *                   downgraded to "normal" because the deadline is no
 *                   longer actionable.
 * @param now        Optional reference "now" date. Defaults to a fresh
 *                   Date. Acceptable for production use; tests should
 *                   pass a fixed Date for determinism.
 */
export function classifyDeadline(
  deadline: Date | string | null | undefined,
  status: GrantStatus,
  now: Date = new Date(),
): UrgencyBucket {
  if (deadline === null || deadline === undefined) {
    return 'normal';
  }

  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  if (Number.isNaN(deadlineDate.getTime())) {
    return 'normal';
  }

  const nowMidnight = startOfDay(now);
  const deadlineMidnight = startOfDay(deadlineDate);
  const diffMs = deadlineMidnight.getTime() - nowMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    if (PRE_SUBMISSION_STATUSES.includes(status)) {
      return 'overdue';
    }
    return 'normal';
  }

  if (diffDays <= DEADLINE_URGENT_DAYS) {
    return 'urgent';
  }

  if (diffDays <= DEADLINE_SOON_DAYS) {
    return 'soon';
  }

  return 'normal';
}

/**
 * Map a Grant object (with deadline + daysOut + deadlineConfidence)
 * to an urgency bucket. Convenience wrapper used by the
 * PipelineView and CalendarView which both already have a Grant
 * in hand.
 *
 * Special-cases:
 *   - rolling or unknown deadline confidence -> 'normal' (no fixed cutoff)
 *   - missing deadline -> 'normal'
 *   - prefer deadlineConfidence-based classification first; if
 *     the grant has no deadlineConfidence and we have a deadline,
 *     use classifyDeadline(deadline, status, now) directly.
 */
export function classifyGrantDeadline(
  grant: {
    deadline?: string;
    deadlineConfidence?: 'exact' | 'estimated' | 'rolling' | 'unknown';
    status: GrantStatus;
  },
  now: Date = new Date(),
): UrgencyBucket {
  if (
    grant.deadlineConfidence === 'rolling' ||
    grant.deadlineConfidence === 'unknown' ||
    !grant.deadline
  ) {
    return 'normal';
  }

  return classifyDeadline(grant.deadline, grant.status, now);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
