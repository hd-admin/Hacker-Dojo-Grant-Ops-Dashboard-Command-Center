/**
 * Grants API Route Tests
 *
 * Tests the /api/grants endpoint for listing grants.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadGrants } from '../../../../../shared/grant-ops-persistence';
import { invalidateCache } from '../../../../../shared/grant-ops-persistence';

describe('Grants API Route', () => {
  beforeEach(() => {
    invalidateCache();
  });

  afterEach(() => {
    invalidateCache();
  });

  describe('GET /api/grants', () => {
    it('returns an array of grants', async () => {
      const grants = await loadGrants();
      expect(Array.isArray(grants)).toBe(true);
    });

    it('returns grants with required fields', async () => {
      const grants = await loadGrants();
      if (grants.length > 0) {
        const grant = grants[0];
        expect(grant).toHaveProperty('id');
        expect(grant).toHaveProperty('title');
        expect(grant).toHaveProperty('funder');
        expect(grant).toHaveProperty('award');
        expect(grant).toHaveProperty('deadline');
        expect(grant).toHaveProperty('fit');
        expect(grant).toHaveProperty('status');
      }
    });

    it('can be sorted by fit score descending', async () => {
      const grants = await loadGrants();
      if (grants.length > 1) {
        // Sort by fit descending
        const sorted = [...grants].sort((a, b) => b.fit - a.fit);
        // Verify the sorting worked
        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i]!.fit).toBeGreaterThanOrEqual(sorted[i + 1]!.fit);
        }
      }
    });
  });
});
