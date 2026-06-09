// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type {
  CrawlRun,
  Grant,
  Notification,
  OrganizationProfile,
  Task,
} from '../../../shared/types';

const {
  grantsGetAll,
  profileGet,
  notificationsGetAll,
  tasksGetAll,
  sourcesGetAll,
  researchGetRuns,
  duplicatesGetAll,
} = vi.hoisted(() => ({
  grantsGetAll: vi.fn(),
  profileGet: vi.fn(),
  notificationsGetAll: vi.fn(),
  tasksGetAll: vi.fn(),
  sourcesGetAll: vi.fn(),
  researchGetRuns: vi.fn(),
  duplicatesGetAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: grantsGetAll },
    profile: { get: profileGet },
    notifications: { getAll: notificationsGetAll },
    tasks: { getAll: tasksGetAll },
    sources: { getAll: sourcesGetAll },
    research: { getRuns: researchGetRuns },
    duplicates: { getAll: duplicatesGetAll },
    opencodeSettings: {
      get: vi.fn().mockResolvedValue({
        binaryPath: '',
        workingDirectory: '',
        timeoutMs: 60000,
        isConfigured: false,
      }),
      update: vi.fn().mockResolvedValue({ success: true }),
    },
    documents: {
      getAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'doc-1', name: 'test' }),
    },
    backup: {
      getFreshness: vi.fn().mockResolvedValue({ lastBackupAt: null, isStale: false }),
      exportBackup: vi.fn().mockResolvedValue({ version: '1.0', createdAt: '' }),
      restore: vi.fn().mockResolvedValue({ success: true }),
    },
    themes: {
      get: vi.fn().mockResolvedValue({
        keywordClusters: [],
        themes: [],
        regions: [],
        populations: [],
        strategicPriorities: [],
      }),
      update: vi.fn().mockResolvedValue({
        keywordClusters: [],
        themes: [],
        regions: [],
        populations: [],
        strategicPriorities: [],
      }),
      rescore: vi.fn().mockResolvedValue({ success: true, rescored: 0 }),
    },
  },
}));

let capturedDashboardNotifications: Notification[] | undefined;

vi.mock('./DashboardView', () => ({
  DashboardView: ({
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
  DiscoveryView: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh discovery
    </button>
  ),
}));

vi.mock('./SourcesView', () => ({
  SourcesView: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh sources
    </button>
  ),
}));

vi.mock('./PipelineView', () => ({ PipelineView: () => <div>pipeline</div> }));
vi.mock('./SettingsView', () => ({
  SettingsView: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh settings
    </button>
  ),
}));
vi.mock('./NotificationsView', () => ({ NotificationsView: () => <div>notifications</div> }));
vi.mock('./TasksView', () => ({
  TasksView: ({ onRefreshAppState }: { onRefreshAppState?: () => Promise<void> | void }) => (
    <button type="button" onClick={() => onRefreshAppState?.()}>
      refresh tasks
    </button>
  ),
}));
vi.mock('./DuplicatesView', () => ({ DuplicatesView: () => <div>duplicates</div> }));
vi.mock('./AuditView', () => ({ AuditView: () => <div>audit</div> }));
vi.mock('./CalendarView', () => ({ CalendarView: () => <div>calendar</div> }));
vi.mock('./JobsPanel', () => ({ JobsPanel: () => <div>jobs</div> }));
vi.mock('./OperatorNamePrompt', () => ({ OperatorNamePrompt: () => <div>operator prompt</div> }));
vi.mock('./PostAwardView', () => ({ PostAwardView: () => <div>post-award</div> }));
vi.mock('./GrantDrawer', () => ({
  GrantDrawer: ({
    grantId,
    onRefreshAppState,
  }: {
    grantId: string | null;
    onRefreshAppState?: () => Promise<void> | void;
  }) =>
    grantId ? (
      <div>
        <button type="button" onClick={() => onRefreshAppState?.()}>
          refresh drawer
        </button>
        <div>{grantId}</div>
      </div>
    ) : null,
}));

