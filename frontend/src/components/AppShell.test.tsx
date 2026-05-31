// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { CrawlRun, Grant, Notification, OrganizationProfile, Task } from '../../../shared/types';

const { grantsGetAll, profileGet, notificationsGetAll, tasksGetAll, sourcesGetAll, researchGetRuns, duplicatesGetAll } = vi.hoisted(
  () => ({
    grantsGetAll: vi.fn(),
    profileGet: vi.fn(),
    notificationsGetAll: vi.fn(),
    tasksGetAll: vi.fn(),
    sourcesGetAll: vi.fn(),
    researchGetRuns: vi.fn(),
    duplicatesGetAll: vi.fn().mockResolvedValue([]),
  }),
);

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: grantsGetAll },
    profile: { get: profileGet },
    notifications: { getAll: notificationsGetAll },
    tasks: { getAll: tasksGetAll },
    sources: { getAll: sourcesGetAll },
    research: { getRuns: researchGetRuns },
    duplicates: { getAll: duplicatesGetAll },
    opencodeSettings: { get: vi.fn().mockResolvedValue({ binaryPath: '', workingDirectory: '', timeoutMs: 60000, isConfigured: false }), update: vi.fn().mockResolvedValue({ success: true }) },
    documents: { getAll: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'doc-1', name: 'test' }) },
    backup: { getFreshness: vi.fn().mockResolvedValue({ lastBackupAt: null, isStale: false }), exportBackup: vi.fn().mockResolvedValue({ version: '1.0', createdAt: '' }), restore: vi.fn().mockResolvedValue({ success: true }) },
    themes: {
      get: vi.fn().mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] }),
      update: vi.fn().mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] }),
      rescore: vi.fn().mockResolvedValue({ success: true, rescored: 0 }),
    },
  },
}));

let capturedDashboardNotifications: Notification[] | undefined;

vi.mock('./DashboardView', () => ({
  default: ({
    onGrantSelect,
    onRefreshAppState,
    notifications,
  }: {
    onGrantSelect: (id: string) => void;
    onRefreshAppState?: () => Promise<void> | void;
    notifications?: Notification[];
  }) => {
    capturedDashboardNotifications = notifications;
    return (
      <div>
        <button type="button" onClick={() => onGrantSelect('grant-1')}>
          select grant
        </button>
        <button type="button" onClick={() => onRefreshAppState?.()}>
          refresh dashboard
        </button>
      </div>
    );
  },
}));

vi.mock('./DiscoveryView', () => ({
  default: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh discovery
    </button>
  ),
}));

