import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { CrawlRun, Grant, Notification, OrganizationProfile, Task } from '../../../shared/types';

const { grantsGetAll, profileGet, notificationsGetAll, tasksGetAll, researchGetRuns } = vi.hoisted(
  () => ({
    grantsGetAll: vi.fn(),
    profileGet: vi.fn(),
    notificationsGetAll: vi.fn(),
    tasksGetAll: vi.fn(),
    researchGetRuns: vi.fn(),
  }),
);

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: grantsGetAll },
    profile: { get: profileGet },
    notifications: { getAll: notificationsGetAll },
    tasks: { getAll: tasksGetAll },
    research: { getRuns: researchGetRuns },
  },
}));

vi.mock('./DashboardView', () => ({
  default: ({ onGrantSelect, onRefreshAppState }: { onGrantSelect: (id: string) => void; onRefreshAppState?: () => Promise<void> | void }) => (
    <div>
      <button type="button" onClick={() => onGrantSelect('grant-1')}>
        select grant
      </button>
      <button type="button" onClick={() => onRefreshAppState?.()}>
        refresh dashboard
      </button>
    </div>
  ),
}));

vi.mock('./DiscoveryView', () => ({
  default: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh discovery
    </button>
  ),
}));

vi.mock('./PipelineView', () => ({ default: () => <div>pipeline</div> }));
vi.mock('./SettingsView', () => ({
  default: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh settings
    </button>
  ),
}));
vi.mock('./NotificationsView', () => ({ default: () => <div>notifications</div> }));
vi.mock('./TasksView', () => ({
  default: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh tasks
    </button>
  ),
}));
vi.mock('./GrantDrawer', () => ({
  default: ({ grantId, onRefreshAppState }: { grantId: string | null; onRefreshAppState?: () => Promise<void> | void }) =>
    grantId ? (
      <div>
        <button type="button" onClick={() => onRefreshAppState?.()}>
          refresh drawer
        </button>
        <div>{grantId}</div>
      </div>
    ) : null,
}));

import AppShell from './AppShell';

const initialGrants: Grant[] = [
  {
    id: 'grant-1',
    title: 'NSF Technology Access Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Science & Tech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
  },
];

const refreshedGrants: Grant[] = [
  ...initialGrants,
  {
    id: 'grant-2',
    title: 'Community Innovation Fund',
    funder: 'Candid',
    funderShort: 'Candid',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 82,
    tags: ['Community'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-23',
  },
];

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  mission: 'Community innovation and education',
  docTypes: ['PDF'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

const notifications: Notification[] = [{ id: 'n1', text: 'New grant matched', time: '1h ago', dot: 'blue' }];
const tasks: Task[] = [{ id: 't1', text: 'Review uploaded PDF', completed: false }];
const initialRun: CrawlRun = {
  id: 'run-1',
  status: 'failed',
  startedAt: '2026-05-23T07:00:00.000Z',
  completedAt: '2026-05-23T07:05:00.000Z',
  sourcesCrawled: 1,
  grantsFound: 1,
  grantsMatched: 1,
};
const refreshedRun: CrawlRun = {
  id: 'run-2',
  status: 'completed',
  startedAt: '2026-05-23T08:00:00.000Z',
  completedAt: '2026-05-23T08:05:00.000Z',
  sourcesCrawled: 2,
  grantsFound: 2,
  grantsMatched: 2,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  grantsGetAll.mockReset();
  profileGet.mockReset();
  notificationsGetAll.mockReset();
  tasksGetAll.mockReset();
  researchGetRuns.mockReset();

  grantsGetAll.mockResolvedValueOnce(initialGrants).mockResolvedValue(refreshedGrants);
  profileGet.mockResolvedValue(profile);
  notificationsGetAll.mockResolvedValue(notifications);
  tasksGetAll.mockResolvedValue(tasks);
  researchGetRuns
    .mockResolvedValueOnce({ latestRun: initialRun, allRuns: [initialRun] })
    .mockResolvedValue({ latestRun: refreshedRun, allRuns: [initialRun, refreshedRun] });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe('AppShell', () => {
  it('refreshes shell-owned badges and footer state when child views mutate state', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="discovery"] .nav-count')?.textContent === '1');

    expect(container.querySelector('.nav-item[data-view="notifications"] .nav-count')?.textContent).toBe('1');
    expect(container.querySelector('.nav-item[data-view="tasks"] .nav-count')?.textContent).toBe('1');
    expect(container.textContent).toContain('Crawler offline');
    expect(container.textContent).toContain('ed@hackerdojo.com');

    Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('refresh discovery'),
    )?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('.nav-item[data-view="discovery"] .nav-count')?.textContent === '2');

    expect(researchGetRuns).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Crawler online');

    Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('select grant'),
    )?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.textContent?.includes('grant-1') === true);

    Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('refresh drawer'),
    )?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => grantsGetAll.mock.calls.length === 3);

    expect(researchGetRuns).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.nav-item[data-view="discovery"] .nav-count')?.textContent).toBe('2');
  });
});
