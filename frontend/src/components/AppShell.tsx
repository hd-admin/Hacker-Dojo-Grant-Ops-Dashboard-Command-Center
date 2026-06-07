'use client';

import type { JSX } from 'react';
import type {
  CrawlStatus,
  Grant,
  HealthCheckResult,
  JobQueueItem,
  Notification,
  OrganizationProfile,
  Source,
  Task,
} from '../../../shared/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './ToastProvider';
import { client } from '../lib/grant-ops-client';
import { GrantDrawer } from './GrantDrawer';
import { OperatorNamePrompt } from './OperatorNamePrompt';
import { AppShellHealthBanner, type HealthTier } from './AppShellHealthBanner';
import { AppShellSidebar, type SidebarView } from './AppShellSidebar';
import { AppShellView, type AppShellActiveView } from './AppShellView';
import { AppShellSafeQuitDialog } from './AppShellSafeQuitDialog';

const WORKING_CONTEXT_KEY = 'grantops.workingContext';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

function readWorkingContext(): {
  activeView?: string;
  selectedGrantId?: string | null;
  recentGrantIds?: string[];
  recentDraftId?: string | null;
} {
  const storage = getWorkingContextStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || '{}') as {
      activeView?: string;
      selectedGrantId?: string | null;
      recentGrantIds?: string[];
      recentDraftId?: string | null;
    };
  } catch {
    return {};
  }
}

function getRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AppShell(): JSX.Element {
  const { addToast } = useToast();
  const [activeView, setActiveView] = useState<SidebarView>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [selectedGrantRefreshKey, setSelectedGrantRefreshKey] = useState(0);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({ online: true, lastSync: '' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentGrantIds, setRecentGrantIds] = useState<string[]>([]);
  const [recentDraftId, setRecentDraftId] = useState<string | null>(null);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [operatorName, setOperatorName] = useState<string>('');

  const [showSafeQuit, setShowSafeQuit] = useState(false);
  const [activeJobs, setActiveJobs] = useState<JobQueueItem[]>([]);
  const isSafeQuit = useRef(false);
  const previousJobStatuses = useRef<Record<string, JobQueueItem['status']>>({});

  const mainRef = useRef<HTMLElement>(null);

  const pendingSourcesCount = useMemo(
    () => sources.filter((source) => source.reviewStatus === 'pending-review').length,
    [sources],
  );
  const [pendingDuplicatesCount, setPendingDuplicatesCount] = useState(0);
  const [, setError] = useState<string | null>(null);

  const healthTier: HealthTier = useMemo(() => {
    if (!healthResult) return 'fully_online';
    if (healthResult.storage === 'error') return 'fully_offline';
    const opencodeDegraded =
      healthResult.opencode === 'not-installed' ||
      healthResult.opencode === 'not-reachable' ||
      healthResult.opencode === 'incompatible' ||
      healthResult.opencode === 'error';
    if (opencodeDegraded) return 'partially_degraded';
    return 'fully_online';
  }, [healthResult]);

  const isCrawlStale = useMemo(() => {
    if (!crawlStatus.lastSync) return false;
    const diffDays =
      (Date.now() - new Date(crawlStatus.lastSync).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }, [crawlStatus.lastSync]);

  const opencodeBlocked = useMemo(() => {
    if (healthResult === null) return false;
    return (
      healthResult.opencode === 'not-installed' ||
      healthResult.opencode === 'not-reachable' ||
      healthResult.opencode === 'incompatible' ||
      healthResult.opencode === 'error'
    );
  }, [healthResult]);

  const saveWorkingContext = useCallback(
    (next: {
      activeView?: SidebarView;
      selectedGrantId?: string | null;
      recentGrantIds?: string[];
      recentDraftId?: string | null;
    }) => {
      const storage = getWorkingContextStorage();
      if (!storage || typeof storage.setItem !== 'function') return;
      const current = readWorkingContext();
      const merged = {
        ...current,
        ...next,
      };
      try {
        storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(merged));
      } catch {
        // Ignore storage write failures in non-persistent test environments.
      }
    },
    [],
  );

  const refreshHealth = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/health');
      const data = (await response.json()) as HealthCheckResult;
      setHealthResult(data);
    } catch {
      setError('Error loading health');
      setHealthResult({
        storage: 'error',
        opencode: 'error',
        crawlerStatus: 'never-run',
        documentIndexer: 'error',
        storageError: 'Unable to load health',
      });
    }
  }, []);

  const loadActiveJobs = useCallback(async (): Promise<JobQueueItem[]> => {
    try {
      const response = await fetch('/api/jobs');
      const data = (await response.json()) as JobQueueItem[];
      const active = Array.isArray(data)
        ? data.filter(
            (job) =>
              job.status === 'queued' ||
              job.status === 'running' ||
              job.status === 'verifying' ||
              job.status === 'retrying',
          )
        : [];
      setActiveJobs(active);

      const prevStatuses = previousJobStatuses.current;
      for (const job of Array.isArray(data) ? data : []) {
        const prevStatus = prevStatuses[job.id];
        if (prevStatus && prevStatus !== 'completed' && job.status === 'completed') {
          addToast(`\u2705 ${job.jobType} completed`, 'success');
        }
        if (prevStatus && prevStatus !== 'failed' && job.status === 'failed') {
          addToast(`\u274C ${job.jobType} failed`, 'error');
        }
      }
      const nextStatuses: Record<string, JobQueueItem['status']> = {};
      for (const job of Array.isArray(data) ? data : []) {
        nextStatuses[job.id] = job.status;
      }
      previousJobStatuses.current = nextStatuses;
      return active;
    } catch {
      setActiveJobs([]);
      return [];
    }
  }, [addToast]);

  const refreshAppState = useCallback(async (): Promise<void> => {
    const [
      grantsData,
      profileData,
      notificationsData,
      tasksData,
      sourcesData,
      runsResponse,
      duplicatesData,
    ] = await Promise.all([
      client.grants.getAll(),
      client.profile.get().catch(() => null),
      client.notifications.getAll().catch(() => []),
      client.tasks.getAll().catch(() => []),
      client.sources.getAll().catch(() => []),
      client.research.getRuns().catch(() => ({ latestRun: null, allRuns: [] })),
      client.duplicates.getAll().catch(() => []),
    ]);

    setGrants(grantsData?.items ?? []);
    setProfile(profileData);
    setNotifications(notificationsData);
    setTasks(tasksData);
    setSources(sourcesData);
    setPendingDuplicatesCount(
      (Array.isArray(duplicatesData) ? duplicatesData : []).filter((d) => d.status === 'pending')
        .length,
    );

    const latestRun = runsResponse.latestRun;
    setCrawlStatus({
      online: latestRun ? latestRun.status !== 'failed' : true,
      lastSync: latestRun?.completedAt || latestRun?.startedAt || '',
    });

    await loadActiveJobs();
  }, [loadActiveJobs]);

  const refreshSelectedGrant = useCallback(async (): Promise<void> => {
    if (!selectedGrantId) {
      return;
    }
    setSelectedGrantRefreshKey((value) => value + 1);
    await refreshAppState();
  }, [refreshAppState, selectedGrantId]);

  useEffect(() => {
    setIsMounted(true);
    const context = readWorkingContext();
    if (context.activeView) setActiveView(context.activeView as SidebarView);
    if (context.selectedGrantId !== undefined) setSelectedGrantId(context.selectedGrantId);
    if (Array.isArray(context.recentGrantIds))
      setRecentGrantIds(context.recentGrantIds.slice(0, 5));
    if (context.recentDraftId !== undefined) setRecentDraftId(context.recentDraftId);

    void Promise.all([refreshAppState(), refreshHealth(), loadActiveJobs()]).catch(() => {
      setError('Error loading app state');
    });
  }, [refreshAppState, refreshHealth, loadActiveJobs]);

  useEffect(() => {
    const triggerScheduledCrawls = async (): Promise<void> => {
      try {
        await fetch('/api/crawl/scheduled?trigger=true');
      } catch {
        setError('Error checking scheduled crawls');
      }
    };

    void triggerScheduledCrawls();
    const scheduler = window.setInterval(() => {
      void triggerScheduledCrawls();
    }, 60_000);

    return () => {
      window.clearInterval(scheduler);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refreshHealth]);

  useEffect(() => {
    if (!isMounted) return;
    saveWorkingContext({ activeView });
  }, [activeView, isMounted, saveWorkingContext]);

  useEffect(() => {
    if (!isMounted) return;
    saveWorkingContext({ selectedGrantId });
    if (selectedGrantId) {
      setRecentGrantIds((current) => {
        const next = [selectedGrantId, ...current.filter((id) => id !== selectedGrantId)].slice(
          0,
          5,
        );
        saveWorkingContext({ recentGrantIds: next });
        return next;
      });
    }
  }, [selectedGrantId, isMounted, saveWorkingContext]);

  useEffect(() => {
    if (!isMounted) return;
    saveWorkingContext({ recentGrantIds });
  }, [recentGrantIds, isMounted, saveWorkingContext]);

  useEffect(() => {
    if (!isMounted || recentDraftId === null) return;
    saveWorkingContext({ recentDraftId });
  }, [recentDraftId, isMounted, saveWorkingContext]);

  useEffect(() => {
    const handler = async (e: BeforeUnloadEvent) => {
      const freshlyLoadedJobs = await loadActiveJobs();
      if (freshlyLoadedJobs.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        try {
          await fetch('/api/jobs/interrupt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobIds: freshlyLoadedJobs.map((j) => j.id) }),
          });
        } catch {
          // Best effort
        }
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loadActiveJobs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedGrantId) {
          setSelectedGrantId(null);
        }
        if (showSafeQuit) {
          setShowSafeQuit(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGrantId, showSafeQuit]);

  const handleNavigate = (view: SidebarView): void => {
    setActiveView(view);
  };

  const handleGrantSelect = (grantId: string): void => {
    setSelectedGrantId(grantId);
  };

  const handleDrawerClose = (): void => {
    setSelectedGrantId(null);
  };

  const handleSkipToContent = (e: React.MouseEvent | React.KeyboardEvent): void => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    mainRef.current?.focus();
    if (typeof mainRef.current?.scrollIntoView === 'function') {
      mainRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOperatorComplete = useCallback((name: string): void => {
    setOperatorName(name);
  }, []);

  const handleSafeQuitConfirm = useCallback(async (): Promise<void> => {
    isSafeQuit.current = true;
    if (activeJobs.length > 0) {
      try {
        await fetch('/api/jobs/interrupt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jobIds: activeJobs.map((j) => j.id) }),
        });
      } catch {
        // Best effort
      }
    }
    window.close();
  }, [activeJobs]);

  const hasStorageError = healthResult?.storage === 'error';

  if (!isMounted) {
    return (
      <div
        className="app-loading"
        aria-busy="true"
        role="status"
        aria-label="Loading application"
      />
    );
  }

  if (hasStorageError) {
    return (
      <div className="app app-blocked" role="alert">
        <div className="storage-blocked-panel">
          <div data-testid="storage-blocked-banner">
            Storage unavailable: {healthResult.storageError ?? 'Unknown error'}
          </div>
          <button
            type="button"
            data-testid="rerun-health-check-btn"
            onClick={() => {
              void refreshHealth();
            }}
          >
            Re-run Health Check
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-testid="app-shell">
      <a
        href="#main-content"
        className="skip-to-content"
        data-testid="skip-link"
        onClick={handleSkipToContent}
        onKeyDown={handleSkipToContent}
      >
        Skip to main content
      </a>

      <AppShellSidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        grants={grants}
        sourcesCount={pendingSourcesCount}
        notifications={notifications}
        activeJobs={activeJobs}
        pendingDuplicatesCount={pendingDuplicatesCount}
        operatorName={operatorName}
        profile={profile}
        crawlStatus={crawlStatus}
        isCrawlStale={isCrawlStale}
        getRelativeTime={getRelativeTime}
      />

      <main
        className="main"
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
      >
        <AppShellHealthBanner
          healthTier={healthTier}
          healthResult={healthResult}
          isCrawlStale={isCrawlStale}
          crawlStatus={crawlStatus}
          opencodeBlocked={opencodeBlocked}
          hasStorageError={hasStorageError}
          onRefreshHealth={() => {
            void refreshHealth();
          }}
          getRelativeTime={getRelativeTime}
        />

        <AppShellView
          activeView={activeView as AppShellActiveView}
          grants={grants}
          profile={profile}
          notifications={notifications}
          sources={sources}
          tasks={tasks}
          recentGrantIds={recentGrantIds}
          operatorName={operatorName}
          onGrantSelect={handleGrantSelect}
          onNavigate={handleNavigate}
          refreshAppState={refreshAppState}
        />
      </main>

      <AppShellSafeQuitDialog
        open={showSafeQuit}
        activeJobs={activeJobs}
        onCancel={() => setShowSafeQuit(false)}
        onConfirm={() => {
          void handleSafeQuitConfirm();
        }}
      />

      <OperatorNamePrompt onComplete={handleOperatorComplete} />

      <GrantDrawer
        key={`${selectedGrantId ?? 'none'}-${selectedGrantRefreshKey}`}
        grantId={selectedGrantId}
        onClose={handleDrawerClose}
        onRefreshAppState={refreshSelectedGrant}
      />
    </div>
  );
}
