'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobQueueItem } from '../../../shared/types';
import { jobFailureMessages } from '../lib/failure-messages';

type JobStatus = JobQueueItem['status'] | 'all';
type JobTypeFilter = JobQueueItem['jobType'] | 'all';

interface JobsPanelProps {
  onRefreshAppState?: () => Promise<void> | void;
}

/** Client-side progress mapping matching the server-side JobProgressStage values. */
const stageProgress: Record<string, number> = {
  queued: 0,
  retrying: 5,
  preparing: 10,
  fetching: 30,
  analyzing: 60,
  drafting: 80,
  completed: 100,
  failed: 100,
  cancelled: 100,
};

function getProgress(stage: string | undefined): number {
  return stage ? (stageProgress[stage] ?? 0) : 0;
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

function statusIcon(status: JobQueueItem['status']): string {
  switch (status) {
    case 'queued': return '◷';
    case 'running': return '◉';
    case 'verifying': return '✓';
    case 'retrying': return '⟳';
    case 'completed': return '✔';
    case 'failed': return '✖';
    case 'cancelled': return '⊘';
    default: return '○';
  }
}

function stageDescription(stage: string | undefined): string {
  if (!stage || stage === 'queued') return 'Waiting to start';
  if (stage === 'retrying') return 'Retrying after previous attempt';
  if (stage === 'preparing') return 'Preparing resources';
  if (stage === 'fetching') return 'Fetching data';
  if (stage === 'analyzing') return 'Analyzing results';
  if (stage === 'drafting') return 'Generating draft';
  if (stage === 'completed') return 'Completed successfully';
  if (stage === 'failed') return 'Failed';
  if (stage === 'cancelled') return 'Cancelled';
  return stage;
}

export default function JobsPanel({ onRefreshAppState }: JobsPanelProps) {
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus>('all');
  const [typeFilter, setTypeFilter] = useState<JobTypeFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelConfirmJobId, setCancelConfirmJobId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const url = `/api/jobs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load jobs: ${response.status}`);
      const data = (await response.json()) as JobQueueItem[];
      setJobs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Error loading jobs');
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  const setJobActionLoading = useCallback(
    (jobId: string, loading: boolean) => {
      setActionLoading((prev) => {
        if (loading) return { ...prev, [jobId]: true };
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    },
    [],
  );

  const handleRetry = useCallback(
    async (jobId: string) => {
      setJobActionLoading(jobId, true);
      try {
        const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Retry failed');
        }
        await loadJobs();
        if (onRefreshAppState) await onRefreshAppState();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Retry failed',
        );
      } finally {
        setJobActionLoading(jobId, false);
      }
    },
    [loadJobs, onRefreshAppState, setJobActionLoading],
  );

  const handleCancelRequest = useCallback((jobId: string) => {
    setCancelConfirmJobId(jobId);
  }, []);

  const confirmCancel = useCallback(async () => {
    const jobId = cancelConfirmJobId;
    if (!jobId) return;
    setCancelConfirmJobId(null);
    setJobActionLoading(jobId, true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? 'Cancel failed');
      }
      await loadJobs();
      if (onRefreshAppState) await onRefreshAppState();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Cancel failed',
      );
    } finally {
      setJobActionLoading(jobId, false);
    }
  }, [cancelConfirmJobId, loadJobs, onRefreshAppState, setJobActionLoading]);

  const dismissCancelConfirm = useCallback(() => {
    setCancelConfirmJobId(null);
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Auto-refresh when there are active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === 'queued' || job.status === 'running' || job.status === 'verifying' || job.status === 'retrying',
    );
    if (!hasActiveJobs) return;

    const interval = window.setInterval(() => {
      void loadJobs();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [jobs, loadJobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const statusMatch = statusFilter === 'all' || job.status === statusFilter;
      const typeMatch = typeFilter === 'all' || job.jobType === typeFilter;
      return statusMatch && typeMatch;
    });
  }, [jobs, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<JobStatus, number> = {
      all: jobs.length,
      queued: 0,
      running: 0,
      verifying: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const job of jobs) {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const typeCounts = useMemo(() => {
    const counts: Record<JobTypeFilter, number> = {
      all: jobs.length,
      research: 0,
      draft: 0,
      crawl: 0,
      match: 0,
      extract: 0,
      'peer-discovery': 0,
      'funder-insights': 0,
      'eligibility-vetting': 0,
      'budget-import': 0,
    };
    for (const job of jobs) {
      counts[job.jobType] = (counts[job.jobType] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const activeCount = statusCounts.queued + statusCounts.running;

  if (loading) {
    return (
      <div className="spinner-overlay" data-testid="jobs-panel-loading" role="status" aria-busy="true" aria-label="Loading jobs">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="header" data-testid="jobs-panel-header">
        <div>
          <h1 className="header-title">
            Job <span className="accent">Queue</span>
          </h1>
          <div className="header-sub">
            {jobs.length} total jobs
            {activeCount > 0 && (
              <span className="nav-count" style={{ marginLeft: '8px' }}>
                {activeCount} active
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="jobs-refresh-btn"
            onClick={() => { void loadJobs(); }}
          >
            {'↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="panel" data-testid="jobs-error-banner">
          <div className="drawer-note" style={{ color: 'var(--text-error)' }}>
            {error}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="panel">
        <div className="filter-row" data-testid="jobs-status-filter" role="tablist" aria-label="Filter by job status">
          {(['all', 'queued', 'running', 'completed', 'failed', 'cancelled'] as JobStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={statusFilter === status}
              className={`btn btn-ghost btn-sm ${statusFilter === status ? 'active' : ''}`}
              data-status={status}
              data-testid={`jobs-status-btn-${status}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {statusCounts[status] > 0 && (
                <span className="nav-count" style={{ marginLeft: '4px' }}>
                  {statusCounts[status]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="filter-row" data-testid="jobs-type-filter" role="tablist" aria-label="Filter by job type" style={{ marginTop: '8px' }}>
          {(['all', 'research', 'draft', 'crawl', 'match', 'extract', 'peer-discovery', 'funder-insights', 'eligibility-vetting', 'budget-import'] as JobTypeFilter[]).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={typeFilter === type}
              className={`btn btn-ghost btn-sm ${typeFilter === type ? 'active' : ''}`}
              data-type={type}
              data-testid={`jobs-type-btn-${type}`}
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              {typeCounts[type] > 0 && (
                <span className="nav-count" style={{ marginLeft: '4px' }}>
                  {typeCounts[type]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ARIA live region for job state announcements */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="jobs-aria-live"
      >
        {activeCount > 0
          ? `${activeCount} job${activeCount !== 1 ? 's' : ''} active`
          : 'No active jobs'}
      </div>

      {/* Job list */}
      {filteredJobs.length === 0 ? (
        <div className="empty-state-guide" data-testid="jobs-empty-state">
          <div className="empty-state-icon" aria-hidden="true">{'📋'}</div>
          <div className="empty-state-title">No jobs found</div>
          <div className="empty-state-description">
            Jobs appear here when the system processes research or generates drafts.
          </div>
        </div>
      ) : (
        <div className="panel" data-testid="jobs-list">
          {filteredJobs.map((job) => {
            const progress = getProgress(job.stage);
            const isRunning = job.status === 'running';
            const failureMsg =
              job.failureCategory && job.status === 'failed'
                ? jobFailureMessages[job.failureCategory]
                : null;

            return (
              <div
                key={job.id}
                className={`job-card ${job.status} ${selectedJobId === job.id ? 'expanded' : ''}`}
                data-testid={`job-item-${job.status}-${job.id}`}
              >
                <div className="job-card-header">
                  <span className="job-status-icon" aria-hidden="true">
                    {statusIcon(job.status)}
                  </span>
                  <span className={`job-badge job-badge-type job-badge-${job.jobType}`}>
                    {job.jobType}
                  </span>
                  <span className={`job-badge job-badge-status job-badge-${job.status}`}>
                    {job.status}
                  </span>
                  {job.entityId && (
                    <button
                      type="button"
                      className="job-entity-link"
                      data-testid={`job-entity-link-${job.id}`}
                      title={`Linked entity: ${job.entityId}`}
                    >
                      {job.entityId.length > 12
                        ? `${job.entityId.substring(0, 12)}...`
                        : job.entityId}
                    </button>
                  )}
                  {job.retryCount !== undefined && job.retryCount > 0 && (
                    <span className="job-retry-count" data-testid={`job-retry-${job.id}`}>
                      Retry #{job.retryCount}
                    </span>
                  )}
                  <div className="job-actions">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm job-action-btn job-action-cancel"
                        data-testid={`job-cancel-btn-${job.id}`}
                        disabled={actionLoading[job.id] === true}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelRequest(job.id);
                        }}
                        title="Cancel this job"
                      >
                        {actionLoading[job.id] === true
                          ? '...'
                          : '✕ Cancel'}
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm job-action-btn job-action-retry"
                        data-testid={`job-retry-btn-${job.id}`}
                        disabled={actionLoading[job.id] === true}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRetry(job.id);
                        }}
                        title="Retry this job"
                      >
                        {actionLoading[job.id] === true
                          ? '...'
                          : '↻ Retry'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    data-testid={`job-toggle-details-${job.id}`}
                    onClick={() =>
                      setSelectedJobId((current) =>
                        current === job.id ? null : job.id,
                      )
                    }
                    aria-expanded={selectedJobId === job.id}
                  >
                    {selectedJobId === job.id ? '▲' : '▼'}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="job-progress-container" data-testid={`job-progress-${job.id}`}>
                  <div
                    className={`job-progress-bar ${isRunning ? 'indeterminate' : ''}`}
                    role="progressbar"
                    aria-valuenow={isRunning ? undefined : progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Job progress: ${job.stage ?? 'unknown'}`}
                    style={isRunning ? undefined : { width: `${progress}%` }}
                  />
                </div>

                {/* Stage description */}
                <div className="job-stage-description" data-testid={`job-stage-${job.id}`}>
                  {stageDescription(job.stage)}
                </div>

                {/* Timestamps */}
                <div className="job-timestamps" data-testid={`job-timestamps-${job.id}`}>
                  <span className="job-timestamp">
                    Created: {formatTime(job.createdAt)}
                  </span>
                  {job.startedAt && (
                    <span className="job-timestamp">
                      Started: {formatTime(job.startedAt)}
                    </span>
                  )}
                  {job.lastUpdate && (
                    <span className="job-timestamp">
                      Updated: {formatTime(job.lastUpdate)}
                    </span>
                  )}
                  {job.completedAt && (
                    <span className="job-timestamp">
                      Completed: {formatTime(job.completedAt)}
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {selectedJobId === job.id && (
                  <div className="job-details" data-testid={`job-details-${job.id}`}>
                    {job.errorMessage && (
                      <div className="drawer-note" data-testid={`job-error-${job.id}`}>
                        Error: {job.errorMessage}
                      </div>
                    )}
                    {failureMsg && (
                      <div
                        className={`failure-guidance failure-${job.failureCategory}`}
                        data-testid={`job-failure-guidance-${job.id}`}
                      >
                        <div className="failure-guidance-title">
                          {failureMsg.title}
                        </div>
                        <div className="failure-guidance-description">
                          {failureMsg.description}
                        </div>
                        <div className="failure-guidance-action">
                          {failureMsg.action}
                        </div>
                      </div>
                    )}
                    {job.partialOutput && (
                      <div
                        className="drawer-note"
                        data-testid={`job-partial-output-${job.id}`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        <strong>Partial output:</strong>{' '}
                        {job.partialOutput.length > 500
                          ? `${job.partialOutput.substring(0, 500)}...`
                          : job.partialOutput}
                      </div>
                    )}
                    {job.resultSummary && (
                      <div className="drawer-note" data-testid={`job-result-${job.id}`}>
                        Result: {job.resultSummary}
                      </div>
                    )}
                    {job.entityId && (
                      <div className="drawer-note" data-testid={`job-entity-detail-${job.id}`}>
                        Linked Entity: {job.entityId}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation overlay */}
      {cancelConfirmJobId !== null && (
        <div
          className="safe-quit-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel job confirmation"
          data-testid="job-cancel-confirm-overlay"
        >
          <div className="safe-quit-dialog">
            <h3>Cancel Job</h3>
            <p>
              Are you sure you want to cancel this job? Any in-progress
              work will be lost and cannot be recovered.
            </p>
            <div className="quit-actions">
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="job-cancel-dismiss-btn"
                onClick={dismissCancelConfirm}
              >
                No, keep it
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="job-cancel-confirm-btn"
                onClick={() => {
                  void confirmCancel();
                }}
              >
                Yes, cancel job
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
