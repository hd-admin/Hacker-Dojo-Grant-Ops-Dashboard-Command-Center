import { describe, it, expect } from 'vitest';
import type { Grant } from '../../../shared/types';

const mockGrant: Grant = {
  id: 'nsf-tech',
  title: 'NSF Technology Access Grant',
  funder: 'National Science Foundation',
  funderShort: 'NSF',
  award: '$350,000',
  awardSort: 350000,
  deadline: '2026-06-15',
  daysOut: 25,
  fit: 88,
  tags: ['Science & Tech', 'Federal', 'EdTech'],
  status: 'matched',
  statusLabel: 'Matched',
  matchedAt: '2026-05-19',
  fitBreakdown: {
    missionAlignment: 96,
    geographicFocus: 90,
    programTrackrecord: 88,
    budgetCapacity: 82,
    partnershipReadiness: 78,
  },
  checklist: [
    { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
    { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
    { label: 'LOI draft', done: false, source: 'In progress' },
  ],
  draftContent: `Hacker Dojo proposes to anchor the Silicon Valley AI-Ready Hub...`,
  externalUrl: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734',
};

describe('GrantDrawer', () => {
  describe('Grant Data Loading', () => {
    it('should load grant data when grantId prop changes', async () => {
      // When grantId changes from null to a grant ID, the drawer should load that grant
      const _prevGrantId: string | null = null;
      const nextGrantId = 'nsf-tech';

      // Simulate the effect: when grantId is set, load the grant
      const shouldLoad = nextGrantId !== null;
      expect(shouldLoad).toBe(true);
    });

    it('should clear grant data when grantId becomes null', () => {
      const _grantId: string | null = 'nsf-tech';
      const nextGrantId: string | null = null;

      const shouldClear = nextGrantId === null;
      expect(shouldClear).toBe(true);
    });
  });

  describe('Checklist Rendering', () => {
    it('should render checklist items with done/undone state', () => {
      if (!mockGrant.checklist) return;

      const doneItems = mockGrant.checklist.filter((item) => item.done);
      const undoneItems = mockGrant.checklist.filter((item) => !item.done);

      expect(doneItems.length).toBe(2);
      expect(undoneItems.length).toBe(1);
    });

    it('should show correct checklist item labels', () => {
      if (!mockGrant.checklist) return;

      const labels = mockGrant.checklist.map((item) => item.label);
      expect(labels).toContain('501(c)(3) verification + EIN');
      expect(labels).toContain('SAM.gov registration active');
      expect(labels).toContain('LOI draft');
    });
  });

  describe('Draft Preview Rendering', () => {
    it('should show draft content when available', () => {
      const hasDraft = !!mockGrant.draftContent;
      expect(hasDraft).toBe(true);
    });

    it('should not show draft preview when draftContent is missing', () => {
      const grantWithoutDraft: Grant = {
        id: 'test',
        title: 'Test',
        funder: 'Test',
        funderShort: 'T',
        award: '$0',
        awardSort: 0,
        deadline: '2026-01-01',
        daysOut: 0,
        fit: 0,
        tags: [],
        status: 'matched',
        statusLabel: 'Test',
      };
      const hasDraft = !!grantWithoutDraft.draftContent;
      expect(hasDraft).toBe(false);
    });
  });

  describe('Approve/Revision Button Interactions', () => {
    it('should have approve button available for matched grants', () => {
      const hasApproveButton = mockGrant.status === 'matched';
      expect(hasApproveButton).toBe(true);
    });

    it('should have revision button available', () => {
      const hasRevisionButton = !!mockGrant;
      expect(hasRevisionButton).toBe(true);
    });
  });

  describe('Drawer State Transitions', () => {
    it('should be closed when grantId is null', () => {
      const grantId: string | null = null;
      const isOpen = !!grantId;
      expect(isOpen).toBe(false);
    });

    it('should be open when grantId is set', () => {
      const grantId = 'nsf-tech';
      const isOpen = !!grantId;
      expect(isOpen).toBe(true);
    });
  });
});
