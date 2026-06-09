'use client';

import type { JSX } from 'react';

import React from 'react';
import { ChevronDown, ChevronUp, RotateCw, X } from 'lucide-react';
import type { JobQueueItem } from '../../../shared/types';
import { jobFailureMessages } from '../lib/failure-messages';
import {
  formatRelativeTime,
  getProgress,
  jobStatusIcon,
  jobStatusSpins,
  jobTypeLabel,
  stageDescription,
} from '../lib/job-meta';
import styles from './JobsPanel.module.css';

interface JobCardProps {
  job: JobQueueItem;
  expanded: boolean;
  actionPending: boolean;
  onToggle: (jobId: string) => void;
  onCancelRequest: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

export function JobCard({
  job,
  expanded,
  actionPending,
  onToggle,
  onCancelRequest,
  onRetry,
}: JobCardProps): JSX.Element {
  const progress = getProgress(job.stage);
  const isRunning = job.status === 'running';
  const StatusIcon = jobStatusIcon(job.status);
  const failureMsg =
    job.failureCategory && job.status === 'failed' ? jobFailureMessages[job.failureCategory] : null;

  return (
    <div
      className={`job-card ${job.status} ${expanded ? 'expanded' : ''}`}
      data-testid={`job-item-${job.status}-${job.id}`}
    >
      <div className="job-card-header">
        <span className="job-status-icon" aria-hidden="true">
          <StatusIcon
            size={15}
            className={jobStatusSpins(job.status) ? 'job-status-spin' : undefined}
          />
        </span>
        <span className={`job-badge job-badge-type job-badge-${job.jobType}`}>
          {jobTypeLabel(job.jobType)}
        </span>
        <span className={`job-badge job-badge-status job-badge-${job.status}`}>{job.status}</span>
        {job.entityId && (
          <button
            type="button"
            className="job-entity-link"
            data-testid={`job-entity-link-${job.id}`}
            title={`Linked entity: ${job.entityId}`}
          >
            {job.entityId.length > 12 ? `${job.entityId.substring(0, 12)}...` : job.entityId}
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
              disabled={actionPending}
              onClick={(e) => {
                e.stopPropagation();
                onCancelRequest(job.id);
              }}
              title="Cancel this job"
            >
              {actionPending ? (
                '...'
              ) : (
                <>
                  <X size={13} aria-hidden="true" /> Cancel
                </>
              )}
            </button>
          )}
          {job.status === 'failed' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm job-action-btn job-action-retry"
              data-testid={`job-retry-btn-${job.id}`}
              disabled={actionPending}
              onClick={(e) => {
                e.stopPropagation();
                onRetry(job.id);
              }}
              title="Retry this job"
            >
              {actionPending ? (
                '...'
              ) : (
                <>
                  <RotateCw size={13} aria-hidden="true" /> Retry
                </>
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm job-toggle-btn"
          data-testid={`job-toggle-details-${job.id}`}
          onClick={() => onToggle(job.id)}
          aria-expanded={expanded}
          aria-label={`Toggle details for ${job.jobType} job ${job.id}`}
        >
          {expanded ? (
            <ChevronUp size={15} aria-hidden="true" />
          ) : (
            <ChevronDown size={15} aria-hidden="true" />
          )}
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
        <span className="job-timestamp">Created: {formatRelativeTime(job.createdAt)}</span>
        {job.startedAt && (
          <span className="job-timestamp">Started: {formatRelativeTime(job.startedAt)}</span>
        )}
        {job.lastUpdate && (
          <span className="job-timestamp">Updated: {formatRelativeTime(job.lastUpdate)}</span>
        )}
        {job.completedAt && (
          <span className="job-timestamp">Completed: {formatRelativeTime(job.completedAt)}</span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
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
              <div className="failure-guidance-title">{failureMsg.title}</div>
              <div className="failure-guidance-description">{failureMsg.description}</div>
              <div className="failure-guidance-action">{failureMsg.action}</div>
            </div>
          )}
          {job.partialOutput && (
            <div
              className={`drawer-note ${styles.partialOutput}`}
              data-testid={`job-partial-output-${job.id}`}
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
}
