"use client";

import type {
  CrawlStatus,
  Grant,
  HealthCheckResult,
  JobQueueItem,
  Notification,
  OrganizationProfile,
  Source,
  Task,
} from "../../../shared/types";
import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Columns3,
  Database,
  FileText,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
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
import JobsPanel from "./JobsPanel";

type ViewType =
  | "dashboard"
  | "discovery"
  | "pipeline"
  | "sources"
  | "settings"
  | "notifications"
  | "tasks"
  | "jobs"
  | "audit";

type HealthTier = "fully_online" | "partially_degraded" | "fully_offline";

interface NavItem {
  view?: ViewType;
  label: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

interface SetupData {
  orgName: string;
  ein: string;
  mission: string;
  opencodePath: string;
}

const workspaceNav: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, ariaLabel: 'View dashboard' },
  { view: 'discovery', label: 'Discovery', icon: <Search size={20} />, ariaLabel: 'Discover grants' },
  { view: 'pipeline', label: 'Pipeline', icon: <Columns3 size={20} />, ariaLabel: 'View grant pipeline' },
  { view: 'sources', label: 'Sources', icon: <Database size={20} />, ariaLabel: 'Manage sources' },
  { view: 'settings', label: 'Org Profile', icon: <UserCircle size={20} />, ariaLabel: 'Organization profile settings' },
];

const activityNav: NavItem[] = [
  { view: 'notifications', label: 'Notifications', icon: <Bell size={20} />, ariaLabel: 'View notifications' },
  { view: 'tasks', label: 'Tasks', icon: <ListChecks size={20} />, ariaLabel: 'View tasks' },
  { view: 'jobs', label: 'Jobs', icon: <Settings size={20} />, ariaLabel: 'View job queue' },
  { view: 'audit', label: 'Audit', icon: <FileText size={20} />, ariaLabel: 'View audit trail' },
];

