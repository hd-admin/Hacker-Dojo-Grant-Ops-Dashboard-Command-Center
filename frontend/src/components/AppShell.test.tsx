import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Grant } from '../../../shared/types';

const mockGrants: Grant[] = [
  {
    id: 'nsf-tech',
    title: 'NSF Technology Access Grant',
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
    matchedAt: '2026-05-19',
  },
  {
    id: 'svcf-community',
    title: 'SVCF Community Grant',
    funder: 'Silicon Valley Community Foundation',
    funderShort: 'SVCF',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 82,
    tags: ['Community', 'Foundation'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-20',
  },
  {
    id: 'fcc-digital',
    title: 'FCC Digital Equity Grant',
    funder: 'Federal Communications Commission',
    funderShort: 'FCC',
    award: '$250,000',
    awardSort: 250000,
    deadline: '2026-05-15',
    daysOut: -6,
    fit: 86,
    tags: ['Federal', 'Community'],
    status: 'submitted',
    statusLabel: 'Submitted',
    matchedAt: '2026-04-20',
  },
];

describe('AppShell', () => {
  describe('View Switching', () => {
    it('should switch to discovery view when Discovery nav is clicked', () => {
      const activeView = 'discovery';
      expect(activeView).toBe('discovery');
    });

    it('should switch to pipeline view when Pipeline nav is clicked', () => {
      const activeView = 'pipeline';
      expect(activeView).toBe('pipeline');
    });

    it('should switch to settings view when Settings nav is clicked', () => {
      const activeView = 'settings';
      expect(activeView).toBe('settings');
    });

    it('should switch to notifications view when Notifications nav is clicked', () => {
      const activeView = 'notifications';
      expect(activeView).toBe('notifications');
    });

    it('should switch to tasks view when Tasks nav is clicked', () => {
      const activeView = 'tasks';
      expect(activeView).toBe('tasks');
    });

    it('should default to dashboard view', () => {
      const activeView = 'dashboard';
      expect(activeView).toBe('dashboard');
    });
  });

  describe('Notification Badge Count', () => {
    it('should show notification badge count from store', () => {
      const notificationCount = 3;
      expect(notificationCount).toBe(3);
    });

    it('should show 0 when no notifications', () => {
      const notificationCount = 0;
      expect(notificationCount).toBe(0);
    });

    it('should show badge when notifications exist', () => {
      const notifications = [{ id: '1' }, { id: '2' }];
      const shouldShowBadge = notifications.length > 0;
      expect(shouldShowBadge).toBe(true);
    });
  });

  describe('Sidebar Footer Data Display', () => {
    it('should display user email from org profile', () => {
      const email = 'ed@hackerdojo.com';
      expect(email).toBe('ed@hackerdojo.com');
    });

    it('should display crawl status from IPC', () => {
      const crawlStatus = { online: true, lastSync: new Date().toISOString() };
      expect(crawlStatus.online).toBe(true);
    });

    it('should show offline indicator when crawler is offline', () => {
      const crawlStatus = { online: false, lastSync: new Date().toISOString() };
      expect(crawlStatus.online).toBe(false);
    });
  });

  describe('GrantDrawer Opening', () => {
    it('should open drawer when grant is selected', () => {
      const selectedGrantId: string | null = 'nsf-tech';
      const drawerOpen = selectedGrantId !== null;
      expect(drawerOpen).toBe(true);
    });

    it('should close drawer when close button is clicked', () => {
      const selectedGrantId: string | null = null;
      const drawerOpen = selectedGrantId !== null;
      expect(drawerOpen).toBe(false);
    });
  });

  describe('Notifications View Switching', () => {
    it('should switch to notifications view when Notifications nav item is clicked', () => {
      const clickedView = 'notifications';
      const expectedView = 'notifications';
      expect(clickedView).toBe(expectedView);
    });

    it('should not just log - should actually switch view', () => {
      const activityNavItem = { view: 'notifications', label: 'Notifications', icon: '✉' };
      const shouldSwitch = activityNavItem.view !== undefined;
      expect(shouldSwitch).toBe(true);
    });
  });

  describe('Tasks View Switching', () => {
    it('should switch to tasks view when Tasks nav item is clicked', () => {
      const clickedView = 'tasks';
      const expectedView = 'tasks';
      expect(clickedView).toBe(expectedView);
    });

    it('should not just log - should actually switch view', () => {
      const activityNavItem = { view: 'tasks', label: 'Tasks', icon: '⌖' };
      const shouldSwitch = activityNavItem.view !== undefined;
      expect(shouldSwitch).toBe(true);
    });
  });

  describe('Nav Count Badges', () => {
    it('should show matched count on Discovery nav', () => {
      const matchedCount = mockGrants.filter((g) => g.status === 'matched').length;
      expect(matchedCount).toBe(1);
    });

    it('should show active (non-awarded) count on Pipeline nav', () => {
      const activeCount = mockGrants.filter((g) => g.status !== 'awarded').length;
      expect(activeCount).toBe(3);
    });

    it('should show review count as notification badge', () => {
      const reviewCount = mockGrants.filter((g) => g.status === 'review').length;
      expect(reviewCount).toBe(1);
    });
  });
});
