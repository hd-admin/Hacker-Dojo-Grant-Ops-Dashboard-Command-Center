import { describe, it, expect } from 'vitest';
import {
  classifyDeadline,
  classifyGrantDeadline,
  DEADLINE_URGENT_DAYS,
  DEADLINE_SOON_DAYS,
  URGENCY_BUCKETS,
  urgencyBucketSchema,
} from './deadline-classifier';
import type { GrantStatus } from './types';

const NOW = new Date('2026-06-08T12:00:00Z');

function daysFromNow(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDays(n: number): string {
  return daysFromNow(n).toISOString();
}

function isoDate(d: Date): string {
  return d.toISOString();
}

describe('deadline-classifier', () => {
  describe('constants', () => {
    it('exposes the 30/60-day thresholds used in the spec', () => {
      expect(DEADLINE_URGENT_DAYS).toBe(30);
      expect(DEADLINE_SOON_DAYS).toBe(60);
    });

    it('exposes the full bucket enum in stable order', () => {
      expect(URGENCY_BUCKETS).toEqual(['overdue', 'urgent', 'soon', 'normal']);
    });
  });

  describe('classifyDeadline', () => {
    describe('overdue bucket', () => {
      it('classifies a past deadline for a pre-submission grant as overdue', () => {
        const result = classifyDeadline(isoDays(-3), 'draft', NOW);
        expect(result).toBe('overdue');
      });

      it('classifies a deadline of today (diff = 0) as urgent, not overdue', () => {
        const result = classifyDeadline(isoDays(0), 'draft', NOW);
        expect(result).toBe('urgent');
      });

      it('classifies a past deadline for a submitted grant as normal', () => {
        const result = classifyDeadline(isoDays(-5), 'submitted', NOW);
        expect(result).toBe('normal');
      });

      it('classifies a past deadline for an awarded grant as normal', () => {
        const result = classifyDeadline(isoDays(-30), 'awarded', NOW);
        expect(result).toBe('normal');
      });

      it('classifies a past deadline for a declined grant as normal', () => {
        const result = classifyDeadline(isoDays(-10), 'declined', NOW);
        expect(result).toBe('normal');
      });
    });

    describe('urgent bucket (within 30 days)', () => {
      it('classifies a deadline 1 day out as urgent', () => {
        expect(classifyDeadline(isoDays(1), 'draft', NOW)).toBe('urgent');
      });

      it('classifies a deadline 15 days out as urgent', () => {
        expect(classifyDeadline(isoDays(15), 'draft', NOW)).toBe('urgent');
      });

      it('classifies a deadline at the 30-day boundary as urgent', () => {
        expect(classifyDeadline(isoDays(30), 'draft', NOW)).toBe('urgent');
      });

      it('classifies a deadline 29 days out as urgent (just under boundary)', () => {
        expect(classifyDeadline(isoDays(29), 'review', NOW)).toBe('urgent');
      });
    });

    describe('soon bucket (30-60 days)', () => {
      it('classifies a deadline 31 days out as soon', () => {
        expect(classifyDeadline(isoDays(31), 'draft', NOW)).toBe('soon');
      });

      it('classifies a deadline 45 days out as soon', () => {
        expect(classifyDeadline(isoDays(45), 'review', NOW)).toBe('soon');
      });

      it('classifies a deadline at the 60-day boundary as soon', () => {
        expect(classifyDeadline(isoDays(60), 'draft', NOW)).toBe('soon');
      });
    });

    describe('normal bucket (60+ days)', () => {
      it('classifies a deadline 61 days out as normal', () => {
        expect(classifyDeadline(isoDays(61), 'draft', NOW)).toBe('normal');
      });

      it('classifies a deadline 180 days out as normal', () => {
        expect(classifyDeadline(isoDays(180), 'draft', NOW)).toBe('normal');
      });
    });

    describe('edge inputs', () => {
      it('maps null to normal', () => {
        expect(classifyDeadline(null, 'draft', NOW)).toBe('normal');
      });

      it('maps undefined to normal', () => {
        expect(classifyDeadline(undefined, 'draft', NOW)).toBe('normal');
      });

      it('maps a non-parseable string to normal', () => {
        expect(classifyDeadline('not-a-date', 'draft', NOW)).toBe('normal');
      });

      it('accepts a Date instance', () => {
        const date = daysFromNow(10);
        expect(classifyDeadline(date, 'draft', NOW)).toBe('urgent');
      });
    });
  });

  describe('classifyGrantDeadline', () => {
    it('returns normal for a rolling deadline', () => {
      const result = classifyGrantDeadline(
        {
          deadline: '2026-12-31',
          deadlineConfidence: 'rolling',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('normal');
    });

    it('returns normal for an unknown deadline confidence', () => {
      const result = classifyGrantDeadline(
        {
          deadline: '2026-12-31',
          deadlineConfidence: 'unknown',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('normal');
    });

    it('returns normal when the grant has no deadline', () => {
      const result = classifyGrantDeadline(
        {
          deadlineConfidence: 'exact',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('normal');
    });

    it('classifies an estimated 10-day deadline as urgent', () => {
      const result = classifyGrantDeadline(
        {
          deadline: isoDays(10),
          deadlineConfidence: 'estimated',
          status: 'review',
        },
        NOW,
      );
      expect(result).toBe('urgent');
    });

    it('classifies an exact 45-day deadline as soon', () => {
      const result = classifyGrantDeadline(
        {
          deadline: isoDays(45),
          deadlineConfidence: 'exact',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('soon');
    });

    it('classifies an exact past deadline for a pre-submission grant as overdue', () => {
      const result = classifyGrantDeadline(
        {
          deadline: isoDays(-3),
          deadlineConfidence: 'exact',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('overdue');
    });

    it('ignores the ISO time component (only the date matters)', () => {
      const earlyMorning = new Date('2026-06-15T01:00:00Z');
      const result = classifyGrantDeadline(
        {
          deadline: isoDate(earlyMorning),
          deadlineConfidence: 'exact',
          status: 'draft',
        },
        NOW,
      );
      expect(result).toBe('urgent');
    });
  });

  describe('Zod schema', () => {
    it('accepts all four bucket values', () => {
      for (const bucket of URGENCY_BUCKETS) {
        expect(urgencyBucketSchema.parse(bucket)).toBe(bucket);
      }
    });

    it('rejects an unknown bucket', () => {
      expect(() => urgencyBucketSchema.parse('critical')).toThrow();
    });
  });

  describe('integration with GrantStatus union', () => {
    const allStatuses: GrantStatus[] = [
      'matched',
      'draft',
      'review',
      'approved',
      'submission-ready',
      'submitted',
      'follow-up',
      'awarded',
      'declined',
      'closed',
      'archived',
    ];

    it('classifies the same past deadline consistently across pre-submission statuses', () => {
      for (const status of ['matched', 'draft', 'review', 'approved', 'submission-ready'] as const) {
        expect(classifyDeadline(isoDays(-1), status, NOW)).toBe('overdue');
      }
    });

    it('classifies the same past deadline as normal for post-submission statuses', () => {
      for (const status of [
        'submitted',
        'follow-up',
        'awarded',
        'declined',
        'closed',
        'archived',
      ] as const) {
        expect(classifyDeadline(isoDays(-1), status, NOW)).toBe('normal');
      }
    });

    it('does not throw for any GrantStatus in the union', () => {
      for (const status of allStatuses) {
        expect(() => classifyDeadline(isoDays(0), status, NOW)).not.toThrow();
      }
    });
  });
});
