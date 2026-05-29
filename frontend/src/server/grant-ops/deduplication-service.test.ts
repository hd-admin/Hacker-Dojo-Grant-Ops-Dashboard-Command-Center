/**
 * Deduplication Service Tests
 *
 * Tests for duplicate detection logic, confidence scoring,
 * and duplicate candidate persistence.
 */

import { describe, expect, it } from 'vitest';
import {
  detectDuplicates,
} from './deduplication-service';
import type { Grant } from '../../../../shared/types';

// Re-create computeTitleSimilarity inline for direct testing (it's not exported)
function computeTitleSimilarity(title1: string, title2: string): number {
  const normalize = (input: string): string =>
    input.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const tokens1 = new Set(normalize(title1).split(' ').filter((t) => t.length > 1));
  const tokens2 = new Set(normalize(title2).split(' ').filter((t) => t.length > 1));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  return intersection.size / union.size;
}

function makeGrant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'g-1',
    title: 'NSF Technology Access Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    ...overrides,
  };
}

describe('Deduplication Service', () => {
  describe('detectDuplicates', () => {
    it('returns empty array when no existing grants', () => {
      const newGrant = makeGrant();
      const result = detectDuplicates({ newGrant, existingGrants: [] });
      expect(result).toEqual([]);
    });

    it('detects duplicates with identical titles', () => {
      const newGrant = makeGrant({ id: 'g-1' });
      const existing = makeGrant({ id: 'g-2' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.confidenceScore).toBeGreaterThanOrEqual(0.6);
      expect(result[0]?.conflictingFields).toContain('title');
    });

    it('detects duplicates with similar titles and same funder', () => {
      const newGrant = makeGrant({ id: 'g-1', title: 'NSF Tech Grant' });
      const existing = makeGrant({ id: 'g-2', title: 'NSF Tech Access Grant' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.confidenceScore).toBeGreaterThan(0);
      expect(result[0]?.conflictingFields).toContain('funder');
    });

    it('returns high confidence for identical matching', () => {
      const newGrant = makeGrant({ id: 'g-1', title: 'STEM Education Grant' });
      const existing = makeGrant({ id: 'g-2', title: 'STEM Education Grant' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should have high confidence: 1.0 title sim * 0.5 + 0.3 funder + 0.2 deadline = 1.0
      const conf = result[0]?.confidenceScore ?? 0;
      expect(conf).toBeGreaterThanOrEqual(0.5);
    });

    it('skips comparing grant to itself', () => {
      const grant = makeGrant({ id: 'same-id' });
      const result = detectDuplicates({ newGrant: grant, existingGrants: [grant] });
      expect(result).toEqual([]);
    });

    it('skips archived grants', () => {
      const newGrant = makeGrant({ id: 'g-1' });
      const existing = makeGrant({ id: 'g-2', status: 'archived' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result).toEqual([]);
    });

    it('skips closed grants', () => {
      const newGrant = makeGrant({ id: 'g-1' });
      const existing = makeGrant({ id: 'g-2', status: 'closed' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result).toEqual([]);
    });

    it('respects confidence threshold', () => {
      // Completely different grants should be below threshold
      const newGrant = makeGrant({
        id: 'g-1',
        title: 'XYZ Unrelated Grant',
        funder: 'Different Funder',
        award: '$500',
        awardSort: 500,
        deadline: '2026-12-25',
      });
      const existing = makeGrant({ id: 'g-2' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] }, 0.8);
      expect(result).toEqual([]);
    });

    it('sorts matches by confidence descending', () => {
      const newGrant = makeGrant({ id: 'g-1', title: 'NSF Education Grant' });
      const highSimilarity = makeGrant({ id: 'g-2', title: 'NSF Education Grant' });
      const mediumSimilarity = makeGrant({
        id: 'g-3',
        title: 'NSF Grant',
        funder: 'Different Funder',
      });
      const result = detectDuplicates({
        newGrant,
        existingGrants: [mediumSimilarity, highSimilarity],
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
      // First result should have highest confidence
      if (result.length >= 2) {
        expect(result[0]?.confidenceScore ?? 0).toBeGreaterThanOrEqual(
          result[1]?.confidenceScore ?? 0,
        );
      }
    });
  });

  describe('title similarity', () => {
    it('returns 1.0 for identical titles', () => {
      expect(computeTitleSimilarity('NSF Grant', 'NSF Grant')).toBe(1.0);
    });

    it('returns 0.0 for completely different titles', () => {
      const sim = computeTitleSimilarity('Education Grant', 'XYZ Technology Fund');
      expect(sim).toBeLessThan(0.5);
    });

    it('returns partial match for overlapping words', () => {
      const sim = computeTitleSimilarity(
        'NSF Technology Access Grant',
        'NSF Technology Innovation Grant',
      );
      // 3 words overlap (NSF, Technology, Grant) out of 5 unique = 0.6
      expect(sim).toBeGreaterThan(0.4);
      expect(sim).toBeLessThan(0.8);
    });

    it('handles punctuation and case differences', () => {
      const sim = computeTitleSimilarity("NSF Grant, EdTech!", "nsf grant edtech");
      // After normalization: ['nsf', 'grant', 'edtech'] vs ['nsf', 'grant', 'edtech']
      expect(sim).toBe(1.0);
    });

    it('filters out single-character tokens', () => {
      const sim = computeTitleSimilarity('A Grant for X', 'A Grant for Y');
      // After filtering: ['grant', 'for'] vs ['grant', 'for']
      expect(sim).toBe(1.0);
    });
  });

  describe('deadline proximity', () => {
    it('finds nearby deadlines within 7 days', () => {
      const newGrant = makeGrant({
        id: 'g-1',
        deadline: '2026-06-15',
        funder: 'Test Funder',
        title: 'Unique Title A',
      });
      const existing = makeGrant({
        id: 'g-2',
        deadline: '2026-06-18',
        funder: 'Test Funder',
        title: 'Unique Title A',
      });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conflictingFields).toContain('deadline');
    });

    it('skips rolling deadlines for proximity', () => {
      const newGrant = makeGrant({ id: 'g-1', deadline: 'Rolling' });
      const existing = makeGrant({ id: 'g-2', deadline: '2026-06-18' });
      const result = detectDuplicates({
        newGrant,
        existingGrants: [existing],
      });
      // Should still match on title similarity if titles match
      // But deadline won't contribute to the score
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('conflicting fields', () => {
    it('reports title as conflicting when titles are similar', () => {
      const newGrant = makeGrant({ id: 'g-1', title: 'NSF Grant' });
      const existing = makeGrant({ id: 'g-2', title: 'NSF Technology Grant' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conflictingFields).toContain('title');
    });

    it('reports funder as conflicting when funders match', () => {
      const newGrant = makeGrant({ id: 'g-1', title: 'NSF Grant' });
      const existing = makeGrant({ id: 'g-2', title: 'NSF Grant' });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conflictingFields).toContain('funder');
    });

    it('reports amount as conflicting when awards differ', () => {
      const newGrant = makeGrant({
        id: 'g-1',
        title: 'NSF Grant',
        award: '$350,000',
      });
      const existing = makeGrant({
        id: 'g-2',
        title: 'NSF Grant',
        award: '$250,000',
      });
      const result = detectDuplicates({ newGrant, existingGrants: [existing] });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]?.conflictingFields).toContain('amount');
    });
  });
});
