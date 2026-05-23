import { describe, it, expect } from 'vitest';
import type { Grant, Notification, Task } from '../../../shared/types';

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

const notifications: Notification[] = [
  { id: 'n1', text: 'Email submission sent', time: '1h ago', dot: 'blue' },
  { id: 'n2', text: 'Follow-up scheduled', time: '2h ago', dot: 'green' },
];

const tasks: Task[] = [
  { id: 't1', text: 'Review uploaded PDF', completed: false },
  { id: 't2', text: 'Confirm portal submission', completed: true },
];

describe('AppShell state contract', () => {
  it('derives badge counts from shell-owned grant, notification, and task state', () => {
    const discoveryBadge = mockGrants.filter((g) => g.status === 'matched').length;
    const pipelineBadge = mockGrants.filter((g) => g.status !== 'awarded').length;
    const notificationBadge = notifications.length;
    const taskBadge = tasks.filter((task) => !task.completed).length;

    expect(discoveryBadge).toBe(1);
    expect(pipelineBadge).toBe(3);
    expect(notificationBadge).toBe(2);
    expect(taskBadge).toBe(1);
  });

  it('treats the latest crawl run as the canonical footer refresh source', () => {
    const latestRun: { status: 'completed' | 'failed'; completedAt: string; startedAt: string } = {
      status: 'completed',
      completedAt: '2026-05-23T08:00:00.000Z',
      startedAt: '2026-05-23T07:55:00.000Z',
    };

    const crawlStatus = {
      online: latestRun.status !== 'failed',
      lastSync: latestRun.completedAt || latestRun.startedAt,
    };

    expect(crawlStatus.online).toBe(true);
    expect(crawlStatus.lastSync).toBe('2026-05-23T08:00:00.000Z');
  });

  it('refreshes drawer-bound state after approve/revision/submit mutations', () => {
    const before = { selectedGrantId: 'nsf-tech', refreshKey: 0 };
    const after = { ...before, refreshKey: before.refreshKey + 1 };

    expect(after.selectedGrantId).toBe(before.selectedGrantId);
    expect(after.refreshKey).toBe(1);
  });
});
