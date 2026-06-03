'use client';

import type { JobQueueItem, JobStatus } from '../../../shared/types';
import { X, RefreshCw, FileText } from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './JobProgress.module.css';
import type { FetchFn } from '../hooks/useJobProgress';

interface JobProgressProps {
  jobId: string;
  jobType: string;
  onComplete?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  mini?: boolean;
  fetchFn?: FetchFn;
}

function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'queued':
      return 'var(--text-muted)';
    case 'running':
      return 'var(--info)';
    case 'verifying':
      return 'var(--info)';
    case 'retrying':
      return 'var(--warning)';
    case 'completed':
      return 'var(--success)';
    case 'failed':
      return 'var(--danger)';
    case 'cancelled':
      return 'var(--text-muted)';
  }
}

export function JobProgress({
  jobId,
  jobType,
  onComplete,
  onCancel,
  onRetry,
  mini,
  fetchFn = fetch,
}: JobProgressProps) {
  const [job, setJob] = useState<JobQueueItem | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetchFn(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setPollFailures((prev) => prev + 1);
        return;
      }
      setPollFailures(0);
      lastUpdateRef.current = Date.now();
      setShowSlowWarning(false);
      const data = (await res.json()) as JobQueueItem;
      setJob(data);

      if (data.status === 'completed') {
        if (onComplete) {
          setTimeout(() => onComplete(), 500);
        }
        setTimeout(() => setDismissed(true), 3000);
      }
    } catch {
      setPollFailures((prev) => prev + 1);
    }
  }, [jobId, onComplete, fetchFn]);

  useEffect(() => {
    void fetchJob();
    const interval = setInterval(() => {
      void fetchJob();
    }, 2000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchJob();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchJob]);

  if (dismissed) return null;

  const isRunning = job?.status === 'running';
  if (isRunning && !showSlowWarning && Date.now() - lastUpdateRef.current > 30000) {
    setShowSlowWarning(true);
  }

  if (!job) {
    if (pollFailures >= 3) {
      return (
        <div className="job-progress" data-testid="job-progress">
          <div className="job-progress-connection-lost">
            Connection lost — retrying...
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPollFailures(0);
                void fetchJob();
              }}
            >
              Retry now
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  const status = job.status || 'queued';
  const progress = job.progress ?? 0;
  const retryCount = job.retryCount ?? 0;
  const maxRetries = job.maxRetries ?? 3;
  const stage = job.stage || 'idle';
  const errorMessage = job.errorMessage;
  const isActive =
    status === 'queued' || status === 'running' || status === 'verifying' || status === 'retrying';
  const isFailed = status === 'failed';

  if (mini) {
    return (
      <div
        className="job-progress-mini"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${jobType} job: ${stage}`}
      >
        <span className="job-progress-mini-icon" aria-hidden="true">
          {status === 'completed' ? '✔' : status === 'failed' ? '✖' : '◉'}
        </span>
        <span className="job-progress-mini-type">{jobType}</span>
        <span className="job-progress-mini-stage">{stage}</span>
        <div className="job-progress-mini-bar">
          <div
            className="job-progress-mini-fill"
            style={{
              transform: `scaleX(${progress / 100})`,
              backgroundColor: getStatusColor(status),
            }}
          />
        </div>
        {isActive && onCancel && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            aria-label="Cancel job"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="job-progress" data-testid="job-progress">
      <div className="job-progress-header">
        <span className="job-progress-type">{jobType}</span>
        <span className="job-progress-stage">
          {stage.replace(/-/g, ' ')}
          {retryCount > 0 && (
            <span
              className="job-progress-retry-badge"
              aria-label={`Attempt ${retryCount + 1} of ${maxRetries}`}
            >
              Attempt {retryCount + 1} of {maxRetries}
            </span>
          )}
        </span>
      </div>

      {showSlowWarning && isActive && (
        <div className="job-progress-slow-warning" role="alert" aria-live="polite">
          The agent appears to be taking longer than expected. You can continue waiting or cancel.
        </div>
      )}

      <div
        className="job-progress-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${jobType} job progress: ${progress}%`}
      >
        <div
          className={`job-progress-fill ${progress === 0 ? 'indeterminate' : ''}`}
          style={
            progress > 0
              ? { transform: `scaleX(${progress / 100})`, backgroundColor: getStatusColor(status) }
              : undefined
          }
        />
      </div>

      <div className="job-progress-actions">
        {isActive && onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        {isFailed && onRetry && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
            <RefreshCw size={14} className={styles.refreshIcon} />
            Retry
          </button>
        )}
      </div>

      {isFailed && errorMessage && (
        <div className="job-progress-error" role="alert">
          {errorMessage}
        </div>
      )}

      {isFailed && (
        <div className="job-progress-log-link">
          <a
            href={`/api/logs/session/${jobId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            aria-label={`View session log for job ${jobId}`}
          >
            <FileText size={14} />
            View log
          </a>
        </div>
      )}

      {pollFailures >= 3 && isActive && (
        <div className="job-progress-connection-lost">
          Connection lost — retrying...
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPollFailures(0);
              void fetchJob();
            }}
          >
            Retry now
          </button>
        </div>
      )}

      {status === 'completed' && (
        <div className="job-progress-success" role="status">
          ✓ Completed
        </div>
      )}
    </div>
  );
}