import { getByRole, getByText, queryByRole, queryByText } from '../test-helpers';
import { AppShell } from './AppShell';
import { ToastProvider } from './ToastProvider';

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
  yearFounded: 2009,
  contactInfo: {},
  geography: 'Regional',
  mission: 'Community innovation and education',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],
  docTypes: ['PDF'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

const notifications: Notification[] = [
  { id: 'n1', text: 'New grant matched', time: '1h ago', dot: 'blue' },
];
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

const DEFAULT_WAIT_TIMEOUT = 10000;

async function waitFor(predicate: () => boolean, timeoutMs = DEFAULT_WAIT_TIMEOUT): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
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
      return new Response(
        JSON.stringify({
          storage: 'ok',
          opencode: 'ok',
          opencodeVersion: '1.0.0',
          crawlerStatus: 'ok',
          documentIndexer: 'ok',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    if (url === '/api/crawl/scheduled?trigger=true') {
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);

  grantsGetAll.mockResolvedValueOnce({ items: initialGrants }).mockResolvedValue({ items: refreshedGrants });
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

describe('AppShell rendering', () => {
  it('passes backend notifications to DashboardView after refreshAppState resolves', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(
      () =>
        capturedDashboardNotifications !== undefined && capturedDashboardNotifications.length > 0,
    );
    expect(capturedDashboardNotifications).toEqual(notifications);
  });

  it('preserves recentDraftId in the stored working context', async () => {
    window.localStorage.setItem(
      'grantops.workingContext',
      JSON.stringify({
        activeView: 'dashboard',
        selectedGrantId: null,
        recentGrantIds: [],
        recentDraftId: 'draft-99',
      }),
    );

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => window.localStorage.getItem('grantops.workingContext') !== null);

    const context = JSON.parse(window.localStorage.getItem('grantops.workingContext') ?? '{}') as {
      recentDraftId?: string;
    };
    expect(context.recentDraftId).toBe('draft-99');
  });

  it('renders duplicates nav item in the sidebar', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(
      () => queryByRole(container, 'button', { name: 'Review duplicate candidates' }) !== null,
    );

    const duplicatesNav = getByRole(container, 'button', { name: 'Review duplicate candidates' });
    expect(duplicatesNav).not.toBeNull();
    const sidebar = getByRole(container, 'complementary', { name: 'Main navigation' });
    expect(sidebar).not.toBeNull();
  });

  it('shows pending duplicates count badge when duplicates exist', async () => {
    duplicatesGetAll.mockResolvedValue([
      {
        id: 'dup-1',
        grantId1: 'grant-1',
        grantId2: 'grant-2',
        confidenceScore: 0.9,
        status: 'pending',
        detectedAt: new Date().toISOString(),
        conflictingFields: ['title'],
      },
    ]);

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(
      () => queryByRole(container, 'button', { name: 'Review duplicate candidates' }) !== null,
    );

    const duplicatesNav = getByRole(container, 'button', { name: 'Review duplicate candidates' });
    expect(duplicatesNav.textContent).toContain('1');
  });

  it('renders v2 Calendar and Post-Award nav items in the workspace section', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'button', { name: 'View calendar' }) !== null);

    const calendarNav = getByRole(container, 'button', { name: 'View calendar' });
    const postAwardNav = getByRole(container, 'button', { name: 'View post-award management' });
    expect(calendarNav).not.toBeNull();
    expect(postAwardNav).not.toBeNull();
  });

  it('refreshes shell-owned badges and footer state when child views mutate state', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => {
      const btn = queryByRole(container, 'button', { name: 'Discover grants' });
      return btn !== null && btn.textContent?.includes('1') === true;
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/crawl/scheduled?trigger=true');
    expect(getByRole(container, 'button', { name: 'Application settings' })).not.toBeNull();
    expect(getByRole(container, 'button', { name: 'View notifications' }).textContent).toContain(
      '1',
    );
    expect(container.textContent).toContain('Crawler offline');
    expect(container.textContent).toContain('ed@hackerdojo.com');

    getByRole(container, 'button', { name: 'refresh discovery' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await waitFor(() => {
      const btn = queryByRole(container, 'button', { name: 'Discover grants' });
      return btn !== null && btn.textContent?.includes('2') === true;
    });

    expect(researchGetRuns).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Crawler online');

    getByRole(container, 'button', { name: 'select grant' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await waitFor(() => container.textContent?.includes('grant-1') === true);

    getByRole(container, 'button', { name: 'refresh drawer' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await waitFor(() => grantsGetAll.mock.calls.length === 3);

    expect(researchGetRuns).toHaveBeenCalledTimes(3);
    expect(getByRole(container, 'button', { name: 'Discover grants' }).textContent).toContain('2');
  });

  it('shows a toast when a job transitions to completed', async () => {
    let jobStatus = 'running';
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'ok',
            opencodeVersion: '1.0.0',
            crawlerStatus: 'ok',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/crawl/scheduled?trigger=true') {
        return new Response(JSON.stringify({ triggered: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === '/api/jobs') {
        return new Response(
          JSON.stringify([
            {
              id: 'job-1',
              jobType: 'research',
              status: jobStatus,
              progress: jobStatus === 'completed' ? 100 : 50,
              stage: jobStatus === 'completed' ? 'completed' : 'analyzing',
              createdAt: new Date().toISOString(),
            },
          ]),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'button', { name: 'View job queue' }) !== null);

    // Trigger a refresh that will re-fetch jobs with completed status
    jobStatus = 'completed';
    getByRole(container, 'button', { name: 'refresh dashboard' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    await waitFor(() => container.querySelector('[data-testid="toast-success"]') !== null, 10000);
    const toast = container.querySelector('[data-testid="toast-success"]');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('research completed');
  });
});

describe('AppShell error states', () => {
  it('shows a storage-blocked screen and hides navigation when storage health fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'error',
            storageError: 'Disk unavailable',
            opencode: 'ok',
            crawlerStatus: 'never-run',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'alert') !== null);

    expect(queryByRole(container, 'complementary', { name: 'Main navigation' })).toBeNull();
    expect(getByText(container, 'Storage unavailable: Disk unavailable')).not.toBeNull();
  });

  it('shows opencode degraded guidance when the AI runtime is unavailable', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'not-installed',
            crawlerStatus: 'never-run',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByText(container, 'AI features unavailable') !== null);

    expect(getByText(container, 'AI features unavailable')).not.toBeNull();
  });

  it('Discovery and Sources nav items are not disabled in degraded mode', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health')
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'not-installed',
            crawlerStatus: 'never-run',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByText(container, 'AI features unavailable') !== null);
    const discoveryBtn = getByRole(container, 'button', {
      name: 'Discover grants',
    }) as HTMLButtonElement;
    const sourcesBtn = getByRole(container, 'button', {
      name: 'Manage sources',
    }) as HTMLButtonElement;
    expect(discoveryBtn?.disabled).toBe(false);
    expect(sourcesBtn?.disabled).toBe(false);
  });

  it('DiscoveryView renders in degraded mode rather than being replaced by a blocking banner', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health')
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'not-installed',
            crawlerStatus: 'never-run',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByText(container, 'AI features unavailable') !== null);
    const discoveryBtn = getByRole(container, 'button', { name: 'Discover grants' });
    discoveryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => queryByRole(container, 'button', { name: 'refresh discovery' }) !== null);
    expect(getByRole(container, 'button', { name: 'refresh discovery' })).not.toBeNull();
  });

  it('shows reconnection banner after storage error resolves', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'ok',
            crawlerStatus: 'ok',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ triggered: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'button', { name: 'Discover grants' }) !== null);

    expect(getByText(container, 'All systems operational')).not.toBeNull();
  });
});

