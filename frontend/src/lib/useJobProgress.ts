/**
 * useJobProgress hook
 *
 * Polls /api/jobs/{jobId} every 2s while running.
 * Handles 500 errors gracefully, detects backgrounded tabs,
 * and triggers callbacks on completion/failure.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { JobQueueItem } from '../../../shared/types';

interface UseJobProgressOptions {
  jobId: string | null;
  onComplete?: () => void;
  onFail?: (error: string) => void;
  pollIntervalMs?: number;
}

interface UseJobProgressResult {
  job: JobQueueItem | null;
  isLoading: boolean;
  pollFailures: number;
  refetch: () => void;
}

export function useJobProgress({
  jobId,
  onComplete,
  onFail,
  pollIntervalMs = 2000,
}: UseJobProgressOptions): UseJobProgressResult {
  const [job, setJob] = useState<JobQueueItem | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const completedRef = useRef(false);

  const fetchJobStatus = useCallback(async () => {
    if (!jobId || completedRef.current) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setPollFailures(prev => prev + 1);
        return;
      }
      setPollFailures(0);
      const data = (await res.json()) as JobQueueItem;
      setJob(data);

      if (data.status === 'completed' && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      if (data.status === 'failed' && !completedRef.current) {
        completedRef.current = true;
        onFail?.(data.errorMessage || 'Job failed');
      }
    } catch {
      setPollFailures(prev => prev + 1);
    }
  }, [jobId, onComplete, onFail]);

  useEffect(() => {
    completedRef.current = false;
    void fetchJobStatus();

    const interval = setInterval(() => {
      void fetchJobStatus();
    }, pollIntervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchJobStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchJobStatus, pollIntervalMs]);

  return {
    job,
    isLoading: !job,
    pollFailures,
    refetch: () => { setPollFailures(0); void fetchJobStatus(); },
  };
}
