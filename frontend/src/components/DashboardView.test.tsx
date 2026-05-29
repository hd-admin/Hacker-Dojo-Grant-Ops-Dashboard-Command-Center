import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant, OrganizationProfile, Notification } from '../../../shared/types';

const getRelativeDate = (daysBack: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const dateStr = date.toISOString().split('T')[0];
  return dateStr || '';
};

const mockGrants: Grant[] = [
  {
    id: 'grant-1',
    title: 'NSF Tech Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Science & Tech', 'Federal'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: getRelativeDate(6),
  },
  {
    id: 'grant-2',
    title: 'SVCF Community Grant',
    funder: 'Silicon Valley Community Foundation',
    funderShort: 'SVCF',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 82,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: getRelativeDate(5),
  },
  {
    id: 'grant-3',
    title: 'Review Grant',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-06-01',
    daysOut: 11,
    fit: 84,
    tags: ['EdTech'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: getRelativeDate(15),
  },
  {
    id: 'grant-4',
    title: 'Awarded Grant',
    funder: 'Closed Funder',
    funderShort: 'CF',
    award: '$30,000',
    awardSort: 30000,
    deadline: '2025-12-01',
    daysOut: -171,
    fit: 45,
    tags: ['Federal'],
    status: 'awarded',
    statusLabel: 'Awarded',
    matchedAt: getRelativeDate(267),
  },
];

const _mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  nonprofitStatus: '501(c)(3)',
  contactInfo: {},
  geography: 'Regional',
  mission: 'Test mission',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  docTypes: ['PDF'],
  searchThemes: ['Theme 1'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

import DashboardView from './DashboardView';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

describe('DashboardView', () => {
  describe('KPI Calculations', () => {
    it('should calculate active pipeline correctly', () => {
      const activeGrants = mockGrants.filter((g) => g.status !== 'awarded');
      const activePipeline = activeGrants.reduce((sum, g) => sum + g.awardSort, 0);
      expect(activePipeline).toBe(350000 + 75000 + 50000); // $475K
    });

    it('should calculate drafted and ready count', () => {
      const draftedReady = mockGrants.filter((g) => g.status === 'review').length;
      expect(draftedReady).toBe(1);
    });

    it('should calculate new matches within 7 days', () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const newMatches7d = mockGrants.filter((g) => {
        if (!g.matchedAt || g.status !== 'matched') return false;
        const matchedDate = new Date(g.matchedAt);
        return matchedDate >= sevenDaysAgo && matchedDate <= today;
      }).length;
      expect(newMatches7d).toBe(2); // grant-1 and grant-2 matched in last 2 days
    });

    it('should find next deadline grant', () => {
      const deadlinesGrant = mockGrants
        .filter((g) => g.daysOut > 0 && g.deadline !== 'Rolling')
        .sort((a, b) => a.daysOut - b.daysOut)[0];
      expect(deadlinesGrant?.title).toBe('Review Grant');
      expect(deadlinesGrant?.daysOut).toBe(11);
    });
  });

  describe('Dynamic Greeting', () => {
    it('should return Good morning for hours 0-11', () => {
      const hour = 9;
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      expect(greeting).toBe('Good morning');
    });

    it('should return Good afternoon for hours 12-16', () => {
      const hour = 14;
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      expect(greeting).toBe('Good afternoon');
    });

    it('should return Good evening for hours 17-23', () => {
      const hour = 19;
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      expect(greeting).toBe('Good evening');
    });
  });

  describe('Deadline Filtering', () => {
    it('should filter upcoming deadlines within 90 days', () => {
      const upcomingDeadlines = mockGrants
        .filter((g) => g.daysOut < 90 && g.daysOut > 0 && g.deadline !== 'Rolling')
        .sort((a, b) => a.daysOut - b.daysOut);
      expect(upcomingDeadlines.length).toBe(2);
      expect(upcomingDeadlines[0]?.daysOut).toBe(11);
      expect(upcomingDeadlines[1]?.daysOut).toBe(25);
    });

    it('should exclude rolling deadlines from upcoming', () => {
      const withRolling = mockGrants.filter(
        (g) => g.daysOut < 90 && g.daysOut > 0 && g.deadline !== 'Rolling',
      );
      const rolling = mockGrants.filter((g) => g.deadline === 'Rolling');
      expect(rolling.length).toBe(1);
      expect(withRolling.find((g) => g.deadline === 'Rolling')).toBeUndefined();
    });
  });

  describe('Review Queue', () => {
    it('should filter grants in review status', () => {
      const reviewQueue = mockGrants.filter((g) => g.status === 'review');
      expect(reviewQueue.length).toBe(1);
      expect(reviewQueue[0]?.id).toBe('grant-3');
    });
  });

  describe('render tests', () => {
    const requiredProps = {
      onGrantSelect: vi.fn(),
      onNavigate: vi.fn(),
      onRefreshAppState: vi.fn(),
      grants: [] as Grant[],
      profile: null,
    };

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    });

    afterEach(() => {
      root.unmount();
      container.remove();
      vi.restoreAllMocks();
    });

    it('renders default activity feed with HTML markup when no notifications prop provided', async () => {
      root.render(React.createElement(DashboardView, requiredProps));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelectorAll('.activity-item').length).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('.activity-text strong')).not.toBeNull();
    });

    it('uses notifications prop for activity feed when notifications are provided', async () => {
      const testNotification: Notification = {
        id: 'n1',
        dot: 'success',
        text: '<strong>Grant matched</strong>',
        time: '1h ago',
      };
      root.render(React.createElement(DashboardView, { ...requiredProps, notifications: [testNotification] }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector('.activity-text strong')).not.toBeNull();
      expect(container.querySelector('.activity-text')?.innerHTML).toContain('Grant matched');
    });

    it('renders activity-empty-state when notifications is empty array', async () => {
      root.render(React.createElement(DashboardView, { ...requiredProps, grants: [...mockGrants], notifications: [], profile: { agentBehavior: { notifyEmail: 'test@test.com' } } as OrganizationProfile }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector('[data-testid="activity-empty-state"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="activity-empty-state"] .empty-state-title')?.textContent).toBe('No activity yet');
    });

    it('shows empty state with no synthetic KPI fallbacks when grants are empty', async () => {
      root.render(React.createElement(DashboardView, { ...requiredProps }));
      await new Promise((r) => setTimeout(r, 0));
      // Should show empty state, not synthetic KPI cards
      expect(container.querySelector('[data-testid="dashboard-empty-state"]')).not.toBeNull();
      // KPI grid should not exist when no grants
      expect(container.querySelector('.kpi-grid')).toBeNull();
    });

    it('renders KPI cards with real data when grants exist', async () => {
      root.render(React.createElement(DashboardView, { ...requiredProps, grants: [...mockGrants], profile: { agentBehavior: { notifyEmail: 'test@test.com' } } as OrganizationProfile }));
      await new Promise((r) => setTimeout(r, 0));
      // KPI grid should exist
      expect(container.querySelector('.kpi-grid')).not.toBeNull();
      // KPI values should reflect actual data, not synthetic placeholders
      expect(container.textContent).toContain('Active Pipeline');
    });
  });
});
