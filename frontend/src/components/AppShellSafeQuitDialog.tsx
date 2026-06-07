'use client';

import type { JSX } from 'react';
import React, { useEffect } from 'react';
import type { JobQueueItem } from '../../../shared/types';

export interface AppShellSafeQuitDialogProps {
  open: boolean;
  activeJobs: JobQueueItem[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function AppShellSafeQuitDialog({
  open,
  activeJobs,
  onCancel,
  onConfirm,
}: AppShellSafeQuitDialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="safe-quit-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Safe quit confirmation"
    >
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
                <span>
                  {job.jobType} #{job.id.slice(0, 8)}
                </span>
                <span>{job.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="quit-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Quit anyway
          </button>
        </div>
      </div>
    </div>
  );
}
