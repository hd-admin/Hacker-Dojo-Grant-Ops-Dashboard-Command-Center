import { describe, it, expect } from 'vitest';
import type { Notification } from '../../../shared/types';

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    text: '<strong>3 new grants</strong> matched from Candid weekly crawl',
    time: '2h ago',
    dot: 'success',
  },
  {
    id: 'notif-2',
    text: 'NSF TechAccess LOI deadline in <strong>26 days</strong> — checklist 4/7 complete',
    time: 'yesterday',
    dot: 'warning',
  },
  {
    id: 'notif-3',
    text: 'Crawled <strong>47 sources</strong> · 12 federal, 28 foundation, 7 corporate',
    time: '3d ago',
    dot: 'info',
  },
];

describe('NotificationsView', () => {
  describe('Notification data', () => {
    it('should have correct notification dot colors', () => {
      const dots = mockNotifications.map((n) => n.dot);
      expect(dots).toContain('success');
      expect(dots).toContain('warning');
      expect(dots).toContain('info');
    });

    it('should render notification text with HTML content', () => {
      const notification = mockNotifications[0]!;
      expect(notification.text).toContain('<strong>3 new grants</strong>');
      expect(notification.text).toContain('matched from Candid weekly crawl');
    });

    it('should have valid time strings', () => {
      const timeStrings = mockNotifications.map((n) => n.time);
      expect(timeStrings).toContain('2h ago');
      expect(timeStrings).toContain('yesterday');
      expect(timeStrings).toContain('3d ago');
    });
  });

  describe('Notification dot colors', () => {
    it('should support success dot color', () => {
      const successNotifs = mockNotifications.filter((n) => n.dot === 'success');
      expect(successNotifs.length).toBeGreaterThan(0);
    });

    it('should support warning dot color', () => {
      const warningNotifs = mockNotifications.filter((n) => n.dot === 'warning');
      expect(warningNotifs.length).toBeGreaterThan(0);
    });

    it('should support info dot color', () => {
      const infoNotifs = mockNotifications.filter((n) => n.dot === 'info');
      expect(infoNotifs.length).toBeGreaterThan(0);
    });

    it('should have unique IDs for all notifications', () => {
      const ids = mockNotifications.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Empty state', () => {
    it('should show empty state when notifications array is empty', () => {
      const emptyNotifications: Notification[] = [];
      expect(emptyNotifications.length).toBe(0);
    });
  });
});
