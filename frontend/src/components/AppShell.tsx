'use client';

import type { JSX } from 'react';
import type { JobQueueItem } from '../../../shared/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { readWorkingContext, saveWorkingContext } from '../lib/working-context';
import { useAppShellState } from '../hooks/useAppShellState';
import { GrantDrawer } from './GrantDrawer';
import { OperatorNamePrompt } from './OperatorNamePrompt';
import { AppShellHealthBanner } from './AppShellHealthBanner';
import { AppShellSidebar, type SidebarView } from './AppShellSidebar';
import { AppShellView, type AppShellActiveView } from './AppShellView';
import { AppShellSafeQuitDialog } from './AppShellSafeQuitDialog';

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
  const shell = useAppShellState();
  const {
    grants,
    sources,
    profile,
    crawlStatus,
    notifications,
    tasks,
    recentGrantIds,
    healthResult,
    activeJobs,
    healthTier,
    isCrawlStale,
    opencodeBlocked,
    pendingSourcesCount,
    pendingDuplicatesCount,
    setRecentGrantIds,
    refreshHealth,
    refreshAppState,
    loadActiveJobs,
  } = shell;

  const [activeView, setActiveView] = useState<SidebarView>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [selectedGrantRefreshKey, setSelectedGrantRefreshKey] = useState(0);
  const [recentDraftId, setRecentDraftId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [operatorName, setOperatorName] = useState<string>('');
  const [showSafeQuit, setShowSafeQuit] = useState(false);
  const isSafeQuit = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const context = readWorkingContext();
    if (context.activeView) setActiveView(context.activeView as SidebarView);
    if (context.selectedGrantId !== undefined) setSelectedGrantId(context.selectedGrantId);
    if (Array.isArray(context.recentGrantIds))
      setRecentGrantIds(() => context.recentGrantIds?.slice(0, 5) ?? []);
    if (context.recentDraftId !== undefined) setRecentDraftId(context.recentDraftId);

    void Promise.all([refreshAppState(), refreshHealth(), loadActiveJobs()]).catch(() => {
      // Loading errors are reflected in the storage-blocked screen and
      // health banner; keep the mount resilient.
    });
  }, [refreshAppState, refreshHealth, loadActiveJobs, setRecentGrantIds]);

  useEffect(() => {
    const triggerScheduledCrawls = async (): Promise<void> => {
      try {
        await fetch('/api/crawl/scheduled?trigger=true');
      } catch {
        // Best effort: scheduler failures shouldn't tear down the app.
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
  }, [activeView, isMounted]);

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
  }, [selectedGrantId, isMounted, setRecentGrantIds]);

  useEffect(() => {
    if (!isMounted) return;
    saveWorkingContext({ recentGrantIds });
  }, [recentGrantIds, isMounted]);

  useEffect(() => {
    if (!isMounted || recentDraftId === null) return;
    saveWorkingContext({ recentDraftId });
  }, [recentDraftId, isMounted]);

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

  const refreshSelectedGrant = useCallback(async (): Promise<void> => {
    if (!selectedGrantId) {
      return;
    }
    setSelectedGrantRefreshKey((value) => value + 1);
    await refreshAppState();
  }, [refreshAppState, selectedGrantId]);

  const handleSafeQuitConfirm = useCallback(async (): Promise<void> => {
    isSafeQuit.current = true;
    if (activeJobs.length > 0) {
      try {
        await fetch('/api/jobs/interrupt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jobIds: activeJobs.map((j: JobQueueItem) => j.id) }),
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
