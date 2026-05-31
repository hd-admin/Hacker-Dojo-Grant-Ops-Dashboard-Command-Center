'use client';

import type { JobQueueItem } from '../../../shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseJobProgressResult {
  job: JobQueueItem | null;
  pollFailures: number;
  dismissed: boolean;
  isRetrying: boolean;
  fetchJob: () => Promise<void>;
  dismiss: () => void;
  retryNow: () => void;
}

export function useJobProgress(
  jobId: string,
  options?: {
    onComplete?: () => void;
    onCancel?: () => void;
    onRetry?: () => void;
    pollIntervalMs?: number;
    maxRetries?: number;
  },
): UseJobProgressResult {
  const { onComplete, onCancel, onRetry, pollIntervalMs = 2000 } = options ?? {};
  const [job, setJob] = useState<JobQueueItem | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setPollFailures((prev) => prev + 1);
        return;
      }
      setPollFailures(0);
      setIsRetrying(false);
      const data = (await res.json()) as JobQueueItem;
      setJob(data);

      if (data.status === 'completed') {
        if (onComplete) {
          setTimeout(() => onComplete(), 500);
        }
        setTimeout(() => setDismissed(true), 3000);
      }
      if (data.status === 'cancelled' && onCancel) {
        setTimeout(() => onCancel(), 500);
      }
      if (data.status === 'retrying' && onRetry) {
        setTimeout(() => onRetry(), 500);
      }
    } catch {
      setPollFailures((prev) => prev + 1);
    }
  }, [jobId, onComplete, onCancel, onRetry]);

  const retryNow = useCallback(() => {
    setIsRetrying(true);
    setPollFailures(0);
    void fetchJob();
  }, [fetchJob]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  useEffect(() => {
    void fetchJob();
    intervalRef.current = setInterval(() => {
      void fetchJob();
    }, pollIntervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchJob();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchJob, pollIntervalMs]);

  return {
    job,
    pollFailures,
    dismissed,
    isRetrying,
    fetchJob,
    dismiss,
    retryNow,
  };
}
