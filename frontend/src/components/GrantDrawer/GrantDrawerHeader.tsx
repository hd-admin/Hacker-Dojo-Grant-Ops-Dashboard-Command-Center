import type { JSX } from 'react';
'use client';

import React from 'react';
import type { GrantDetailResponse } from '../../../../shared/types';
import { formatDate } from './utilities';
import styles from './GrantDrawerHeader.module.css';

interface GrantDrawerHeaderProps {
  grant: GrantDetailResponse['grant'];
  onClose: () => void;
}

export function GrantDrawerHeader({ grant, onClose }: GrantDrawerHeaderProps): JSX.Element {
  return (
    <div className="drawer-header">
      <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="drawer-funder">{grant.funder}</div>
      <h2 className="drawer-title">{grant.title}</h2>
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