vi.mock('./SourcesView', () => ({
  default: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh sources
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
vi.mock('./DuplicatesView', () => ({ default: () => <div>duplicates</div> }));
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
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,contactInfo: {},
  geography: 'Regional',
  mission: 'Community innovation and education',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],docTypes: ['PDF'],
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
let fetchMock: ReturnType<typeof vi.fn>;

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
  const localStorageStore = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageStore.set(key, value);
      },
      removeItem: (key: string) => {
        localStorageStore.delete(key);
      },
      clear: () => {
        localStorageStore.clear();
      },
      key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
      get length() {
        return localStorageStore.size;
      },
    },
  });
  capturedDashboardNotifications = undefined;
  grantsGetAll.mockReset();
  profileGet.mockReset();
  notificationsGetAll.mockReset();
  tasksGetAll.mockReset();
  sourcesGetAll.mockReset();
  researchGetRuns.mockReset();

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/health') {
      return new Response(JSON.stringify({
        storage: 'ok',
        opencode: 'ok',
        opencodeVersion: '1.0.0',
        crawlerStatus: 'ok',
        documentIndexer: 'ok',
      }), { headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/crawl/scheduled?trigger=true') {
      return new Response(JSON.stringify({ triggered: 0 }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);

  grantsGetAll.mockResolvedValueOnce(initialGrants).mockResolvedValue(refreshedGrants);
  profileGet.mockResolvedValue(profile);
  notificationsGetAll.mockResolvedValue(notifications);
  tasksGetAll.mockResolvedValue(tasks);
  sourcesGetAll.mockResolvedValue([]);
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
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('refreshes shell-owned badges and footer state when child views mutate state', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="discovery"] .nav-count')?.textContent === '1');

    expect(fetchMock).toHaveBeenCalledWith('/api/crawl/scheduled?trigger=true');
    expect(container.querySelector('.nav-item[data-view="settings"]')?.textContent).toContain('Settings');
    expect(container.querySelector('.nav-item[data-view="notifications"] .nav-count')?.textContent).toBe('1');
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

  it('shows a storage-blocked screen and hides navigation when storage health fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(JSON.stringify({
          storage: 'error',
          storageError: 'Disk unavailable',
          opencode: 'ok',
          crawlerStatus: 'never-run',
          documentIndexer: 'ok',
        }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ triggered: 0 }), { headers: { 'content-type': 'application/json' } });
    });

    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('[data-testid="storage-blocked-banner"]') !== null);

    expect(container.querySelector('.sidebar')).toBeNull();
    expect(container.querySelector('[data-view="dashboard"]')).toBeNull();
    expect(container.textContent).toContain('Storage unavailable: Disk unavailable');
  });

  it('shows opencode degraded guidance when the AI runtime is unavailable', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(JSON.stringify({
          storage: 'ok',
          opencode: 'not-installed',
          crawlerStatus: 'never-run',
          documentIndexer: 'ok',
        }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ triggered: 0 }), { headers: { 'content-type': 'application/json' } });
    });

    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('[data-testid="opencode-degraded-banner"]') !== null);

    expect(container.querySelector('[data-testid="opencode-degraded-banner"]')).not.toBeNull();
  });

  it('passes backend notifications to DashboardView after refreshAppState resolves', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => capturedDashboardNotifications !== undefined && capturedDashboardNotifications.length > 0);
    expect(capturedDashboardNotifications).toEqual(notifications);
  });

  it('Discovery and Sources nav items are not disabled in degraded mode', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') return new Response(JSON.stringify({ storage: 'ok', opencode: 'not-installed', crawlerStatus: 'never-run', documentIndexer: 'ok' }), { headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ triggered: 0 }), { headers: { 'content-type': 'application/json' } });
    });
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('[data-testid="opencode-degraded-banner"]') !== null);
    const discoveryBtn = container.querySelector('button.nav-item[data-view="discovery"]') as HTMLButtonElement | null;
    const sourcesBtn = container.querySelector('button.nav-item[data-view="sources"]') as HTMLButtonElement | null;
    expect(discoveryBtn?.disabled).toBe(false);
    expect(sourcesBtn?.disabled).toBe(false);
  });

  it('DiscoveryView renders in degraded mode rather than being replaced by a blocking banner', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') return new Response(JSON.stringify({ storage: 'ok', opencode: 'not-installed', crawlerStatus: 'never-run', documentIndexer: 'ok' }), { headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ triggered: 0 }), { headers: { 'content-type': 'application/json' } });
    });
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('[data-testid="opencode-degraded-banner"]') !== null);
    const discoveryBtn = container.querySelector('button.nav-item[data-view="discovery"]');
    discoveryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('#view-discovery')?.classList.contains('active') === true);
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('refresh discovery'));
    expect(refreshBtn).not.toBeNull();
  });

  it('preserves recentDraftId in the stored working context', async () => {
    window.localStorage.setItem('grantops.workingContext', JSON.stringify({
      activeView: 'dashboard',
      selectedGrantId: null,
      recentGrantIds: [],
      recentDraftId: 'draft-99',
    }));

    root.render(React.createElement(AppShell));
    await waitFor(() => window.localStorage.getItem('grantops.workingContext') !== null);

    const context = JSON.parse(window.localStorage.getItem('grantops.workingContext') ?? '{}') as { recentDraftId?: string };
    expect(context.recentDraftId).toBe('draft-99');
  });

  it('renders duplicates nav item in the sidebar', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="duplicates"]') !== null);

    const duplicatesNav = container.querySelector('.nav-item[data-view="duplicates"]');
    expect(duplicatesNav).not.toBeNull();
    expect(duplicatesNav?.textContent).toContain('Duplicates');
  });

  it('shows pending duplicates count badge when duplicates exist', async () => {
    duplicatesGetAll.mockResolvedValue([
      { id: 'dup-1', grantId1: 'grant-1', grantId2: 'grant-2', confidenceScore: 0.9, status: 'pending', detectedAt: new Date().toISOString(), conflictingFields: ['title'] },
    ]);

    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="duplicates"] .nav-count') !== null);

    const badge = container.querySelector('.nav-item[data-view="duplicates"] .nav-count');
    expect(badge?.textContent).toBe('1');
  });

  it('navigates to duplicates view on click', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="duplicates"]') !== null);

    const duplicatesNav = container.querySelector('.nav-item[data-view="duplicates"]') as HTMLElement;
    duplicatesNav?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.querySelector('#view-duplicates')?.classList.contains('active') === true);
    expect(container.querySelector('#view-duplicates.active')).not.toBeNull();
  });

  it('renders v2 Calendar and Post-Award nav items in the workspace section', async () => {
    root.render(React.createElement(AppShell));
    await waitFor(() => container.querySelector('.nav-item[data-view="calendar"]') !== null);

    const calendarNav = container.querySelector('.nav-item[data-view="calendar"]');
    const postAwardNav = container.querySelector('.nav-item[data-view="post-award"]');
    expect(calendarNav).not.toBeNull();
    expect(calendarNav?.textContent).toContain('Calendar');
    expect(postAwardNav).not.toBeNull();
    expect(postAwardNav?.textContent).toContain('Post-Award');
  });
});
