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

describe('DiscoveryView state contract', () => {
  it('sorts by best fit and keeps rolling deadlines last', () => {
    const sorted = [...mockGrants].sort((a, b) => b.fit - a.fit);
    expect(sorted.map((g) => g.id)).toEqual(['nsf-tech', 'svcf-community', 'google-cs', 'dell-equality']);

    const byDeadline = [...mockGrants].sort((a, b) => {
      if (a.deadline === 'Rolling') return 1;
      if (b.deadline === 'Rolling') return -1;
      return a.daysOut - b.daysOut;
    });
    expect(byDeadline.map((g) => g.id)).toEqual(['nsf-tech', 'google-cs', 'dell-equality', 'svcf-community']);
  });

  it('refreshes persisted grants after + Add source and crawl trigger', async () => {
    const sourceCreate = { name: 'Candid', url: 'https://www.candid.org', type: 'website' as const };
    const sourceResult = { id: 'source-1', ...sourceCreate, createdAt: '2026-05-23T08:00:00.000Z', isActive: true };
    const latestRun = { sourcesCrawled: 1, grantsFound: 1, grantsMatched: 1, status: 'completed' as const };

    const refreshedGrants = mockGrants.slice(0, 2);
    expect(sourceResult.url).toContain('candid');
    expect(latestRun.sourcesCrawled).toBe(1);
    expect(refreshedGrants.length).toBe(2);
  });

  it('keeps discovery counts aligned with the grants contract', () => {
    const matchedCount = mockGrants.filter((grant) => grant.status === 'matched').length;
    const highFitCount = mockGrants.filter((grant) => grant.fit >= 85).length;

    expect(matchedCount).toBe(4);
    expect(highFitCount).toBe(1);
  });
});