const WORKING_CONTEXT_KEY = 'grantops.workingContext';
const SETUP_COMPLETED_KEY = 'grantops.setupCompleted';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
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

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({ orgName: '', ein: '', mission: '', opencodePath: '' });

  // Safe quit state
  const [showSafeQuit, setShowSafeQuit] = useState(false);
  const [activeJobs, setActiveJobs] = useState<JobQueueItem[]>([]);
  const isSafeQuit = useRef(false);

  // Keyboard navigation
  const mainRef = useRef<HTMLElement>(null);

  const unreadTaskCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);
  const pendingSourcesCount = useMemo(
    () => sources.filter((source) => source.reviewStatus === 'pending-review').length,
    [sources],
  );

  // Health tier computation
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

  // Crawl staleness (>7 days)
  const isCrawlStale = useMemo(() => {
    if (!crawlStatus.lastSync) return false;
    const diffDays = (Date.now() - new Date(crawlStatus.lastSync).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }, [crawlStatus.lastSync]);

  const saveWorkingContext = useCallback((next: {
    activeView?: ViewType;
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

  const loadActiveJobs = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/jobs');
      const data = (await response.json()) as JobQueueItem[];
      const active = Array.isArray(data)
        ? data.filter((job) => job.status === 'queued' || job.status === 'running')
        : [];
      setActiveJobs(active);
    } catch {
      setActiveJobs([]);
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

    // Check if profile has been saved (guided setup trigger)
    const storage = getWorkingContextStorage();
    const hasCompletedSetup = storage?.getItem(SETUP_COMPLETED_KEY) === 'true';
    if (!hasCompletedSetup) {
      setShowSetupWizard(true);
    }

    void Promise.all([refreshAppState(), refreshHealth(), loadActiveJobs()]).catch((error) => {
      console.error('Error loading app state:', error);
    });
  }, [refreshAppState, refreshHealth, loadActiveJobs]);

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

  // Periodic health refresh for reconnection detection
  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refreshHealth]);

  // Working context save effects
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

  // Safe quit: beforeunload handler
  useEffect(() => {
    const handler = async (e: BeforeUnloadEvent) => {
      await loadActiveJobs();
      // Check if there are active jobs after load
      const currentActiveJobs = activeJobs.filter(
        (job) => job.status === 'queued' || job.status === 'running',
      );
      if (currentActiveJobs.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        // Mark interrupted jobs as incomplete
        try {
          await fetch('/api/jobs/interrupt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobIds: currentActiveJobs.map((j) => j.id) }),
          });
        } catch {
          // Best effort
        }
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeJobs, loadActiveJobs]);

  // Keyboard navigation: Escape to close drawer
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

  // ============ Handlers ============

  const handleNavClick = (item: NavItem) => {
    if (item.view) {
      setActiveView(item.view);
    }
  };

  const handleNavKeyDown = (e: React.KeyboardEvent, item: NavItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (item.view) {
        setActiveView(item.view);
      }
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

  const handleSkipToContent = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============ Setup Wizard ============

  const handleSetupNext = () => {
    if (setupStep === 0 && (!setupData.orgName.trim() || !setupData.ein.trim() || !setupData.mission.trim())) {
      return;
    }
    if (setupStep === 1 && !setupData.opencodePath.trim()) {
      return;
    }
    if (setupStep < 2) {
      setSetupStep((s) => s + 1);
    }
  };

  const handleSetupPrevious = () => {
    if (setupStep > 0) {
      setSetupStep((s) => s - 1);
    }
  };

  const handleSetupComplete = async () => {
    try {
      if (setupData.orgName.trim() && setupData.ein.trim() && setupData.mission.trim()) {
        await client.profile.update({
          legalName: setupData.orgName.trim(),
          ein: setupData.ein.trim(),
          samUEI: profile?.samUEI ?? '',
          nonprofitStatus: profile?.nonprofitStatus ?? '501(c)(3)',
          contactInfo: profile?.contactInfo ?? {},
          geography: profile?.geography ?? '',
          mission: setupData.mission.trim(),
          programAreas: profile?.programAreas ?? [],
          populationsServed: profile?.populationsServed ?? [],
          fundingHistory: profile?.fundingHistory ?? [],
          partnerships: profile?.partnerships ?? [],
          complianceFacts: profile?.complianceFacts ?? [],
          docTypes: profile?.docTypes ?? ['PDF'],
          searchThemes: profile?.searchThemes ?? [],
          agentBehavior: profile?.agentBehavior ?? {
            autoDraftThreshold: 75,
            submissionPolicy: 'Human approval required',
            notifyEmail: 'ed@hackerdojo.com',
            voiceAndTone: 'Plain-spoken',
          },
        });
      }
      if (setupData.opencodePath.trim()) {
        await client.opencodeSettings.update({
          binaryPath: setupData.opencodePath.trim(),
          workingDirectory: setupData.opencodePath.trim().replace(/\/opencode$/i, ''),
          timeoutMs: 60000,
          isConfigured: true,
        });
      }
      const storage = getWorkingContextStorage();
      if (storage) {
        storage.setItem(SETUP_COMPLETED_KEY, 'true');
      }
      setShowSetupWizard(false);
      await refreshAppState();
      await refreshHealth();
    } catch (error) {
      console.error('Error completing setup:', error);
    }
  };

  const handleSetupSkip = () => {
    const storage = getWorkingContextStorage();
    if (storage) {
      storage.setItem(SETUP_COMPLETED_KEY, 'true');
    }
    setShowSetupWizard(false);
  };

  // ============ Compute derived state ============

  const isFirstRun = grants.length === 0 && sources.length === 0 && tasks.length === 0 && notifications.length === 0;
  const hasStorageError = healthResult?.storage === 'error';
  const opencodeBlocked =
    healthResult !== null &&
    (healthResult.opencode === 'not-installed' ||
      healthResult.opencode === 'not-reachable' ||
      healthResult.opencode === 'incompatible' ||
      healthResult.opencode === 'error');

  // ============ Render ============

  if (!isMounted) {
    return <div className="app-loading" aria-busy="true" role="status" aria-label="Loading application" />;
  }

  // Storage blocked: critical failure screen
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
    <div className="app">
      {/* Skip-to-content link for keyboard users */}
      <button
        type="button"
        className="skip-to-content"
        onClick={handleSkipToContent}
        onKeyDown={handleSkipToContent}
      >
        Skip to main content
      </button>

      {/* Sidebar */}
      {/* biome-ignore lint/a11y/useSemanticElements: <explanation>sidebar layout uses aside for complementary content */}
      <aside className="sidebar" aria-label="Main navigation">
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
                aria-label={item.ariaLabel}
                aria-current={activeView === item.view ? 'page' : undefined}
                tabIndex={0}
                disabled={false}
                onClick={() => handleNavClick(item)}
                onKeyDown={(e) => handleNavKeyDown(e, item)}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
              aria-label={item.ariaLabel}
              aria-current={activeView === item.view ? 'page' : undefined}
              tabIndex={0}
              onClick={() => handleNavClick(item)}
              onKeyDown={(e) => handleNavKeyDown(e, item)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
          <span
            className={`status-dot ${crawlStatus.online ? '' : 'offline'}`}
            aria-hidden="true"
          />
          Crawler {crawlStatus.online ? 'online' : 'offline'}
          {isCrawlStale && <span className="staleness-badge">Stale</span>}
          <br />
          Last sync: {crawlStatus.lastSync ? getRelativeTime(crawlStatus.lastSync) : '\u2014'}
          <br />
          <br />
          Logged in as
          <br />
          <strong style={{ color: 'var(--text-dim)' }}>
            {profile?.agentBehavior.notifyEmail || 'ed@hackerdojo.com'}
          </strong>
        </div>
      </aside>

      {/* Main content with skip target */}
      <main className="main" ref={mainRef} id="main-content" tabIndex={-1} aria-label="Main content">
        {/* Health Banner */}
        {healthTier !== 'fully_online' && (
          <div
            className={`health-banner ${healthTier === 'partially_degraded' ? 'degraded' : 'offline'}`}
            role="alert"
            aria-live="polite"
            data-testid="health-banner"
          >
            <span className="health-banner-icon" aria-hidden="true">
              {healthTier === 'partially_degraded' ? <AlertTriangle size={16} /> : <X size={16} />}
            </span>
            <span className="health-banner-text">
              {healthTier === 'partially_degraded'
                ? 'AI features are currently unavailable. Local operations are unaffected.'
                : 'Storage is unavailable. Some features may be limited.'}
            </span>
            <button
              type="button"
              className="health-banner-action"
              onClick={() => { void refreshHealth(); }}
              aria-label="Re-check system health"
            >
              Re-check
            </button>
          </div>
        )}

        {/* Reconnection notification */}
        {healthTier === 'fully_online' && healthResult && opencodeBlocked === false && healthResult.opencode === 'ok' && (
          <div
            className="health-banner online"
            role="status"
            aria-live="polite"
            data-testid="health-banner-online"
          >
            <span className="health-banner-icon" aria-hidden="true"><Check size={16} /></span>
            <span className="health-banner-text">
              All systems operational
              {crawlStatus.lastSync && (
                <>
                  {' · '}
                  <span data-testid="health-banner-crawl-sync">
                    Last crawl: {getRelativeTime(crawlStatus.lastSync)}
                    {isCrawlStale && (
                      <span className="health-banner-stale-badge" data-testid="health-banner-stale">
                        {' '}Stale
                      </span>
                    )}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Existing banner row (kept for backward compatibility) */}
        <div className="shell-banner-row">
          {hasStorageError && (
            <div data-testid="storage-blocked-banner">Storage unavailable: {healthResult?.storageError ?? 'Unknown error'}</div>
          )}
          {(healthResult?.opencode === 'not-installed' || healthResult?.opencode === 'not-reachable') && (
            <div data-testid="opencode-degraded-banner">AI features unavailable until opencode is configured.</div>
          )}
          {isFirstRun && !showSetupWizard && (
            <div data-testid="first-run-guidance-card">
              Welcome to Hacker Dojo Grant Ops
              <button type="button" data-testid="first-run-add-source-btn" onClick={() => handleNavigate('sources')}>Add Your First Source</button>
            </div>
          )}
          <button type="button" data-testid="rerun-health-check-btn" onClick={() => { void refreshHealth(); }}>Re-run Health Check</button>
        </div>

        {/* Views */}
        <div id="view-dashboard" className={`view ${activeView === 'dashboard' ? 'active' : ''}`} role="tabpanel" aria-label="Dashboard">
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
        <div id="view-discovery" className={`view ${activeView === 'discovery' ? 'active' : ''}`} role="tabpanel" aria-label="Discovery">
          <DiscoveryView onGrantSelect={handleGrantSelect} onRefreshAppState={refreshAppState} />
        </div>
        <div id="view-pipeline" className={`view ${activeView === 'pipeline' ? 'active' : ''}`} role="tabpanel" aria-label="Pipeline">
          <PipelineView onGrantSelect={handleGrantSelect} onNavigate={handleNavigate} />
        </div>
        <div id="view-sources" className={`view ${activeView === 'sources' ? 'active' : ''}`} role="tabpanel" aria-label="Sources">
          <SourcesView onRefreshAppState={refreshAppState} />
        </div>
        <div id="view-settings" className={`view ${activeView === 'settings' ? 'active' : ''}`} role="tabpanel" aria-label="Organization Profile Settings">
          <SettingsView onRefreshAppState={refreshAppState} />
        </div>
        <div id="view-notifications" className={`view ${activeView === 'notifications' ? 'active' : ''}`} role="tabpanel" aria-label="Notifications">
          <NotificationsView notifications={notifications} />
        </div>
        <div id="view-tasks" className={`view ${activeView === 'tasks' ? 'active' : ''}`} role="tabpanel" aria-label="Tasks">
          <TasksView onRefreshAppState={refreshAppState} tasks={tasks} onNavigate={handleNavigate} />
        </div>
        <div id="view-jobs" className={`view ${activeView === 'jobs' ? 'active' : ''}`} role="tabpanel" aria-label="Job Queue">
          <JobsPanel onRefreshAppState={refreshAppState} />
        </div>
        <div id="view-audit" className={`view ${activeView === 'audit' ? 'active' : ''}`} role="tabpanel" aria-label="Audit Trail">
          <AuditView />
        </div>
      </main>

      {/* Safe Quit Dialog */}
      {showSafeQuit && (
        <div className="safe-quit-overlay" role="dialog" aria-modal="true" aria-label="Safe quit confirmation">
          <div className="safe-quit-dialog">
            <h3>Safe Quit</h3>
            <p>
              {activeJobs.length > 0
                ? `The following jobs are still running. Quitting will mark them as incomplete.`
                : 'No active jobs detected. You can safely close the application.'}
            </p>
            {activeJobs.length > 0 && (
              <div className="active-jobs-list">
                {activeJobs.map((job) => (
                  <div key={job.id} className="active-job-item">
                    <span>{job.jobType} #{job.id.slice(0, 8)}</span>
                    <span>{job.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="quit-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowSafeQuit(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  isSafeQuit.current = true;
                  void (async () => {
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
                  })();
                }}
              >
                Quit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Setup Wizard */}
      {showSetupWizard && (
        <div className="setup-wizard-overlay" role="dialog" aria-modal="true" aria-label="First-run setup wizard">
          <div className="setup-wizard" data-testid="setup-wizard">
            <h2>Welcome to Grant Ops</h2>
            <div className="setup-subtitle">Let&apos;s get you set up in 3 steps</div>

            {/* Progress indicator */}
            <div className="setup-progress" role="progressbar" aria-valuenow={setupStep + 1} aria-valuemin={1} aria-valuemax={3} aria-label={`Step ${setupStep + 1} of 3`}>
              <div className={`setup-progress-dot ${setupStep >= 0 ? 'active' : ''} ${setupStep > 0 ? 'done' : ''}`} />
              <div className={`setup-progress-dot ${setupStep >= 1 ? 'active' : ''} ${setupStep > 1 ? 'done' : ''}`} />
              <div className={`setup-progress-dot ${setupStep >= 2 ? 'active' : ''}`} />
            </div>

            {/* Step 0: Organization Profile */}
            {setupStep === 0 && (
              <div className="setup-step">
                <div className="setup-step-label">Step 1 of 3</div>
                <div className="setup-step-title">Organization Profile</div>
                <div className="setup-step-body">
                  <label htmlFor="setup-org-name">Organization Name</label>
                  <input
                    id="setup-org-name"
                    type="text"
                    placeholder="e.g., Hacker Dojo"
                    value={setupData.orgName}
                    onChange={(e) => setSetupData((prev) => ({ ...prev, orgName: e.target.value }))}
                    required
                  />
                  <label htmlFor="setup-ein">EIN (Employer Identification Number)</label>
                  <input
                    id="setup-ein"
                    type="text"
                    placeholder="e.g., 26-3375350"
                    value={setupData.ein}
                    onChange={(e) => setSetupData((prev) => ({ ...prev, ein: e.target.value }))}
                    required
                  />
                  <label htmlFor="setup-mission">Mission Statement</label>
                  <textarea
                    id="setup-mission"
                    placeholder="Describe your organization's mission..."
                    value={setupData.mission}
                    onChange={(e) => setSetupData((prev) => ({ ...prev, mission: e.target.value }))}
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 1: Opencode Path */}
            {setupStep === 1 && (
              <div className="setup-step">
                <div className="setup-step-label">Step 2 of 3</div>
                <div className="setup-step-title">AI Agent Configuration</div>
                <div className="setup-step-body">
                  <label htmlFor="setup-opencode-path">Opencode Binary Path</label>
                  <input
                    id="setup-opencode-path"
                    type="text"
                    placeholder="e.g., /usr/local/bin/opencode"
                    value={setupData.opencodePath}
                    onChange={(e) => setSetupData((prev) => ({ ...prev, opencodePath: e.target.value }))}
                    required
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Leave blank if you don&apos;t have opencode installed. AI features can be configured later in Settings.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Reference Documents */}
            {setupStep === 2 && (
              <div className="setup-step">
                <div className="setup-step-label">Step 3 of 3</div>
                <div className="setup-step-title">Reference Documents</div>
                <div className="setup-step-body">
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    You can upload reference documents (budgets, impact reports, board lists, and
                    organizational documents) to help the AI write stronger grant proposals.
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Document upload is available from the Settings page after setup. Click
                    &ldquo;Complete setup&rdquo; below or &ldquo;Skip setup&rdquo; to proceed without
                    uploading documents now.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="setup-nav">
              <div>
                {setupStep > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={handleSetupPrevious}>
                    Back
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={handleSetupSkip}>
                  Skip setup
                </button>
                {setupStep < 2 ? (
                  <button type="button" className="btn btn-primary" onClick={handleSetupNext}>
                    Next
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => { void handleSetupComplete(); }}>
                    Complete setup
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grant Drawer */}
      <GrantDrawer
        key={`${selectedGrantId ?? 'none'}-${selectedGrantRefreshKey}`}
        grantId={selectedGrantId}
        onClose={handleDrawerClose}
        onRefreshAppState={refreshSelectedGrant}
      />
    </div>
  );
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
