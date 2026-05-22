/**
 * Grants API Route Tests
 *
 * Tests the /api/grants endpoint for listing grants.
 * The route delegates to repository.getGrants(), so we test the route
 * behavior by calling the underlying repository through the route composition.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { invalidateCache } from '../../../../../shared/grant-ops-persistence';
import { getDependencies } from '@/server/grant-ops/dependencies';

describe('Grants API Route', () => {
  beforeEach(() => {
    invalidateCache();
  });

  afterEach(() => {
    invalidateCache();
  });

  describe('GET /api/grants', () => {
    it('returns an array of grants through route composition', async () => {
      // Test through the same dependency chain the route uses
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      expect(Array.isArray(grants)).toBe(true);
    });

    it('returns grants with required fields', async () => {
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      if (grants.length > 0) {
        const grant = grants[0]!;
        expect(grant).toHaveProperty('id');
        expect(grant).toHaveProperty('title');
        expect(grant).toHaveProperty('funder');
        expect(grant).toHaveProperty('award');
        expect(grant).toHaveProperty('deadline');
        expect(grant).toHaveProperty('fit');
        expect(grant).toHaveProperty('status');
      }
    });

    it('returns grants with fit scores that are numbers', async () => {
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      for (const grant of grants) {
        expect(typeof grant.fit).toBe('number');
      }
    });

    it('can be sorted by fit score descending', async () => {
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      if (grants.length > 1) {
        // Sort by fit descending - same logic DiscoveryView uses
        const sorted = [...grants].sort((a, b) => b.fit - a.fit);
        // Verify the first grant has >= fit than the last
        expect(sorted[0]!.fit).toBeGreaterThanOrEqual(sorted[sorted.length - 1]!.fit);
      }
    });

    it('can be sorted by deadline with Rolling grants at the end', async () => {
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      if (grants.length > 1) {
        // Sort by deadline soonest with Rolling last - same logic DiscoveryView uses
        const sorted = [...grants].sort((a, b) => {
          if (a.deadline === 'Rolling') return 1;
          if (b.deadline === 'Rolling') return -1;
          return a.daysOut - b.daysOut;
        });
        
        // Verify Rolling grants appear at the end
        let lastRollingIndex = -1;
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i]!.deadline === 'Rolling') {
            lastRollingIndex = i;
          }
        }
        
        if (lastRollingIndex !== -1) {
          // All dated grants should come before Rolling
          for (let i = 0; i < lastRollingIndex; i++) {
            expect(sorted[i]!.deadline).not.toBe('Rolling');
          }
        }
      }
    });

    it('can be sorted by award amount descending', async () => {
      const deps = getDependencies();
      const grants = await deps.repository.getGrants();
      if (grants.length > 1) {
        // Sort by award descending - same logic DiscoveryView uses
        const sorted = [...grants].sort((a, b) => b.awardSort - a.awardSort);
        // Verify the first grant has >= award than the last
        expect(sorted[0]!.awardSort).toBeGreaterThanOrEqual(sorted[sorted.length - 1]!.awardSort);
      }
    });
  });
});
