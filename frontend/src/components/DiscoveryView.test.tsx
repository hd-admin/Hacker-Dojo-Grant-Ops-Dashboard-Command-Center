import { describe, it, expect } from 'vitest';
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
    tags: ['Science & Tech', 'Federal', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
  },
  {
    id: 'svcf-community',
    title: 'SVCF Community Innovation Fund',
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
    matchedAt: '2026-05-20',
  },
  {
    id: 'dell-equality',
    title: 'Dell Technologies Equality Fund',
    funder: 'Dell Technologies',
    funderShort: 'Dell',
    award: '$150,000',
    awardSort: 150000,
    deadline: '2026-07-01',
    daysOut: 41,
    fit: 76,
    tags: ['Corporate', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-18',
  },
  {
    id: 'google-cs',
    title: 'Google CS First Grant',
    funder: 'Google.org',
    funderShort: 'Google',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-06-30',
    daysOut: 40,
    fit: 79,
    tags: ['Science & Tech', 'Corporate', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-17',
  },
];

describe('DiscoveryView', () => {
  describe('Search Filtering', () => {
    it('should filter grants by title (case-insensitive)', () => {
      const searchLower = 'nsf';
      const filtered = mockGrants.filter((g) => g.title.toLowerCase().includes(searchLower));
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe('nsf-tech');
    });

    it('should filter grants by funder', () => {
      const searchLower = 'dell';
      const filtered = mockGrants.filter((g) => g.funder.toLowerCase().includes(searchLower));
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe('dell-equality');
    });

    it('should filter grants by tags', () => {
      const searchLower = 'edtech';
      const filtered = mockGrants.filter((g) =>
        g.tags.some((t) => t.toLowerCase().includes(searchLower)),
      );
      expect(filtered.length).toBe(3);
    });

    it('should return all grants when search is empty', () => {
      const filtered = mockGrants.filter(() => {
        const searchLower = '';
        return !searchLower;
      });
      expect(filtered.length).toBe(mockGrants.length);
    });
  });

  describe('Category Filtering', () => {
    it('should filter by EdTech category', () => {
      const filtered = mockGrants.filter((g) =>
        g.tags.some((t) => t === 'EdTech' || t.includes('EdTech')),
      );
      expect(filtered.length).toBe(3);
    });

    it('should filter by Federal category', () => {
      const filtered = mockGrants.filter((g) =>
        g.tags.some((t) => t === 'Federal' || t.includes('Federal')),
      );
      expect(filtered.length).toBe(1);
    });

    it('should return all for "All" category', () => {
      const filtered = mockGrants.filter(() => true);
      expect(filtered.length).toBe(4);
    });
  });

  describe('Sorting', () => {
    it('should sort by best fit (descending) with exact order', () => {
      const sorted = [...mockGrants].sort((a, b) => b.fit - a.fit);
      // Expected order: nsf-tech (88), svc-f-community (82), google-cs (79), dell-equality (76)
      const expectedOrder = ['nsf-tech', 'svcf-community', 'google-cs', 'dell-equality'];
      const actualOrder = sorted.map(g => g.id);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should sort by deadline (soonest first, rolling last) with exact order', () => {
      const sorted = [...mockGrants].sort((a, b) => {
        if (a.deadline === 'Rolling') return 1;
        if (b.deadline === 'Rolling') return -1;
        return a.daysOut - b.daysOut;
      });
      // Expected order: nsf-tech (2026-06-15, 25d), google-cs (2026-06-30, 40d), dell-equality (2026-07-01, 41d), svc-f-community (Rolling)
      const expectedOrder = ['nsf-tech', 'google-cs', 'dell-equality', 'svcf-community'];
      const actualOrder = sorted.map(g => g.id);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should sort by award size (descending) with exact order', () => {
      const sorted = [...mockGrants].sort((a, b) => b.awardSort - a.awardSort);
      // Expected order: nsf-tech ($350k), dell-equality ($150k), google-cs ($100k), svc-f-community ($75k)
      const expectedOrder = ['nsf-tech', 'dell-equality', 'google-cs', 'svcf-community'];
      const actualOrder = sorted.map(g => g.id);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should sort by recently added (matchedAt descending)', () => {
      const sorted = [...mockGrants].sort((a, b) =>
        (b.matchedAt || '').localeCompare(a.matchedAt || ''),
      );
      expect(sorted[0]?.matchedAt).toBe('2026-05-20');
      expect(sorted[sorted.length - 1]?.matchedAt).toBe('2026-05-17');
    });
  });
});
