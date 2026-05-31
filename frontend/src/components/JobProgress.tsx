"use client";

import type { JobQueueItem, JobStatus } from '../../../shared/types';
import { X, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface JobProgressProps {
  jobId: string;
  jobType: string;
  onComplete?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  mini?: boolean;
}

function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'queued': return 'var(--text-muted)';
    case 'running': return 'var(--info)';
    case 'verifying': return 'var(--info)';
    case 'retrying': return 'var(--warning)';
    case 'completed': return 'var(--success)';
    case 'failed': return 'var(--danger)';
    case 'cancelled': return 'var(--text-muted)';
  }
}

export function JobProgress({
  jobId,
  jobType,
  onComplete,
  onCancel,
  onRetry,
  mini,
}: JobProgressProps) {
  const [job, setJob] = useState<JobQueueItem | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setPollFailures(prev => prev + 1);
        return;
      }
      setPollFailures(0);
      const data = (await res.json()) as JobQueueItem;
      setJob(data);

      if (data.status === 'completed') {
        if (onComplete) {
          setTimeout(() => onComplete(), 500);
        }
        setTimeout(() => setDismissed(true), 3000);
      }
    } catch {
      setPollFailures(prev => prev + 1);
    }
  }, [jobId, onComplete]);

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
  if (!job) return null;

  const status = job.status || 'queued';
  const progress = job.progress ?? 0;
  const retryCount = job.retryCount ?? 0;
  const maxRetries = job.maxRetries ?? 3;
  const stage = job.stage || 'idle';
  const errorMessage = job.errorMessage;
  const isActive = status === 'queued' || status === 'running' || status === 'verifying' || status === 'retrying';
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
            style={{ transform: `scaleX(${progress / 100})`, backgroundColor: getStatusColor(status) }}
          />
        </div>
        {isActive && onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Cancel job">
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
            <span className="job-progress-retry-badge" aria-label={`Attempt ${retryCount + 1} of ${maxRetries}`}>
              Attempt {retryCount + 1} of {maxRetries}
            </span>
          )}
        </span>
      </div>

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
          style={progress > 0 ? { transform: `scaleX(${progress / 100})`, backgroundColor: getStatusColor(status) } : undefined}
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
            <RefreshCw size={14} style={{ marginRight: '4px' }} />
            Retry
          </button>
        )}
      </div>

      {isFailed && errorMessage && (
        <div className="job-progress-error" role="alert">
          {errorMessage}
        </div>
      )}

      {pollFailures >= 3 && isActive && (
        <div className="job-progress-connection-lost">
          Connection lost — retrying...
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPollFailures(0); void fetchJob(); }}>
            Retry now
          </button>
        </div>
      )}

      {status === 'completed' && (
        <div className="job-progress-success" role="status">✓ Completed</div>
      )}
    </div>
  );
}

