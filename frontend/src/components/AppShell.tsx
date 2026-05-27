"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CrawlStatus,
  Grant,
  HealthCheckResult,
  Notification,
  OrganizationProfile,
  Source,
  Task,
} from "../../../shared/types";
import { client } from "../lib/grant-ops-client";
import DashboardView from "./DashboardView";
import DiscoveryView from "./DiscoveryView";
import GrantDrawer from "./GrantDrawer";
import NotificationsView from "./NotificationsView";
import PipelineView from "./PipelineView";
import SettingsView from "./SettingsView";
import SourcesView from "./SourcesView";
import TasksView from "./TasksView";
import AuditView from "./AuditView";

type ViewType =
  | "dashboard"
  | "discovery"
  | "pipeline"
  | "sources"
  | "settings"
  | "notifications"
  | "tasks"
  | "audit";

interface NavItem {
  view?: ViewType;
  label: string;
  icon?: string;
}

const workspaceNav: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '◐' },
  { view: 'discovery', label: 'Discovery', icon: '◇' },
  { view: 'pipeline', label: 'Pipeline', icon: '▤' },
  { view: 'sources', label: 'Sources', icon: '◈' },
  { view: 'settings', label: 'Org Profile', icon: '◯' },
];

const activityNav: NavItem[] = [
  { view: 'notifications', label: 'Notifications', icon: '✉' },
  { view: 'tasks', label: 'Tasks', icon: '⌶' },
  { view: 'audit', label: 'Audit', icon: '✎' },
];

