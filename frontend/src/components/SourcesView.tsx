'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type {
  CrawlRun,
  Grant,
  JobFailureCategory,
  Source,
  SourceCategory,
  SourceCrawlAccessCategory,
  SourceCrawlState,
  SourceDiscoverySuggestion,
} from '../../../shared/types';
import { jobFailureMessages } from '../lib/failure-messages';

interface SourcesViewProps {
  onRefreshAppState?: () => Promise<void> | void;
}

const sourceCategories: SourceCategory[] = [
  'foundation',
  'government',
  'corporate',
  'community',
  'other',
];

type SourceFilter = 'all' | 'failing' | 'stale' | 'manual-only';

/**
 * Relative time display (similar to AppShell's getRelativeTime).
 */
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

/**
 * Check if a crawl timestamp is stale (> 7 days).
 */
function isCrawlStale(lastCrawledAt?: string): boolean {
  if (!lastCrawledAt) return false;
  const diffDays =
    (Date.now() - new Date(lastCrawledAt).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

function categoryLabel(category?: SourceCategory): string {
  if (!category) return 'Uncategorized';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Human-readable label for crawl state badge.
 */
function crawlStateLabel(state: SourceCrawlState): string {
  const labels: Record<SourceCrawlState, string> = {
    'never-crawled': 'Never Crawled',
    queued: 'Queued',
    running: 'Running',
    succeeded: 'Succeeded',
    'partially-failed': 'Partial Failure',
    failed: 'Failed',
  };
  return labels[state] ?? state;
}

/**
 * Semantic color for crawl state badge.
 */
function crawlStateColor(state: SourceCrawlState): string {
  const colors: Record<SourceCrawlState, string> = {
    'never-crawled': 'var(--text-muted)',
    queued: 'var(--color-warning, #e0894a)',
    running: 'var(--color-info, #7ba3b8)',
    succeeded: 'var(--color-success, #8aab6f)',
    'partially-failed': 'var(--color-warning, #e0894a)',
    failed: 'var(--color-error, #c66b5a)',
  };
  return colors[state] ?? 'var(--text-muted)';
}

/**
 * Human-readable label for crawl access category.
 */
function crawlAccessLabel(cat: SourceCrawlAccessCategory): string {
  const labels: Record<SourceCrawlAccessCategory, string> = {
    crawlable: 'Crawlable',
    'manual-only': 'Manual Only',
    unsupported: 'Unsupported',
  };
  return labels[cat] ?? cat;
}

export default function SourcesView({ onRefreshAppState }: SourcesViewProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [pendingSources, setPendingSources] = useState<Source[]>([]);
  const [showDiscoverForm, setShowDiscoverForm] = useState(false);
  const [discoverPrompt, setDiscoverPrompt] = useState('');
  const [discoverSuggestions, setDiscoverSuggestions] =
    useState<SourceDiscoverySuggestion[]>([]);
  const [discoverUnavailable, setDiscoverUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Source>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [crawlHistories, setCrawlHistories] = useState<Record<string, CrawlRun[]>>({});
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [retryingSourceIds, setRetryingSourceIds] = useState<Set<string>>(new Set());
  const [crawlNowIds, setCrawlNowIds] = useState<Set<string>>(new Set());
  const [scheduleStatuses, setScheduleStatuses] = useState<Record<string, { isEnabled: boolean; loading: boolean }>>({});

  // ProPublica search state
  const [propublicaQuery, setPropublicaQuery] = useState('');
  const [propublicaResults, setPropublicaResults] = useState<Grant[]>([]);
  const [propublicaLoading, setPropublicaLoading] = useState(false);
  const [propublicaUnavailable, setPropublicaUnavailable] = useState(false);
  const [propublicaSearched, setPropublicaSearched] = useState(false);

  const pendingCount = pendingSources.length;

  const loadSources = useCallback(async (): Promise<void> => {
    const [allResponse, pendingResponse] = await Promise.all([
      fetch('/api/sources'),
      fetch('/api/sources?filter=pending-review'),
    ]);
    const [all, pending] = await Promise.all([
      allResponse.json(),
      pendingResponse.json(),
    ]);
    setSources(Array.isArray(all) ? all : []);
    setPendingSources(Array.isArray(pending) ? pending : []);
  }, []);

  useEffect(() => {
    void loadSources().catch((error) => {
      console.error('Error loading sources:', error);
    });
  }, [loadSources]);

  const handleDiscover = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setDiscoverUnavailable(false);
    try {
      const response = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: discoverPrompt }),
      });
      const data = await response.json();
      setDiscoverSuggestions(
        Array.isArray(data.suggestions) ? data.suggestions : [],
      );
      setDiscoverUnavailable(Boolean(data.unavailable));
    } catch (error) {
      console.error('Error discovering sources:', error);
      setDiscoverSuggestions([]);
      setDiscoverUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const handleProPublicaSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!propublicaQuery.trim()) return;

    setPropublicaLoading(true);
    setPropublicaUnavailable(false);
    setPropublicaSearched(false);
    try {
      const response = await fetch(
        `/api/sources/propublica?query=${encodeURIComponent(propublicaQuery.trim())}`,
      );
      const data = await response.json();
      if (data.unavailable) {
        setPropublicaUnavailable(true);
        setPropublicaResults([]);
      } else if (Array.isArray(data.grants)) {
        setPropublicaResults(data.grants);
      } else {
        setPropublicaResults([]);
      }
      setPropublicaSearched(true);
    } catch (error) {
      console.error('Error searching ProPublica:', error);
      setPropublicaUnavailable(true);
      setPropublicaResults([]);
      setPropublicaSearched(true);
    } finally {
      setPropublicaLoading(false);
    }
  };

  const approveDiscoverySuggestion = async (
    suggestion: SourceDiscoverySuggestion,
  ) => {
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: suggestion.name,
        url: suggestion.url,
        type: suggestion.type,
        reviewStatus: 'pending-review',
        suggestedBy: 'ai',
        suggestionReason: suggestion.rationale,
        category: suggestion.suggestedCategory,
        crawlAccessCategory: suggestion.suggestedCrawlAccess ?? 'crawlable',
      }),
    });
    setDiscoverSuggestions((current) =>
      current.filter((item) => item.id !== suggestion.id),
    );
    await loadSources();
    await onRefreshAppState?.();
  };

  const approveSource = async (sourceId: string) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const rejectSource = async (sourceId: string) => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (!reason.trim()) return;
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const categorizeSource = async (
    sourceId: string,
    category: SourceCategory,
  ) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'categorize', category }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const startEdit = (source: Source) => {
    setEditingSourceId(source.id);
    setEditForm(source);
  };

  const saveEdit = async (sourceId: string) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        lastManualReviewDate: new Date().toISOString(),
      }),
    });
    setEditingSourceId(null);
    setEditForm({});
    await loadSources();
    await onRefreshAppState?.();
  };

  // ----- Crawl-related actions -----

  const toggleHistory = async (sourceId: string) => {
    setExpandedHistory((prev) => {
      const next = { ...prev, [sourceId]: !prev[sourceId] };
      return next;
    });

    // Lazy-load crawl history if not already loaded
    if (!crawlHistories[sourceId]) {
      try {
        const response = await fetch(
          `/api/sources?sourceId=${encodeURIComponent(sourceId)}`,
        );
        const history = await response.json();
        setCrawlHistories((prev) => ({
          ...prev,
          [sourceId]: Array.isArray(history) ? history : [],
        }));
      } catch (error) {
        console.error('Error loading crawl history:', error);
      }
    }
  };

  const retryCrawl = async (sourceId: string) => {
    setRetryingSourceIds((prev) => new Set(prev).add(sourceId));
    try {
      await fetch(
        `/api/sources/${encodeURIComponent(sourceId)}/retry-crawl`,
        { method: 'POST' },
      );
      // Reload sources after a brief delay for the crawl to start
      setTimeout(() => {
        void loadSources();
      }, 1000);
    } catch (error) {
      console.error('Error retrying crawl:', error);
    } finally {
      setRetryingSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  const crawlNow = async (sourceId: string) => {
    setCrawlNowIds((prev) => new Set(prev).add(sourceId));
    try {
      await fetch(
        `/api/sources/${encodeURIComponent(sourceId)}/retry-crawl`,
        { method: 'POST' },
      );
      setTimeout(() => {
        void loadSources();
      }, 1000);
    } catch (error) {
      console.error('Error triggering crawl:', error);
    } finally {
      setCrawlNowIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  const loadSchedule = async (sourceId: string) => {
    try {
      const response = await fetch(
        `/api/sources/${encodeURIComponent(sourceId)}/schedule`,
      );
      if (response.ok) {
        const data = await response.json();
        setScheduleStatuses((prev) => ({
          ...prev,
          [sourceId]: { isEnabled: data.isEnabled, loading: false },
        }));
      } else {
        // No schedule exists yet — default to paused
        setScheduleStatuses((prev) => ({
          ...prev,
          [sourceId]: { isEnabled: false, loading: false },
        }));
      }
    } catch {
      setScheduleStatuses((prev) => ({
        ...prev,
        [sourceId]: { isEnabled: false, loading: false },
      }));
    }
  };

  const toggleSchedule = async (sourceId: string, enable: boolean) => {
    setScheduleStatuses((prev) => ({
      ...prev,
      [sourceId]: { ...(prev[sourceId] ?? { isEnabled: false }), loading: true },
    }));
    try {
      if (enable) {
        await fetch(
          `/api/sources/${encodeURIComponent(sourceId)}/schedule`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ intervalHours: 24, isEnabled: true }),
          },
        );
      } else {
        await fetch(
          `/api/sources/${encodeURIComponent(sourceId)}/schedule`,
          { method: 'DELETE' },
        );
      }
      setScheduleStatuses((prev) => ({
        ...prev,
        [sourceId]: { isEnabled: enable, loading: false },
      }));
    } catch (error) {
      console.error('Error toggling schedule:', error);
      setScheduleStatuses((prev) => ({
        ...prev,
        [sourceId]: {
          ...(prev[sourceId] ?? { isEnabled: false }),
          loading: false,
        },
      }));
    }
  };

  // Load schedules for sources on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadSchedule is intentionally not in deps to avoid re-render loop
  useEffect(() => {
    sources.forEach((source) => {
      if (source.crawlAccessCategory === 'crawlable') {
        void loadSchedule(source.id);
      }
    });
  }, [sources]);

  const markAsManual = async (sourceId: string) => {
    const reason = window.prompt(
      'Reason for marking as manual-only? (optional)',
    );
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        crawlAccessCategory: 'manual-only' as SourceCrawlAccessCategory,
        ...(reason ? { categoryRationale: reason } : {}),
      }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  // ----- Filtered sources -----

  const filteredSources = useMemo(() => {
    switch (filter) {
      case 'failing':
        return sources.filter(
          (s) => s.sourceCrawlState === 'failed' || s.sourceCrawlState === 'partially-failed',
        );
      case 'stale':
        return sources.filter((s) => isCrawlStale(s.lastCrawledAt));
      case 'manual-only':
        return sources.filter((s) => s.crawlAccessCategory === 'manual-only');
      default:
        return sources;
    }
  }, [sources, filter]);

  // ----- Failure message lookup -----

  function getFailureMessage(
    category?: JobFailureCategory,
  ): { title: string; description: string; action: string } | null {
    if (!category) return null;
    return jobFailureMessages[category] ?? null;
  }

  // ----- Render helpers -----

  function renderCrawlStatusBadge(source: Source) {
    const state = source.sourceCrawlState;
    const color = crawlStateColor(state);
    const label = crawlStateLabel(state);

    return (
      <span
        className="crawl-status-badge"
        data-testid={`crawl-status-${source.id}`}
        style={{ color, borderColor: color }}
        role="status"
        aria-label={`Crawl status: ${label}`}
      >
        {state === 'running' && (
          <span className="spinner" aria-hidden="true" />
        )}
        {label}
      </span>
    );
  }

  function renderCrawlTimestamp(source: Source) {
    if (source.sourceCrawlState === 'never-crawled') {
      return (
        <span className="crawl-timestamp" data-testid={`last-crawled-${source.id}`}>
          Never crawled
        </span>
      );
    }

    if (source.lastCrawledAt) {
      const stale = isCrawlStale(source.lastCrawledAt);
      return (
        <span
          className={`crawl-timestamp ${stale ? 'stale' : ''}`}
          data-testid={`last-crawled-${source.id}`}
        >
          {stale && (
            <span
              className="stale-warning-icon"
              aria-hidden="true"
              title="Last crawl > 7 days ago"
            >
              ⚠️
            </span>
          )}
          Last crawl: {getRelativeTime(source.lastCrawledAt)}
        </span>
      );
    }

    return (
      <span className="crawl-timestamp" data-testid={`last-crawled-${source.id}`}>
        No crawl data
      </span>
    );
  }

  function renderFailureInfo(source: Source) {
    if (source.sourceCrawlState === 'never-crawled' || source.sourceCrawlState === 'succeeded') {
      return null;
    }

    const fm = getFailureMessage(source.failureCategory);
    if (source.lastFailedAt) {
      return (
        <div
          className="failure-info"
          data-testid={`failure-info-${source.id}`}
        >
          <span className="failure-timestamp">
            Last failed: {getRelativeTime(source.lastFailedAt)}
          </span>
          {fm && (
            <span className="failure-category" title={fm.description}>
              {fm.title}
            </span>
          )}
        </div>
      );
    }

    return null;
  }

  function renderCrawlAccessBadge(source: Source) {
    const cat = source.crawlAccessCategory;
    return (
      <span
        className={`crawl-access-badge access-${cat}`}
        data-testid={`crawl-access-${source.id}`}
        title={`Source type: ${crawlAccessLabel(cat)}`}
      >
        {crawlAccessLabel(cat)}
      </span>
    );
  }

  function renderRemediationActions(source: Source) {
    const state = source.sourceCrawlState;
    const isQueuedOrRunning =
      state === 'queued' || state === 'running';
    const scheduleInfo = scheduleStatuses[source.id];
    const isScheduled = scheduleInfo?.isEnabled ?? false;
    const isScheduleLoading = scheduleInfo?.loading ?? false;

    return (
      <div className="remediation-actions" data-testid={`remediation-${source.id}`}>
        {/* Crawl Now — always available for crawlable, approved sources */}
        {source.crawlAccessCategory === 'crawlable' &&
          source.reviewStatus === 'approved' && (
            <button
              type="button"
              className="btn-remediate btn-primary"
              data-testid={`crawl-now-btn-${source.id}`}
              disabled={isQueuedOrRunning || crawlNowIds.has(source.id)}
              onClick={() => void crawlNow(source.id)}
              aria-label={`Trigger crawl now for ${source.name}`}
            >
              {crawlNowIds.has(source.id)
                ? 'Starting...'
                : isQueuedOrRunning
                  ? 'Crawl in progress'
                  : '\u{1F680} Crawl Now'}
            </button>
          )}

        {/* Pause/Resume toggle — only for crawlable sources */}
        {source.crawlAccessCategory === 'crawlable' &&
          source.reviewStatus === 'approved' && (
            <button
              type="button"
              className={`btn-remediate ${isScheduled ? 'btn-warn' : 'btn-success'}`}
              data-testid={`toggle-schedule-btn-${source.id}`}
              disabled={isScheduleLoading}
              onClick={() => void toggleSchedule(source.id, !isScheduled)}
              aria-label={isScheduled ? `Pause crawling for ${source.name}` : `Resume crawling for ${source.name}`}
            >
              {isScheduleLoading
                ? '...'
                : isScheduled
                  ? '\u23F8\uFE0F Pause Crawling'
                  : '\u25B6\uFE0F Resume Crawling'}
            </button>
          )}

        {/* Retry crawl — for failed sources */}
        {state !== 'never-crawled' &&
          source.crawlAccessCategory !== 'manual-only' &&
          source.reviewStatus === 'approved' && (
            <button
              type="button"
              className="btn-remediate"
              data-testid={`retry-crawl-btn-${source.id}`}
              disabled={isQueuedOrRunning || retryingSourceIds.has(source.id)}
              onClick={() => void retryCrawl(source.id)}
              aria-label={`Retry crawl for ${source.name}`}
            >
              {retryingSourceIds.has(source.id)
                ? 'Retrying...'
                : isQueuedOrRunning
                  ? 'Crawl in progress'
                  : 'Retry Crawl'}
            </button>
          )}

        {/* Edit config */}
        <button
          type="button"
          className="btn-remediate"
          data-testid={`edit-config-btn-${source.id}`}
          onClick={() => startEdit(source)}
          aria-label={`Edit configuration for ${source.name}`}
        >
          Edit Config
        </button>

        {/* Mark as manual-only */}
        {source.crawlAccessCategory !== 'manual-only' && (
          <button
            type="button"
            className="btn-remediate btn-ghost"
            data-testid={`mark-manual-btn-${source.id}`}
            onClick={() => void markAsManual(source.id)}
            aria-label={`Mark ${source.name} as manual-only`}
          >
            Mark Manual
          </button>
        )}
      </div>
    );
  }

  function renderCrawlHistory(sourceId: string) {
    if (!expandedHistory[sourceId]) return null;

    const history = crawlHistories[sourceId] ?? [];
    const isLoading = !crawlHistories[sourceId];

    // Compute stats
    const totalRuns = history.length;
    const succeededRuns = history.filter((r) => r.status === 'completed').length;
    const failedRuns = history.filter((r) => r.status === 'failed').length;
    const partialRuns = history.filter((r) => r.status === 'partial-results').length;
    const successRate = totalRuns > 0 ? Math.round((succeededRuns / totalRuns) * 100) : 0;
    const lastSuccess = history.find((r) => r.status === 'completed');
    const lastFailure = history.find((r) => r.status === 'failed');

    return (
      <div
        className="crawl-history-panel"
        data-testid={`crawl-history-${sourceId}`}
      >
        <h4>Crawl History</h4>

        {/* Summary stats */}
        {totalRuns > 0 && (
          <div className="crawl-history-stats" data-testid={`crawl-stats-${sourceId}`}>
            <div className="stat-row">
              <span className="stat-label">Total runs:</span>
              <span className="stat-value">{totalRuns}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Success rate:</span>
              <span className={`stat-value ${successRate >= 80 ? 'stat-good' : successRate >= 50 ? 'stat-warn' : 'stat-bad'}`}>
                {successRate}% ({succeededRuns}/{totalRuns})
              </span>
            </div>
            {lastSuccess && (
              <div className="stat-row">
                <span className="stat-label">Last success:</span>
                <span className="stat-value">
                  {getRelativeTime(lastSuccess.completedAt || lastSuccess.startedAt)}
                </span>
              </div>
            )}
            {lastFailure && (
              <div className="stat-row">
                <span className="stat-label">Last failure:</span>
                <span className="stat-value stat-bad">
                  {getRelativeTime(lastFailure.completedAt || lastFailure.startedAt)}
                  {lastFailure.failureCategory && (
                    <span className="failure-category-tag">
                      {jobFailureMessages[lastFailure.failureCategory]?.title ?? lastFailure.failureCategory}
                    </span>
                  )}
                </span>
              </div>
            )}
            {failedRuns > 0 && (
              <div className="stat-row">
                <span className="stat-label">Failures:</span>
                <span className="stat-value stat-bad">
                  {failedRuns} failed{partialRuns > 0 ? `, ${partialRuns} partial` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {isLoading && <div className="history-loading">Loading...</div>}
        {!isLoading && history.length === 0 && (
          <div className="history-empty">No crawl history available.</div>
        )}
        {!isLoading && (
          <details>
            <summary>Recent crawl runs ({history.length})</summary>
            {history.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className={`history-entry history-${run.status}`}
                data-testid={`crawl-run-${run.id}`}
              >
                <span className="history-time">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
                <span className={`history-status status-${run.status}`}>
                  {run.status}
                </span>
                {run.completedAt && (
                  <span className="history-duration">
                    Duration:{' '}
                    {Math.round(
                      (new Date(run.completedAt).getTime() -
                        new Date(run.startedAt).getTime()) /
                        1000,
                    )}
                    s
                  </span>
                )}
                {run.grantsFound > 0 && (
                  <span className="history-grants">
                    {run.grantsFound} grants found
                  </span>
                )}
                {run.errorMessage && (
                  <span
                    className="history-error"
                    title={run.errorMessage}
                  >
                    Error: {run.errorMessage.substring(0, 80)}
                    {run.errorMessage.length > 80 ? '...' : ''}
                  </span>
                )}
                {run.failureCategory && (
                  <span className="history-failure-category">
                    {jobFailureMessages[run.failureCategory]?.title ??
                      run.failureCategory}
                  </span>
                )}
              </div>
            ))}
          </details>
        )}
      </div>
    );
  }

  // ----- Filter tabs -----

  const filterTabs: { key: SourceFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: sources.length },
    {
      key: 'failing',
      label: 'Failing',
      count: sources.filter(
        (s) =>
          s.sourceCrawlState === 'failed' ||
          s.sourceCrawlState === 'partially-failed',
      ).length,
    },
    {
      key: 'stale',
      label: 'Stale',
      count: sources.filter((s) => isCrawlStale(s.lastCrawledAt)).length,
    },
    {
      key: 'manual-only',
      label: 'Manual Only',
      count: sources.filter((s) => s.crawlAccessCategory === 'manual-only')
        .length,
    },
  ];

  // ----- Pending sources panel (unchanged from original) -----

  const pendingSourcesPanel = (
    <section
      className="sources-section"
      data-testid="sources-pending-review-section"
    >
      <h2>Pending review</h2>
      {pendingSources.length === 0 ? (
        <div>No sources pending review</div>
      ) : (
        pendingSources.map((source) => (
          <div key={source.id} className="source-row">
            <div>
              <strong>{source.name}</strong>
              {source.crawlAccessCategory === 'unsupported' && (
                <span className="approval-gate-badge unsupported-badge">
                  ⚠️ Unsupported
                </span>
              )}
              <div>{source.url}</div>
              {source.suggestionReason && (
                <div className="source-note">{source.suggestionReason}</div>
              )}
              {source.category && (
                <div className="source-note">
                  Category: {categoryLabel(source.category)}
                </div>
              )}
              {source.authMethodDescription && (
                <div className="source-note">
                  Auth: {source.authMethodDescription}
                </div>
              )}
              {source.crawlFrequencyRecommendation && (
                <div className="source-note">
                  Frequency: {source.crawlFrequencyRecommendation}
                </div>
              )}
            </div>
            {source.crawlAccessCategory === 'unsupported' && (
              <div className="unsupported-guidance" data-testid={`unsupported-guidance-pending-${source.id}`}>
                <strong>⚠️ This source cannot be crawled automatically.</strong>{' '}
                Review and consider classifying as manual-only or rejecting it.
              </div>
            )}
            <div className="source-actions">
              <button
                type="button"
                data-testid={`approve-source-btn-${source.id}`}
                onClick={() => void approveSource(source.id)}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void rejectSource(source.id)}
              >
                Reject
              </button>
              <div>
                <button
                  type="button"
                  data-testid={`categorize-source-btn-${source.id}`}
                >
                  Categorize
                </button>
                {sourceCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      void categorizeSource(source.id, category)
                    }
                  >
                    {categoryLabel(category)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid={`edit-source-btn-${source.id}`}
                onClick={() => startEdit(source)}
              >
                Edit
              </button>
            </div>
            {editingSourceId === source.id && (
              <div className="edit-panel">
                <input
                  value={editForm.name ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
                <input
                  value={editForm.url ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      url: e.target.value,
                    }))
                  }
                />
                <select
                  value={editForm.category ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      category: e.target.value as SourceCategory,
                    }))
                  }
                >
                  <option value="">Uncategorized</option>
                  {sourceCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
                <input
                  value={editForm.categoryRationale ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      categoryRationale: e.target.value,
                    }))
                  }
                  placeholder="Category rationale"
                />
                <input
                  value={editForm.authMethodDescription ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      authMethodDescription: e.target.value,
                    }))
                  }
                  placeholder="Auth method (e.g. none, API key)"
                />
                <input
                  value={editForm.operatorNotes ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      operatorNotes: e.target.value,
                    }))
                  }
                  placeholder="Operator notes"
                />
                <button
                  type="button"
                  onClick={() => void saveEdit(source.id)}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Sources <span className="accent">Review queue</span>
          </h1>
          <div className="header-sub">
            {pendingCount} sources awaiting review
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            data-testid="discover-sources-btn"
            onClick={() => setShowDiscoverForm((value) => !value)}
          >
            Discover Sources
          </button>
        </div>
      </div>

      {showDiscoverForm && (
        <form onSubmit={handleDiscover}>
          <textarea
            data-testid="discovery-prompt-input"
            value={discoverPrompt}
            onChange={(e) => setDiscoverPrompt(e.target.value)}
            placeholder="Describe the grants you are looking for"
          />
          <button
            type="submit"
            data-testid="find-sources-submit-btn"
            disabled={loading}
          >
            {loading ? 'Finding...' : 'Find Sources'}
          </button>
        </form>
      )}

      {discoverUnavailable && (
        <div data-testid="discovery-unavailable-msg">
          Source discovery requires opencode. Configure it in Settings.
        </div>
      )}

      {discoverSuggestions.length > 0 && (
        <section data-testid="discovery-suggestions-section">
          <h2>Source Suggestions ({discoverSuggestions.length})</h2>
          <p className="section-note">
            Review and approve suggestions. Sources require operator approval before
            they can be crawled.
          </p>
          {discoverSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="discovery-review-card"
              data-testid="discovery-suggestion-item"
            >
              <div className="review-card-header">
                <strong>{suggestion.name}</strong>
                <span className={`confidence-badge ${suggestion.confidence >= 0.7 ? 'conf-high' : suggestion.confidence >= 0.4 ? 'conf-mid' : 'conf-low'}`}>
                  {Math.round(suggestion.confidence * 100)}% confidence
                </span>
              </div>
              <div className="review-card-url">
                <a href={suggestion.url} target="_blank" rel="noopener noreferrer">
                  {suggestion.url}
                </a>
              </div>

              {/* AI-suggested metadata */}
              <div className="review-card-meta">
                {suggestion.suggestedCategory && (
                  <span className="meta-tag">
                    Category: {categoryLabel(suggestion.suggestedCategory)}
                  </span>
                )}
                {suggestion.suggestedCrawlAccess && (
                  <span className={`meta-tag access-${suggestion.suggestedCrawlAccess}`}>
                    Access: {crawlAccessLabel(suggestion.suggestedCrawlAccess)}
                  </span>
                )}
                {suggestion.authMethodDescription && (
                  <span className="meta-tag">
                    Auth: {suggestion.authMethodDescription}
                  </span>
                )}
                {suggestion.crawlFrequencyRecommendation && (
                  <span className="meta-tag">
                    Frequency: {suggestion.crawlFrequencyRecommendation}
                  </span>
                )}
              </div>

              <div className="review-card-rationale">
                <strong>Rationale:</strong> {suggestion.rationale}
              </div>

              {/* Unsupported source guidance */}
              {suggestion.suggestedCrawlAccess === 'unsupported' && (
                <div className="review-card-warning" data-testid={`unsupported-warning-${suggestion.id}`}>
                  <strong>⚠️ This source is classified as unsupported.</strong>{' '}
                  It may require authentication, be behind a paywall, or use anti-bot measures
                  that prevent automated crawling. Consider manual review or alternative sources.
                </div>
              )}

              {/* Approval required gate */}
              <div className="review-card-notice">
                <strong>⚠️ Approval required:</strong> This source will be added with
                &quot;pending-review&quot; status and must be explicitly approved before it can
                be crawled.
              </div>

              <div className="review-card-actions">
                <button
                  type="button"
                  className="btn-approve"
                  data-testid="approve-suggestion-btn"
                  onClick={() =>
                    void approveDiscoverySuggestion(suggestion)
                  }
                >
                  ✓ Add to Review Queue
                </button>
                <button
                  type="button"
                  className="btn-dismiss"
                  onClick={() =>
                    setDiscoverSuggestions((current) =>
                      current.filter((item) => item.id !== suggestion.id),
                    )
                  }
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ProPublica Nonprofit Explorer Search */}
      <section className="propublica-section" data-testid="propublica-search-section">
        <div className="panel-header">
          <div className="panel-title">
            Search ProPublica Nonprofit Explorer
          </div>
        </div>
        <form onSubmit={handleProPublicaSearch} className="propublica-search-form">
          <input
            type="text"
            data-testid="propublica-search-input"
            value={propublicaQuery}
            onChange={(e) => setPropublicaQuery(e.target.value)}
            placeholder="Search for grants (e.g., education grants for nonprofits in California)"
            className="form-input"
          />
          <button
            type="submit"
            data-testid="propublica-search-btn"
            disabled={propublicaLoading || !propublicaQuery.trim()}
            className="btn btn-primary"
          >
            {propublicaLoading ? 'Searching...' : 'Search ProPublica'}
          </button>
        </form>

        {propublicaUnavailable && (
          <div data-testid="propublica-unavailable-msg" className="blocking-message">
            ProPublica is currently unavailable. Your local data is unaffected.
          </div>
        )}

        {propublicaSearched && !propublicaUnavailable && propublicaResults.length === 0 && (
          <div className="empty-state-guide" data-testid="propublica-empty-results">
            <div className="empty-state-title">No results found</div>
            <div className="empty-state-description">
              Try a different search query or check if ProPublica has data for your area of interest.
            </div>
          </div>
        )}

        {propublicaResults.length > 0 && (
          <div className="propublica-results" data-testid="propublica-results-list">
            <h3>Results ({propublicaResults.length})</h3>
            {propublicaResults.map((grant) => (
              <div key={grant.id} className="propublica-result-item">
                <div className="grant-title">{grant.title}</div>
                <div className="grant-funder">{grant.funder}</div>
                <div className="propublica-result-meta">
                  <span>{grant.award}</span>
                  {grant.deadline && grant.deadline !== 'Rolling' && (
                    <span>Deadline: {grant.deadline}</span>
                  )}
                  {grant.tags && grant.tags.length > 0 && (
                    <span>Tags: {grant.tags.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingSourcesPanel}

      {/* Filter tabs */}
      <section data-testid="sources-filter-tabs">
        <div className="filter-tabs" role="tablist" aria-label="Source filters">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
              data-testid={`filter-tab-${tab.key}`}
              aria-selected={filter === tab.key}
              aria-label={`${tab.label} sources${tab.count !== undefined ? ` (${tab.count})` : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="filter-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* No approved sources blocking message */}
      {sources.length > 0 &&
        sources.every((s) => s.reviewStatus !== 'approved') && (
          <div
            className="blocking-message"
            data-testid="no-approved-sources-msg"
            role="alert"
          >
            <strong>⚠️ No approved sources available for crawling.</strong>{' '}
            {sources.filter((s) => s.reviewStatus === 'pending-review').length > 0
              ? `${sources.filter((s) => s.reviewStatus === 'pending-review').length} source(s) are pending review. Approve them in the review queue above to enable crawling.`
              : 'Add and approve sources to enable grant research and crawling.'}
          </div>
        )}

      {/* All sources with crawl status */}
      <section data-testid="sources-all-section">
        <h2>All sources</h2>
        {sources.length === 0 ? (
          /* Empty state: no sources at all */
          <div className="sources-empty-state" data-testid="sources-empty-state">
            <div className="empty-state-icon" aria-hidden="true">📡</div>
            <h3>No sources configured</h3>
            <p>
              Sources are the grant databases, websites, and APIs that the system
              searches to find new funding opportunities. Each source must be
              explicitly added and approved before it can be crawled.
            </p>
            <p className="empty-state-reason">
              <strong>Why explicit sources matter:</strong> Grant research requires
              targeted, verified sources to produce quality matches. Generic web
              crawling wastes resources and produces noise. Every source in your
              configuration represents a deliberate, researched choice.
            </p>
            <button
              type="button"
              className="btn-primary"
              data-testid="add-first-source-btn"
              onClick={() => setShowDiscoverForm(true)}
            >
              + Add your first source
            </button>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="sources-empty" data-testid="sources-empty-filter">
            No sources match the current filter.
          </div>
        ) : (
          filteredSources.map((source) => (
            <div
              key={source.id}
              className="source-row source-row-enhanced"
              data-testid={`source-item-${source.id}`}
            >
              <div className="source-main">
                <div className="source-header">
                  <strong>{source.name}</strong>
                  {renderCrawlStatusBadge(source)}
                  {renderCrawlAccessBadge(source)}
                  {/* Approval gate indicator */}
                  {source.reviewStatus === 'pending-review' && (
                    <span
                      className="approval-gate-badge"
                      data-testid={`approval-needed-${source.id}`}
                      title="This source requires operator approval before it can be crawled"
                    >
                      ⚠️ Needs Approval
                    </span>
                  )}
                  {source.reviewStatus === 'rejected' && (
                    <span
                      className="approval-gate-badge rejected"
                      data-testid={`rejected-badge-${source.id}`}
                      title={source.rejectionReason || 'This source was rejected'}
                    >
                      ✕ Rejected
                    </span>
                  )}
                </div>
                <div className="source-url">{source.url}</div>
                {source.suggestionReason && (
                  <div className="source-rationale">
                    <em>{source.suggestionReason}</em>
                  </div>
                )}
                <div className="source-meta">
                  {renderCrawlTimestamp(source)}
                  {renderFailureInfo(source)}
                  {/* Additional metadata */}
                  {source.category && (
                    <span className="meta-tag-inline">
                      {categoryLabel(source.category)}
                    </span>
                  )}
                  {source.authMethodDescription && (
                    <span className="meta-tag-inline">
                      Auth: {source.authMethodDescription}
                    </span>
                  )}
                  {source.crawlFrequencyRecommendation && (
                    <span className="meta-tag-inline">
                      {source.crawlFrequencyRecommendation}
                    </span>
                  )}
                  {source.lastManualReviewDate && (
                    <span className="meta-tag-inline" title="Last manual review">
                      Reviewed: {getRelativeTime(source.lastManualReviewDate)}
                    </span>
                  )}
                </div>

                {/* Unsupported source guidance */}
                {source.crawlAccessCategory === 'unsupported' && (
                  <div className="unsupported-guidance" data-testid={`unsupported-guidance-${source.id}`}>
                    <strong>⚠️ Unsupported for automated crawling.</strong>{' '}
                    This source may require authentication, be behind a paywall, or use anti-bot
                    measures. Consider manual review or removing this source.
                  </div>
                )}

                {/* Operator notes */}
                {source.operatorNotes && (
                  <div className="operator-notes" data-testid={`operator-notes-${source.id}`}>
                    <strong>Notes:</strong> {source.operatorNotes}
                  </div>
                )}

                {renderRemediationActions(source)}
              </div>

              {/* Expand toggle for crawl history */}
              <button
                type="button"
                className="history-toggle"
                data-testid={`history-toggle-${source.id}`}
                aria-expanded={Boolean(expandedHistory[source.id])}
                aria-controls={`crawl-history-${source.id}`}
                onClick={() => void toggleHistory(source.id)}
              >
                {expandedHistory[source.id]
                  ? '▲ Hide History'
                  : '▼ Crawl History'}
              </button>

              {renderCrawlHistory(source.id)}

              {/* Inline edit panel */}
              {editingSourceId === source.id && (
                <div
                  className="edit-panel"
                  data-testid={`edit-panel-${source.id}`}
                >
                  <label htmlFor={`edit-name-${source.id}`}>Name</label>
                  <input
                    id={`edit-name-${source.id}`}
                    value={editForm.name ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor={`edit-url-${source.id}`}>URL</label>
                  <input
                    id={`edit-url-${source.id}`}
                    value={editForm.url ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        url: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor={`edit-category-${source.id}`}>
                    Category
                  </label>
                  <select
                    id={`edit-category-${source.id}`}
                    value={editForm.category ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        category: e.target.value as SourceCategory,
                      }))
                    }
                  >
                    <option value="">Uncategorized</option>
                    {sourceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={`edit-access-${source.id}`}>
                    Crawl access
                  </label>
                  <select
                    id={`edit-access-${source.id}`}
                    value={editForm.crawlAccessCategory ?? 'crawlable'}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        crawlAccessCategory: e.target
                          .value as SourceCrawlAccessCategory,
                      }))
                    }
                  >
                    <option value="crawlable">Crawlable</option>
                    <option value="manual-only">Manual Only</option>
                    <option value="unsupported">Unsupported</option>
                  </select>
                  <label htmlFor={`edit-rationale-${source.id}`}>
                    Category rationale
                  </label>
                  <input
                    id={`edit-rationale-${source.id}`}
                    value={editForm.categoryRationale ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        categoryRationale: e.target.value,
                      }))
                    }
                    placeholder="Category rationale"
                  />
                  <label htmlFor={`edit-auth-${source.id}`}>
                    Auth method
                  </label>
                  <input
                    id={`edit-auth-${source.id}`}
                    value={editForm.authMethodDescription ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        authMethodDescription: e.target.value,
                      }))
                    }
                    placeholder="e.g. none, API key, OAuth2"
                  />
                  <label htmlFor={`edit-freq-${source.id}`}>
                    Crawl frequency
                  </label>
                  <select
                    id={`edit-freq-${source.id}`}
                    value={editForm.crawlFrequencyRecommendation ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        crawlFrequencyRecommendation: e.target.value,
                      }))
                    }
                  >
                    <option value="">Not set</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <label htmlFor={`edit-notes-${source.id}`}>
                    Operator notes
                  </label>
                  <textarea
                    id={`edit-notes-${source.id}`}
                    value={editForm.operatorNotes ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        operatorNotes: e.target.value,
                      }))
                    }
                    placeholder="Add notes about this source..."
                    rows={3}
                  />
                  <div className="edit-panel-actions">
                    <button
                      type="button"
                      data-testid={`save-edit-btn-${source.id}`}
                      onClick={() => void saveEdit(source.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingSourceId(null);
                        setEditForm({});
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
