import { describe, it, expect } from 'vitest';
import {
  GrantSchema,
  OrganizationProfileSchema,
  GrantStatusSchema,
  FitScoreBreakdownSchema,
  ChecklistItemSchema,
} from './schemas';

describe('shared/schemas', () => {
  describe('GrantStatusSchema', () => {
    it('should accept valid grant statuses', () => {
      expect(GrantStatusSchema.safeParse('matched').success).toBe(true);
      expect(GrantStatusSchema.safeParse('draft').success).toBe(true);
      expect(GrantStatusSchema.safeParse('review').success).toBe(true);
      expect(GrantStatusSchema.safeParse('submitted').success).toBe(true);
      expect(GrantStatusSchema.safeParse('awarded').success).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(GrantStatusSchema.safeParse('discarded').success).toBe(false);
      expect(GrantStatusSchema.safeParse('pending').success).toBe(false);
      expect(GrantStatusSchema.safeParse('').success).toBe(false);
    });
  });

  describe('FitScoreBreakdownSchema', () => {
    it('should accept valid fit score breakdown', () => {
      const valid = {
        missionAlignment: 90,
        geographicFocus: 85,
        programTrackrecord: 80,
        budgetCapacity: 75,
        partnershipReadiness: 70,
      };
      expect(FitScoreBreakdownSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject values outside 0-100 range', () => {
      const invalid = {
        missionAlignment: 150,
        geographicFocus: 85,
        programTrackrecord: 80,
        budgetCapacity: 75,
        partnershipReadiness: 70,
      };
      expect(FitScoreBreakdownSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('ChecklistItemSchema', () => {
    it('should accept valid checklist item', () => {
      const item = {
        label: '501(c)(3) verification',
        done: true,
        source: 'From profile',
      };
      expect(ChecklistItemSchema.safeParse(item).success).toBe(true);
    });

    it('should reject checklist item with wrong types', () => {
      const item = {
        label: 123,
        done: 'yes',
        source: 456,
      };
      expect(ChecklistItemSchema.safeParse(item).success).toBe(false);
    });
  });

  describe('GrantSchema', () => {
    it('should accept valid grant', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-06-15',
        daysOut: 30,
        fit: 85,
        tags: ['Community', 'EdTech'],
        status: 'matched',
        statusLabel: 'Matched',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(true);
    });

    it('should accept grant with optional fields', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: 'Rolling',
        daysOut: 0,
        fit: 85,
        tags: [],
        status: 'matched',
        statusLabel: 'Matched',
        matchedAt: '2026-05-19',
        fitBreakdown: {
          missionAlignment: 90,
          geographicFocus: 85,
          programTrackrecord: 80,
          budgetCapacity: 75,
          partnershipReadiness: 70,
        },
        checklist: [
          { label: 'Test', done: false, source: 'Test' },
        ],
        draftContent: 'Draft content here',
        externalUrl: 'https://example.com',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(true);
    });

    it('should reject grant with invalid status', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-06-15',
        daysOut: 30,
        fit: 85,
        tags: [],
        status: 'discarded',
        statusLabel: 'Discarded',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(false);
    });
  });

  describe('OrganizationProfileSchema', () => {
    it('should accept valid organization profile', () => {
      const profile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'XK7N4HQ2P3M9',
        mission: 'Our mission',
        docTypes: ['PDF', 'XLS'],
        searchThemes: ['Theme 1', 'Theme 2'],
        agentBehavior: {
          autoDraftThreshold: 75,
          submissionPolicy: 'Human approval required',
          notifyEmail: 'test@example.com',
          voiceAndTone: 'Plain-spoken',
        },
      };
      expect(OrganizationProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('should reject profile with invalid agent behavior', () => {
      const profile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'XK7N4HQ2P3M9',
        mission: 'Our mission',
        docTypes: [],
        searchThemes: [],
        agentBehavior: {
          autoDraftThreshold: 'high',
          submissionPolicy: 'Human approval required',
          notifyEmail: 'test@example.com',
          voiceAndTone: 'Plain-spoken',
        },
      };
      expect(OrganizationProfileSchema.safeParse(profile).success).toBe(false);
    });
  });
});
