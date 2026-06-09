'use client';

import type { JSX } from 'react';

import React from 'react';
import type { GrantDetailResponse } from '../../../../shared/types';
import { formatRelativeTime } from '../../lib/relative-time';
import { formatDate } from './utilities';
import styles from './GrantDrawerHeader.module.css';

interface GrantDrawerHeaderProps {
  grant: GrantDetailResponse['grant'];
  onClose: () => void;
  onArchive?: (grantId: string) => void;
  onDelete?: (grantId: string) => void;
}

export function GrantDrawerHeader({
  grant,
  onClose,
  onArchive,
  onDelete,
}: GrantDrawerHeaderProps): JSX.Element {
  return (
    <div className="drawer-header">
      <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="drawer-funder">{grant.funder}</div>
      <h2 className="drawer-title">{grant.title}</h2>
      <div className="drawer-actions-row">
        {onArchive && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onArchive(grant.id)}
            aria-label="Archive grant"
            data-testid="grant-archive-btn"
          >
            Archive
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(grant.id)}
            aria-label="Delete grant"
            data-testid="grant-delete-btn"
          >
            Delete
          </button>
        )}
      </div>
      <div className="drawer-meta">
        <div className="meta-item">
          <div className="meta-label">Award</div>
          <div className="meta-value">{grant.award}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">LOI Due</div>
          <div className="meta-value">
            {grant.deadline === 'Rolling' ? 'Rolling' : formatDate(grant.deadline)}
            {grant.deadlineConfidence === 'estimated' && (
              <span
                data-testid="deadline-confidence-badge"
                className={styles.deadlineConfidenceBadgeEstimated}
              >
                (estimated)
              </span>
            )}
            {grant.deadlineConfidence === 'unknown' && (
              <span
                data-testid="deadline-confidence-badge"
                className={styles.deadlineConfidenceBadgeUnknown}
              >
                (date uncertain)
              </span>
            )}
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Fit Score</div>
          <div
            className={`meta-value ${grant.fit >= 85 ? styles.fitScoreHigh : grant.fit >= 70 ? styles.fitScoreMedium : styles.fitScoreLow}`}
          >
            {grant.fit}
            {grant.humanOverrides?.some((override) => override.field === 'fit') && (
              <span data-testid="fit-human-confirmed-badge" className="ai-badge">
                Human-confirmed
              </span>
            )}
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Status</div>
          <div className="meta-value">{grant.statusLabel}</div>
        </div>
        <div className="meta-item" data-testid="meta-item-last-seen">
          <div className="meta-label">Last seen</div>
          <div className="meta-value" data-testid="header-last-seen-text">
            {formatRelativeTime(grant.lastSeenAt)}
          </div>
        </div>
        <div className="meta-item" data-testid="meta-item-last-updated">
          <div className="meta-label">Updated</div>
          <div className="meta-value" data-testid="header-last-updated-text">
            {formatRelativeTime(grant.lastUpdatedAt)}
          </div>
        </div>
        {grant.category && (
          <div className="meta-item">
            <div className="meta-label">Category</div>
            <div className="meta-value">{grant.category}</div>
          </div>
        )}
      </div>
    </div>
  );
}
