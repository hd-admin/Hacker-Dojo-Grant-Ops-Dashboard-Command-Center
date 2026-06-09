import { describe, it, expect } from 'vitest';
import {
  FitRubricSchema,
  GrantSchema,
  GrantStatusSchema,
  ResearchGrantSchema,
  ResearchResponseSchema,
  ResearchGrantSchemaStrict,
} from './schemas';
import type { Grant } from './types';

describe('shared/types', () => {
  describe('GrantStatus', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['matched', 'draft', 'review', 'submitted', 'awarded'];
      for (const status of validStatuses) {
        const result = GrantStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status "discarded"', () => {
      const result = GrantStatusSchema.safeParse('discarded');
      expect(result.success).toBe(false);
    });

    it('should reject arbitrary invalid strings', () => {
      const invalidStatuses = ['pending', 'unknown', 'cancelled', ''];
      for (const status of invalidStatuses) {
        const result = GrantStatusSchema.safeParse(status);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('FitRubric', () => {
    it('parses a full rubric with per-dimension justifications and rationale', () => {
      const rubric = {
        missionAlignment: { score: 90, justification: 'Strong mission alignment' },
        geographicFocus: { score: 80, justification: 'Bay Area focus matches' },
        programTrackrecord: { score: 85, justification: 'Strong past delivery' },
        budgetCapacity: { score: 75, justification: 'Award within band' },
        partnershipReadiness: { score: 80, justification: 'Existing partnerships apply' },
        overallRationale: 'Good fit overall for Hacker Dojo.',
        rubricVersion: 1,
      };
      const result = FitRubricSchema.safeParse(rubric);
      expect(result.success).toBe(true);
    });

    it('rejects scores outside 0-100 range', () => {
      const bad = {
        missionAlignment: { score: 150, justification: 'too high' },
        geographicFocus: { score: 80, justification: 'ok' },
        programTrackrecord: { score: 85, justification: 'ok' },
        budgetCapacity: { score: 75, justification: 'ok' },
        partnershipReadiness: { score: 80, justification: 'ok' },
        overallRationale: 'broken',
        rubricVersion: 1,
      };
      expect(FitRubricSchema.safeParse(bad).success).toBe(false);
    });
  });

  describe('Grant (with new rubric + timestamps)', () => {
    const baseGrant = {
      id: 'test-grant',
      title: 'Test Grant',
      funder: 'Test Funder',
      funderShort: 'TF',
      award: '$50,000',
      awardSort: 50000,
      deadline: '2026-06-15',
      daysOut: 30,
      fit: 85,
      tags: ['Community'],
      status: 'matched' as const,
      statusLabel: 'Matched',
    };

    it('parses a grant carrying fitRubric + lastSeenAt + lastUpdatedAt', () => {
      const full: Grant = {
        ...baseGrant,
        fitRubric: {
          missionAlignment: { score: 90, justification: 'strong' },
          geographicFocus: { score: 80, justification: 'bay area' },
          programTrackrecord: { score: 85, justification: 'past delivery' },
          budgetCapacity: { score: 75, justification: 'within band' },
          partnershipReadiness: { score: 80, justification: 'partnerships' },
          overallRationale: 'good fit',
          rubricVersion: 1,
        },
        lastSeenAt: '2026-05-01T00:00:00.000Z',
        lastUpdatedAt: '2026-05-01T00:00:00.000Z',
      };
      expect(GrantSchema.safeParse(full).success).toBe(true);
    });

    it('tolerates the absence of fitRubric / lastSeenAt / lastUpdatedAt', () => {
      expect(GrantSchema.safeParse(baseGrant).success).toBe(true);
    });

    it('persists archivedAt on archived grants', () => {
      const archived: Grant = {
        ...baseGrant,
        status: 'archived',
        archivedAt: '2026-05-15T00:00:00.000Z',
      };
      const parsed = GrantSchema.safeParse(archived);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.archivedAt).toBe('2026-05-15T00:00:00.000Z');
      }
    });
  });

  describe('ResearchGrantSchema + ResearchGrantSchemaStrict', () => {
    it('ResearchGrantSchema (lenient) accepts grants without rubric or changeClass', () => {
      const grant = { title: 'T', funder: 'F' };
      expect(ResearchGrantSchema.safeParse(grant).success).toBe(true);
    });

    it('ResearchGrantSchema accepts the new optional fields', () => {
      const grant = {
        title: 'T',
        funder: 'F',
        fitRubric: {
          missionAlignment: { score: 90, justification: 'm' },
          geographicFocus: { score: 80, justification: 'g' },
          programTrackrecord: { score: 85, justification: 'p' },
          budgetCapacity: { score: 75, justification: 'b' },
          partnershipReadiness: { score: 80, justification: 'r' },
          overallRationale: 'good',
          rubricVersion: 1,
        },
        changeClass: 'updated' as const,
        evidence: { deadline: '2026-12-31' },
        lastSeenConfirmed: true,
      };
      expect(ResearchGrantSchema.safeParse(grant).success).toBe(true);
    });

    it('ResearchGrantSchemaStrict rejects a grant missing the rubric', () => {
      const grant = {
        title: 'T',
        funder: 'F',
        changeClass: 'new' as const,
        lastSeenConfirmed: true,
      };
      expect(ResearchGrantSchemaStrict.safeParse(grant).success).toBe(false);
    });

    it('ResearchGrantSchemaStrict accepts a fully populated grant', () => {
      const grant = {
        title: 'T',
        funder: 'F',
        fitRubric: {
          missionAlignment: { score: 90, justification: 'm' },
          geographicFocus: { score: 80, justification: 'g' },
          programTrackrecord: { score: 85, justification: 'p' },
          budgetCapacity: { score: 75, justification: 'b' },
          partnershipReadiness: { score: 80, justification: 'r' },
          overallRationale: 'good',
          rubricVersion: 1,
        },
        changeClass: 'new' as const,
        evidence: { deadline: '2026-12-31' },
        lastSeenConfirmed: true,
      };
      expect(ResearchGrantSchemaStrict.safeParse(grant).success).toBe(true);
    });

    it('ResearchResponseSchema accepts a research batch with strict grants', () => {
      const batch = {
        grants: [
          {
            title: 'A',
            funder: 'B',
            fitRubric: {
              missionAlignment: { score: 90, justification: 'm' },
              geographicFocus: { score: 80, justification: 'g' },
              programTrackrecord: { score: 85, justification: 'p' },
              budgetCapacity: { score: 75, justification: 'b' },
              partnershipReadiness: { score: 80, justification: 'r' },
              overallRationale: 'good',
              rubricVersion: 1,
            },
            changeClass: 'new' as const,
            evidence: {},
            lastSeenConfirmed: true,
          },
        ],
      };
      expect(ResearchResponseSchema.safeParse(batch).success).toBe(true);
    });
  });
});