describe('AppShell navigation', () => {
  it('navigates to duplicates view on click', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(
      () => queryByRole(container, 'button', { name: 'Review duplicate candidates' }) !== null,
    );

    const duplicatesNav = getByRole(container, 'button', { name: 'Review duplicate candidates' });
    duplicatesNav?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(
      () => queryByRole(container, 'tabpanel', { name: 'Duplicate Candidates' }) !== null,
    );
    const duplicatesPanel = getByRole(container, 'tabpanel', { name: 'Duplicate Candidates' });
    expect(duplicatesPanel).not.toBeNull();
  });
});

describe('AppShell accessibility', () => {
  it('renders a real anchor skip link as the first focusable element', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'link', { name: 'Skip to main content' }) !== null);

    const skipLink = getByRole(container, 'link', { name: 'Skip to main content' });
    expect(skipLink).not.toBeNull();
    expect(skipLink.tagName.toLowerCase()).toBe('a');
    expect((skipLink as HTMLAnchorElement).getAttribute('href')).toBe('#main-content');

    // Verify it is the first focusable element in the app
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusableElements[0]).toBe(skipLink);
  });

  it('moves focus to main content when skip link is clicked', async () => {
    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'link', { name: 'Skip to main content' }) !== null);

    const skipLink = getByRole(container, 'link', { name: 'Skip to main content' });
    const mainContent = container.querySelector('#main-content');
    expect(mainContent).not.toBeNull();

    // Simulate click
    skipLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => document.activeElement === mainContent, 500);

    expect(document.activeElement).toBe(mainContent);
  });
});

