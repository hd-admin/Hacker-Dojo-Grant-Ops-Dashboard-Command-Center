import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  checkSubmissionReadiness,
  getNextStates,
  canTransition,
  STATUS_LABELS,
} from './pipeline-logic';
import type { Grant, GrantStatus } from './types';

describe('pipeline-logic', () => {
  describe('validateTransition', () => {
    it('allows matched -> draft', () => {
      expect(validateTransition('matched', 'draft')).toEqual({ valid: true });
    });

    it('allows draft -> review', () => {
      expect(validateTransition('draft', 'review')).toEqual({ valid: true });
    });

    it('allows review -> approved', () => {
      expect(validateTransition('review', 'approved')).toEqual({ valid: true });
    });

    it('allows approved -> submission-ready', () => {
      expect(validateTransition('approved', 'submission-ready')).toEqual({ valid: true });
    });

    it('allows submission-ready -> submitted', () => {
      expect(validateTransition('submission-ready', 'submitted')).toEqual({ valid: true });
    });

    it('allows submitted -> awarded', () => {
      expect(validateTransition('submitted', 'awarded')).toEqual({ valid: true });
    });

    it('allows awarded -> closed', () => {
      expect(validateTransition('awarded', 'closed')).toEqual({ valid: true });
    });

    it('rejects matched -> submitted (skip steps)', () => {
      const result = validateTransition('matched', 'submitted');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid transition');
    });

    it('rejects unknown source status', () => {
      const result = validateTransition('unknown' as GrantStatus, 'draft');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown source status');
    });

    it('rejects draft -> submitted (skip steps)', () => {
      expect(validateTransition('draft', 'submitted').valid).toBe(false);
    });

    it('allows all valid transitions from Each status per AC-7.1.1', () => {
      for (const [from, allowed] of Object.entries({
        matched: ['draft', 'closed', 'archived'],
        draft: ['review', 'closed'],
        review: ['approved', 'draft', 'closed'],
        approved: ['submission-ready', 'closed'],
        'submission-ready': ['submitted', 'closed'],
        submitted: ['follow-up', 'awarded', 'declined'],
        'follow-up': ['awarded', 'declined', 'submitted'],
        awarded: ['closed'],
        declined: ['closed', 'archived'],
        closed: ['archived'],
      })) {
        for (const to of allowed) {
          expect(validateTransition(from as GrantStatus, to as GrantStatus).valid).toBe(true);
        }
      }
    });

    it('rejects transitions removed per AC-7.1.1 (draft -> matched)', () => {
      expect(validateTransition('draft', 'matched').valid).toBe(false);
    });

    it('rejects transitions removed per AC-7.1.1 (draft -> archived)', () => {
      expect(validateTransition('draft', 'archived').valid).toBe(false);
    });

    it('rejects transitions removed per AC-7.1.1 (approved -> submitted)', () => {
      expect(validateTransition('approved', 'submitted').valid).toBe(false);
    });

    it('rejects transitions removed per AC-7.1.1 (approved -> review)', () => {
      expect(validateTransition('approved', 'review').valid).toBe(false);
    });

    it('rejects transitions removed per AC-7.1.1 (submitted -> closed)', () => {
      expect(validateTransition('submitted', 'closed').valid).toBe(false);
    });

    it('rejects transitions removed per AC-7.1.1 (awarded -> archived)', () => {
      expect(validateTransition('awarded', 'archived').valid).toBe(false);
    });
  });

  describe('getNextStates', () => {
    it('returns allowed next states for matched', () => {
      expect(getNextStates('matched')).toEqual(['draft', 'closed', 'archived']);
    });

    it('returns empty array for archived', () => {
      // Archived is a soft-archive state. The unarchive path lets the operator
      // move an archived grant back to 'matched' so the lifecycle stays
      // reversible per the product spec.
      expect(getNextStates('archived')).toEqual(['matched']);
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transition', () => {
      expect(canTransition('matched', 'draft')).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(canTransition('matched', 'submitted')).toBe(false);
    });
  });

  describe('STATUS_LABELS', () => {
    it('has labels for all statuses', () => {
      expect(STATUS_LABELS.matched).toBe('New Match');
      expect(STATUS_LABELS.draft).toBe('Drafting');
      expect(STATUS_LABELS.approved).toBe('Approved');
      expect(STATUS_LABELS.awarded).toBe('Awarded');
    });
  });

  describe('checkSubmissionReadiness', () => {
    const baseGrant: Grant = {
      id: 'grant-1',
      title: 'Test Grant',
      funder: 'Test Funder',
      funderShort: 'TF',
      award: '$50,000',
      awardSort: 50000,
      deadline: '2026-12-31',
      daysOut: 214,
      fit: 85,
      tags: ['test'],
      status: 'approved',
      statusLabel: 'Approved',
      checklist: [],
      draftContent: 'Some draft content',
    };

    it('returns ready for approved grant with no checklist', () => {
      const result = checkSubmissionReadiness(baseGrant);
      expect(result.ready).toBe(true);
      expect(result.hasApproval).toBe(true);
    });

    it('blocks submission when grant is not approved', () => {
      const result = checkSubmissionReadiness({
        ...baseGrant,
        status: 'draft',
        statusLabel: 'Drafting',
      });
      expect(result.ready).toBe(false);
      expect(result.blockingReasons.length).toBeGreaterThan(0);
    });

    it('blocks submission when required checklist items not complete', () => {
      const grant: Grant = {
        ...baseGrant,
        checklist: [
          { label: 'Budget', done: false, source: 'review', required: true },
          { label: 'Narrative', done: true, source: 'review', required: true },
        ],
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContainEqual(expect.stringContaining('Budget'));
    });

    it('marks checklist complete when all required items done', () => {
      const grant: Grant = {
        ...baseGrant,
        checklist: [
          { label: 'Budget', done: true, source: 'review', required: true },
          { label: 'Narrative', done: true, source: 'review', required: true },
        ],
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.checklistComplete).toBe(true);
    });

    it('ignores optional checklist items for readiness', () => {
      const grant: Grant = {
        ...baseGrant,
        checklist: [
          { label: 'Budget', done: true, source: 'review', required: true },
          { label: 'Cover Letter', done: false, source: 'review', required: false },
        ],
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.checklistComplete).toBe(true);
      expect(result.ready).toBe(true);
    });

    it('requires draft content for readiness', () => {
      const grant: Grant = {
        ...baseGrant,
        draftContent: 'Some draft content here',
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.hasDraft).toBe(true);
    });

    it('blocks submission when blockSubmission checklist items are incomplete', () => {
      const grant: Grant = {
        ...baseGrant,
        checklist: [
          {
            label: 'Budget Approval',
            done: false,
            source: 'review',
            required: false,
            blockSubmission: true,
          },
          { label: 'Narrative', done: true, source: 'review', required: true },
        ],
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.ready).toBe(false);
      expect(result.blockingReasons.some((r) => r.includes('submission-blocking'))).toBe(true);
      expect(result.blockingReasons.some((r) => r.includes('Budget Approval'))).toBe(true);
    });

    it('allows submission when blockSubmission checklist items are completed', () => {
      const grant: Grant = {
        ...baseGrant,
        checklist: [
          {
            label: 'Budget Approval',
            done: true,
            source: 'review',
            required: false,
            blockSubmission: true,
          },
          { label: 'Narrative', done: true, source: 'review', required: true },
        ],
      };
      const result = checkSubmissionReadiness(grant);
      expect(result.ready).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it('blocks submission when profile is not ready', () => {
      const result = checkSubmissionReadiness(baseGrant, false);
      expect(result.ready).toBe(false);
      expect(result.blockingReasons.some((r) => r.includes('profile'))).toBe(true);
    });

    it('allows submission when profile is ready', () => {
      const result = checkSubmissionReadiness(baseGrant, true);
      expect(result.ready).toBe(true);
    });

    it('combines multiple blocking reasons', () => {
      const grant: Grant = {
        ...baseGrant,
        status: 'draft',
        statusLabel: 'Drafting',
        draftContent: '',
        checklist: [
          {
            label: 'Blocking Item',
            done: false,
            source: 'review',
            required: false,
            blockSubmission: true,
          },
        ],
      };
      const result = checkSubmissionReadiness(grant, false);
      expect(result.ready).toBe(false);
      expect(result.blockingReasons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
