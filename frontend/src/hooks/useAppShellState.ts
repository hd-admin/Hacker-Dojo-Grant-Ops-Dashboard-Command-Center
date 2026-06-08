'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { client } from '../lib/grant-ops-client';
import type { HealthTier } from '../components/AppShellHealthBanner';
import { useToast } from '../components/ToastProvider';
import { useJobsFeed } from './useJobsFeed';

export interface LoadActiveJobsOptions {
  force?: boolean;
}

export interface AppShellState {
  grants: Grant[];
  sources: Source[];
  profile: OrganizationProfile | null;
  crawlStatus: CrawlStatus;
  notifications: Notification[];
  tasks: Task[];
  recentGrantIds: string[];
  healthResult: HealthCheckResult | null;
  activeJobs: JobQueueItem[];
  pendingDuplicatesCount: number;
  healthTier: HealthTier;
  isCrawlStale: boolean;
  opencodeBlocked: boolean;
  pendingSourcesCount: number;
  setRecentGrantIds: (updater: (current: string[]) => string[]) => void;
  refreshHealth: () => Promise<void>;
  refreshAppState: () => Promise<void>;
  loadActiveJobs: (options?: LoadActiveJobsOptions) => Promise<JobQueueItem[]>;
}

export function useAppShellState(): AppShellState {
  const { addToast } = useToast();

  const [grants, setGrants] = useState<Grant[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({ online: true, lastSync: '' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentGrantIds, setRecentGrantIdsState] = useState<string[]>([]);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [activeJobs, setActiveJobs] = useState<JobQueueItem[]>([]);
  const [pendingDuplicatesCount, setPendingDuplicatesCount] = useState(0);
  const [, setError] = useState<string | null>(null);

  const previousJobStatuses = useRef<Record<string, JobQueueItem['status']>>({});
  const jobsRef = useRef<JobQueueItem[]>([]);

  const { jobs: feedJobs, refresh: feedRefresh } = useJobsFeed({ pollIntervalMs: 5000 });

  useEffect(() => {
    jobsRef.current = feedJobs;
  }, [feedJobs]);

  const setRecentGrantIds = useCallback(
    (updater: (current: string[]) => string[]): void => {
      setRecentGrantIdsState((current) => updater(current));
    },
    [],
  );

  const pendingSourcesCount = useMemo(
    () => sources.filter((source) => source.reviewStatus === 'pending-review').length,
    [sources],
  );

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

  const loadActiveJobs = useCallback(
    async (options?: LoadActiveJobsOptions): Promise<JobQueueItem[]> => {
      let data: JobQueueItem[] = jobsRef.current;
      if (options?.force === true) {
        await feedRefresh();
        data = jobsRef.current;
      }
      const active = data.filter(
        (job) =>
          job.status === 'queued' ||
          job.status === 'running' ||
          job.status === 'verifying' ||
          job.status === 'retrying',
      );
      setActiveJobs(active);

      const prevStatuses = previousJobStatuses.current;
      for (const job of data) {
        const prevStatus = prevStatuses[job.id];
        if (prevStatus && prevStatus !== 'completed' && job.status === 'completed') {
          addToast(`\u2705 ${job.jobType} completed`, 'success');
        }
        if (prevStatus && prevStatus !== 'failed' && job.status === 'failed') {
          addToast(`\u274C ${job.jobType} failed`, 'error');
        }
      }
      const nextStatuses: Record<string, JobQueueItem['status']> = {};
      for (const job of data) {
        nextStatuses[job.id] = job.status;
      }
      previousJobStatuses.current = nextStatuses;
      return active;
    },
    [addToast, feedRefresh],
  );

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

  return {
    grants,
    sources,
    profile,
    crawlStatus,
    notifications,
    tasks,
    recentGrantIds,
    healthResult,
    activeJobs,
    pendingDuplicatesCount,
    healthTier,
    isCrawlStale,
    opencodeBlocked,
    pendingSourcesCount,
    setRecentGrantIds,
    refreshHealth,
    refreshAppState,
    loadActiveJobs,
  };
}