const WORKING_CONTEXT_KEY = 'grantops.workingContext';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
}

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [selectedGrantRefreshKey, setSelectedGrantRefreshKey] = useState(0);
  const [appVersion] = useState('0.1.0');
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

  const unreadTaskCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);
  const pendingSourcesCount = useMemo(
    () => sources.filter((source) => source.reviewStatus === 'pending-review').length,
    [sources],
  );

  const saveWorkingContext = useCallback((next: {
    activeView?: ViewType;
    selectedGrantId?: string | null;
    recentGrantIds?: string[];
    recentDraftId?: string | null;
  }) => {
    const storage = getWorkingContextStorage();
    if (!storage) return;
    const current = readWorkingContext();
    const merged = {
      ...current,
      ...next,
    };
    storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(merged));
  }, []);

  const refreshHealth = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/health');
      const data = (await response.json()) as HealthCheckResult;
      setHealthResult(data);
    } catch (error) {
      console.error('Error loading health:', error);
      setHealthResult({ storage: 'error', opencode: 'error', crawlerStatus: 'never-run', documentIndexer: 'error', storageError: 'Unable to load health' });
    }
  }, []);

  const refreshAppState = useCallback(async (): Promise<void> => {
    const [grantsData, profileData, notificationsData, tasksData, sourcesData, runsResponse] = await Promise.all([
      client.grants.getAll(),
      client.profile.get().catch(() => null),
      client.notifications.getAll().catch(() => []),
      client.tasks.getAll().catch(() => []),
      client.sources.getAll().catch(() => []),
      client.research.getRuns().catch(() => ({ latestRun: null, allRuns: [] })),
    ]);

    setGrants(grantsData);
    setProfile(profileData);
    setNotifications(notificationsData);
    setTasks(tasksData);
    setSources(sourcesData);

    const latestRun = runsResponse.latestRun;
    setCrawlStatus({
      online: latestRun ? latestRun.status !== 'failed' : true,
      lastSync: latestRun?.completedAt || latestRun?.startedAt || '',
    });
  }, []);

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
    if (context.activeView) setActiveView(context.activeView as ViewType);
    if (context.selectedGrantId !== undefined) setSelectedGrantId(context.selectedGrantId);
    if (Array.isArray(context.recentGrantIds)) setRecentGrantIds(context.recentGrantIds.slice(0, 5));
    if (context.recentDraftId !== undefined) setRecentDraftId(context.recentDraftId);
    void Promise.all([refreshAppState(), refreshHealth()]).catch((error) => {
      console.error('Error loading app state:', error);
    });
  }, [refreshAppState, refreshHealth]);

  useEffect(() => {
    const triggerScheduledCrawls = async (): Promise<void> => {
      try {
        await fetch('/api/crawl/scheduled?trigger=true');
      } catch (error) {
        console.error('Error checking scheduled crawls:', error);
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
    if (!isMounted) return;
    saveWorkingContext({ activeView });
  }, [activeView, isMounted, saveWorkingContext]);

  useEffect(() => {
    if (!isMounted) return;
    saveWorkingContext({ selectedGrantId });
    if (selectedGrantId) {
      setRecentGrantIds((current) => {
        const next = [selectedGrantId, ...current.filter((id) => id !== selectedGrantId)].slice(0, 5);
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

  const handleNavClick = (item: NavItem) => {
    if (item.view) {
      setActiveView(item.view);
    }
  };

  const handleNavigate = (view: ViewType) => {
    setActiveView(view);
  };

  const handleGrantSelect = (grantId: string) => {
    setSelectedGrantId(grantId);
  };

  const handleDrawerClose = () => {
    setSelectedGrantId(null);
  };

  const isFirstRun = grants.length === 0 && sources.length === 0 && tasks.length === 0 && notifications.length === 0;
  const hasStorageError = healthResult?.storage === 'error';
  const opencodeBlocked =
    healthResult !== null &&
    (healthResult.opencode === 'not-installed' ||
      healthResult.opencode === 'not-reachable' ||
      healthResult.opencode === 'incompatible' ||
      healthResult.opencode === 'error');

  if (!isMounted) {
    return <div className="app-loading" aria-busy="true" />;
  }

  if (hasStorageError) {
    return (
      <div className="app app-blocked">
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
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            Hacker Dojo <em>Grant Ops</em>
          </div>
          <div className="brand-sub">v{appVersion}</div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Workspace</div>
          {workspaceNav.map((item) => {
            const matchedCount =
              item.view === 'discovery'
                ? grants.filter((g) => g.status === 'matched').length
                : item.view === 'pipeline'
                  ? grants.filter((g) => g.status !== 'awarded').length
                  : item.view === 'sources'
                    ? pendingSourcesCount
                    : 0;
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                data-view={item.view}
                disabled={(item.view === 'discovery' || item.view === 'sources') && (healthResult === null || opencodeBlocked)}
                onClick={() => handleNavClick(item)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {matchedCount > 0 && item.view && <span className="nav-count">{matchedCount}</span>}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-label">Activity</div>
          {activityNav.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${activeView === item.view ? 'active' : ''}`}
              data-view={item.view}
              onClick={() => handleNavClick(item)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.view === 'notifications' && notifications.length > 0 && (
                <span className="nav-count">{notifications.length}</span>
              )}
              {item.view === 'tasks' && unreadTaskCount > 0 && (
                <span className="nav-count">{unreadTaskCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className={`status-dot ${crawlStatus.online ? '' : 'offline'}`} />
          Crawler {crawlStatus.online ? 'online' : 'offline'}
          <br />
          Last sync: {crawlStatus.lastSync ? getRelativeTime(crawlStatus.lastSync) : '—'}
          <br />
          <br />
          Logged in as
          <br />
          <strong style={{ color: 'var(--text-dim)' }}>
            {profile?.agentBehavior.notifyEmail || 'ed@hackerdojo.com'}
          </strong>
        </div>
      </aside>

      <main className="main">
        <div className="shell-banner-row">
          {hasStorageError && (
            <div data-testid="storage-blocked-banner">Storage unavailable: {healthResult?.storageError ?? 'Unknown error'}</div>
          )}
          {(healthResult?.opencode === 'not-installed' || healthResult?.opencode === 'not-reachable') && (
            <div data-testid="opencode-degraded-banner">AI features unavailable until opencode is configured.</div>
          )}
          {isFirstRun && (
            <div data-testid="first-run-guidance-card">
              Welcome to Hacker Dojo Grant Ops
              <button type="button" data-testid="first-run-add-source-btn" onClick={() => handleNavigate('sources')}>Add Your First Source</button>
            </div>
          )}
          <button type="button" data-testid="rerun-health-check-btn" onClick={() => { void refreshHealth(); }}>Re-run Health Check</button>
        </div>

        <div id="view-dashboard" className={`view ${activeView === 'dashboard' ? 'active' : ''}`}>
          <DashboardView
            onGrantSelect={handleGrantSelect}
            onNavigate={handleNavigate}
            onRefreshAppState={refreshAppState}
            grants={grants}
            profile={profile}
            notifications={notifications}
            recentGrantIds={recentGrantIds}
          />
        </div>
        <div id="view-discovery" className={`view ${activeView === 'discovery' ? 'active' : ''}`}>
          {healthResult === null || opencodeBlocked ? (
            <div data-testid="opencode-degraded-banner">AI features unavailable until opencode is configured.</div>
          ) : (
            <DiscoveryView onGrantSelect={handleGrantSelect} onRefreshAppState={refreshAppState} />
          )}
        </div>
        <div id="view-pipeline" className={`view ${activeView === 'pipeline' ? 'active' : ''}`}>
          <PipelineView onGrantSelect={handleGrantSelect} onNavigate={handleNavigate} />
        </div>
        <div id="view-sources" className={`view ${activeView === 'sources' ? 'active' : ''}`}>
          {healthResult === null || opencodeBlocked ? (
            <div data-testid="opencode-degraded-banner">AI features unavailable until opencode is configured.</div>
          ) : (
            <SourcesView onRefreshAppState={refreshAppState} />
          )}
        </div>
        <div id="view-settings" className={`view ${activeView === 'settings' ? 'active' : ''}`}>
          <SettingsView onRefreshAppState={refreshAppState} />
        </div>
        <div id="view-notifications" className={`view ${activeView === 'notifications' ? 'active' : ''}`}>
          <NotificationsView notifications={notifications} />
        </div>
        <div id="view-tasks" className={`view ${activeView === 'tasks' ? 'active' : ''}`}>
          <TasksView onRefreshAppState={refreshAppState} tasks={tasks} />
        </div>
        <div id="view-audit" className={`view ${activeView === 'audit' ? 'active' : ''}`}>
          <AuditView />
        </div>
      </main>

      <GrantDrawer
        key={`${selectedGrantId ?? 'none'}-${selectedGrantRefreshKey}`}
        grantId={selectedGrantId}
        onClose={handleDrawerClose}
        onRefreshAppState={refreshSelectedGrant}
      />
    </div>
  );
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
