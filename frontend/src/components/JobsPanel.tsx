import type { JSX } from 'react';
('use client');

import React, { useCallback, useMemo, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { useJobsFeed } from '../hooks/useJobsFeed';
import {
  JOB_STATUS_FILTERS,
  JOB_TYPE_FILTERS,
  type JobStatusFilter,
  type JobTypeFilter,
  jobStatusLabel,
  jobTypeLabel,
} from '../lib/job-meta';
import { JobCard } from './JobCard';
import styles from './JobsPanel.module.css';

interface JobsPanelProps {
  onRefreshAppState?: () => Promise<void> | void;
}

export function JobsPanel({ onRefreshAppState }: JobsPanelProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<JobTypeFilter>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancelConfirmJobId, setCancelConfirmJobId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  // Errors from retry/cancel actions. The polling error comes read-only from
  // useJobsFeed, so action failures need their own local state.
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    jobs,
    isLoading: loading,
    error: feedError,
    refresh,
  } = useJobsFeed({
    pollIntervalMs: 5000,
    status: statusFilter,
    type: typeFilter,
  });

  const error = actionError ?? feedError;

  const setJobActionLoading = useCallback((jobId: string, isLoading: boolean) => {
    setActionLoading((prev) => {
      if (isLoading) return { ...prev, [jobId]: true };
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, []);

  const handleRetry = useCallback(
    async (jobId: string) => {
      setJobActionLoading(jobId, true);
      setActionError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Retry failed');
        }
        await refresh();
        if (onRefreshAppState) await onRefreshAppState();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Retry failed');
      } finally {
        setJobActionLoading(jobId, false);
      }
    },
    [refresh, onRefreshAppState, setJobActionLoading],
  );

  const handleCancelRequest = useCallback((jobId: string) => {
    setCancelConfirmJobId(jobId);
  }, []);

  const confirmCancel = useCallback(async () => {
    const jobId = cancelConfirmJobId;
    if (!jobId) return;
    setCancelConfirmJobId(null);
    setJobActionLoading(jobId, true);
    setActionError(null);
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
      await refresh();
      if (onRefreshAppState) await onRefreshAppState();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setJobActionLoading(jobId, false);
    }
  }, [cancelConfirmJobId, refresh, onRefreshAppState, setJobActionLoading]);

  const dismissCancelConfirm = useCallback(() => {
    setCancelConfirmJobId(null);
  }, []);

  const toggleDetails = useCallback((jobId: string) => {
    setSelectedJobId((current) => (current === jobId ? null : jobId));
  }, []);

  const handleRetryClick = useCallback(
    (jobId: string) => {
      void handleRetry(jobId);
    },
    [handleRetry],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const statusMatch = statusFilter === 'all' || job.status === statusFilter;
      const typeMatch = typeFilter === 'all' || job.jobType === typeFilter;
      return statusMatch && typeMatch;
    });
  }, [jobs, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const job of jobs) {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const job of jobs) {
      counts[job.jobType] = (counts[job.jobType] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const activeCount = (statusCounts.queued ?? 0) + (statusCounts.running ?? 0);

  if (loading) {
    return (
      <div
        className="spinner-overlay"
        data-testid="jobs-panel-loading"
        role="status"
        aria-busy="true"
        aria-label="Loading jobs"
      >
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="header" data-testid="jobs-panel-header" aria-label="Job Queue">
        <div>
          <h1 className="header-title">
            Job <span className="accent">Queue</span>
          </h1>
          <div className="header-sub">
            {jobs.length} total jobs
            {activeCount > 0 && (
              <span className={`nav-count ${styles.activeCountBadge}`}>{activeCount} active</span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="jobs-refresh-btn"
            onClick={() => {
              void refresh();
            }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="panel" data-testid="jobs-error-banner">
          <div className={`drawer-note ${styles.errorText}`}>{error}</div>
        </div>
      )}

      {/* Filters */}
      <div className="panel">
        <div
          className="filter-row"
          data-testid="jobs-status-filter"
          role="tablist"
          aria-label="Filter by job status"
        >
          {JOB_STATUS_FILTERS.map((status) => (
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
              {jobStatusLabel(status)}
              {(statusCounts[status] ?? 0) > 0 && (
                <span className={`nav-count ${styles.countBadge}`}>{statusCounts[status]}</span>
              )}
            </button>
          ))}
        </div>
        <div
          className={`filter-row ${styles.typeFilterRow}`}
          data-testid="jobs-type-filter"
          role="tablist"
          aria-label="Filter by job type"
        >
          {JOB_TYPE_FILTERS.map((type) => (
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
              {jobTypeLabel(type)}
              {(typeCounts[type] ?? 0) > 0 && (
                <span className={`nav-count ${styles.countBadge}`}>{typeCounts[type]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ARIA live region for job state announcements */}
      <div role="status" aria-live="polite" className="sr-only" data-testid="jobs-aria-live">
        {activeCount > 0
          ? `${activeCount} job${activeCount !== 1 ? 's' : ''} active`
          : 'No active jobs'}
      </div>

      {/* Job list */}
      {filteredJobs.length === 0 ? (
        <div className="empty-state-guide" data-testid="jobs-empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <ClipboardList size={40} strokeWidth={1.5} />
          </div>
          <div className="empty-state-title">No jobs found</div>
          <div className="empty-state-description">
            Jobs appear here when the system processes research or generates drafts.
          </div>
        </div>
      ) : (
        <div className="panel job-list" data-testid="jobs-list">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              expanded={selectedJobId === job.id}
              actionPending={actionLoading[job.id] === true}
              onToggle={toggleDetails}
              onCancelRequest={handleCancelRequest}
              onRetry={handleRetryClick}
            />
          ))}
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
              Are you sure you want to cancel this job? Any in-progress work will be lost and cannot
              be recovered.
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