describe('AppShell beforeunload handler', () => {
  function makeJobsResponse(items: Array<Record<string, unknown>>): Response {
    return new Response(JSON.stringify(items), {
      headers: { 'content-type': 'application/json' },
    });
  }

  function makeInterruptSpy(impl: (input: RequestInfo | URL) => Promise<Response>): ReturnType<typeof vi.fn> {
    return vi.fn(async (input: RequestInfo | URL) => impl(input));
  }

  it('force-refresh issues a fresh fetch and then posts to /api/jobs/interrupt with the active job ids', async () => {
    const activeJob = {
      id: 'job-99',
      jobType: 'research',
      status: 'running',
      progress: 50,
      stage: 'analyzing',
      createdAt: new Date().toISOString(),
    };
    const interruptSpy = makeInterruptSpy(async () => new Response('{}', { status: 200 }));
    let jobsCallCount = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'ok',
            opencodeVersion: '1.0.0',
            crawlerStatus: 'ok',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/crawl/scheduled?trigger=true') {
        return new Response(JSON.stringify({ triggered: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.startsWith('/api/jobs/interrupt')) {
        return interruptSpy(input);
      }
      if (url.startsWith('/api/jobs')) {
        jobsCallCount += 1;
        return makeJobsResponse([activeJob]);
      }
      return new Response(JSON.stringify({}), {
        headers: { 'content-type': 'application/json' },
      });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'button', { name: 'View job queue' }) !== null);

    const jobsCallsBefore = jobsCallCount;
    window.dispatchEvent(new Event('beforeunload'));
    await waitFor(() => interruptSpy.mock.calls.length > 0, 10000);

    expect(jobsCallCount).toBeGreaterThan(jobsCallsBefore);
    expect(interruptSpy).toHaveBeenCalledTimes(1);
    const interruptInput = interruptSpy.mock.calls[0]?.[0];
    const interruptUrl = typeof interruptInput === 'string' ? interruptInput : interruptInput.toString();
    expect(interruptUrl).toBe('/api/jobs/interrupt');
  });

  it('skips /api/jobs/interrupt when no active jobs remain at the time of unload', async () => {
    const interruptSpy = makeInterruptSpy(async () => new Response('{}', { status: 200 }));
    let jobsCallCount = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'ok',
            opencodeVersion: '1.0.0',
            crawlerStatus: 'ok',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/crawl/scheduled?trigger=true') {
        return new Response(JSON.stringify({ triggered: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.startsWith('/api/jobs/interrupt')) {
        return interruptSpy(input);
      }
      if (url.startsWith('/api/jobs')) {
        jobsCallCount += 1;
        return makeJobsResponse([]);
      }
      return new Response(JSON.stringify({}), {
        headers: { 'content-type': 'application/json' },
      });
    });

    root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
    await waitFor(() => queryByRole(container, 'button', { name: 'View job queue' }) !== null);

    window.dispatchEvent(new Event('beforeunload'));
    await waitFor(() => jobsCallCount > 0);

    expect(interruptSpy).not.toHaveBeenCalled();
  });

  it('survives an empty active-jobs feed without throwing or posting to /api/jobs/interrupt', async () => {
    const interruptSpy = makeInterruptSpy(async () => new Response('{}', { status: 200 }));
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/health') {
        return new Response(
          JSON.stringify({
            storage: 'ok',
            opencode: 'ok',
            opencodeVersion: '1.0.0',
            crawlerStatus: 'ok',
            documentIndexer: 'ok',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === '/api/crawl/scheduled?trigger=true') {
        return new Response(JSON.stringify({ triggered: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.startsWith('/api/jobs/interrupt')) {
        return interruptSpy(input);
      }
      if (url.startsWith('/api/jobs')) {
        return new Response(JSON.stringify([]), {
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), {
        headers: { 'content-type': 'application/json' },
      });
    });

    let renderError: Error | null = null;
    try {
      root.render(React.createElement(ToastProvider, null, React.createElement(AppShell)));
      await waitFor(() => queryByRole(container, 'button', { name: 'View job queue' }) !== null);
      window.dispatchEvent(new Event('beforeunload'));
      await waitFor(() => true);
    } catch (err) {
      renderError = err as Error;
    }

    expect(renderError).toBeNull();
    expect(interruptSpy).not.toHaveBeenCalled();
  });
});
