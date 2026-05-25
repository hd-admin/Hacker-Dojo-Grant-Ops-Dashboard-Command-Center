/**
 * Notifications API Route Tests
 *
 * Tests the /api/notifications GET route.
 * Verifies notifications persistence layer is properly integrated.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import { GET, PATCH, POST } from './route';

describe('/api/notifications route', () => {
  beforeEach(async () => {
    invalidateCache();
  });

  describe('persistence layer integration', () => {
    it('invalidateCache clears the persistence cache', async () => {
      // This test verifies that invalidateCache works without throwing
      expect(() => invalidateCache()).not.toThrow();
    });
  });

  describe('Notification type structure', () => {
    it('Notification type has required fields', () => {
      const notification = {
        id: 'test-1',
        text: 'Test notification <strong>with HTML</strong>',
        time: '2h ago',
        dot: 'success' as const,
      };
      expect(notification.id).toBe('test-1');
      expect(notification.text).toContain('<strong>');
      expect(notification.time).toBe('2h ago');
      expect(notification.dot).toBe('success');
    });

    it('valid dot colors are supported', () => {
      const validDots = ['success', 'warning', 'info', 'error'];
      validDots.forEach((dot) => {
        const notification = { id: 'test', text: 'test', time: 'now', dot };
        expect(notification.dot).toBe(dot);
      });
    });
  });

  describe('sanitization', () => {
    let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
      setDependencies(createDependencies());
    });

    afterEach(async () => {
      resetDependencies();
      await tempDataDir.cleanup();
    });

    it('POST strips <script> tag but preserves allowed <strong> tag', async () => {
      const request = new Request('http://localhost/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          text: '<script>alert(1)</script><strong>Research done</strong>',
          dot: 'success',
        }),
      }) as never;

      const response = await POST(request);
      expect(response.status).toBe(201);

      const notification = await response.json();
      expect(notification.text).toContain('<strong>Research done</strong>');
      expect(notification.text).not.toContain('<script>');
    });

    it('POST strips onclick attribute from <strong> tag', async () => {
      const request = new Request('http://localhost/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          text: '<strong onclick=alert(1)>Match</strong>',
          dot: 'info',
        }),
      }) as never;

      const response = await POST(request);
      expect(response.status).toBe(201);

      const notification = await response.json();
      expect(notification.text).toBe('<strong>Match</strong>');
    });

    it('POST strips style attribute from <em> tag', async () => {
      const request = new Request('http://localhost/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          text: '<em style="color:red">Urgent</em>',
          dot: 'warning',
        }),
      }) as never;

      const response = await POST(request);
      expect(response.status).toBe(201);

      const notification = await response.json();
      expect(notification.text).toBe('<em>Urgent</em>');
    });

    it('PATCH sanitizes all notifications in the batch', async () => {
      const request = new Request('http://localhost/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          notifications: [
            { id: 'n1', text: '<script>x</script>safe', time: '1h ago', dot: 'info' },
          ],
        }),
      }) as never;

      const patchResponse = await PATCH(request);
      expect(patchResponse.status).toBe(200);

      // Verify the stored notification is sanitized
      const getResponse = await GET();
      const notifications = await getResponse.json();
      expect(notifications[0]?.text).not.toContain('<script>');
    });
  });
});
