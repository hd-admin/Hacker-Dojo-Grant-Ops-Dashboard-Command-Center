'use client';

import React from 'react';
import type { AuditEvent, GrantDetailResponse, GrantStatus } from '../../../../shared/types';
import styles from './OutcomeTracker.module.css';

interface OutcomeTrackerProps {
  detail: GrantDetailResponse;
  overrideField: 'fit' | 'category' | 'status' | null;
  setOverrideField: (field: 'fit' | 'category' | 'status' | null) => void;
  overrideValue: string;
  setOverrideValue: (value: string) => void;
  overrideRationale: string;
  setOverrideRationale: (rationale: string) => void;
  handleSubmitOverride: () => Promise<void>;
  auditEvents: AuditEvent[];
}

export function OutcomeTracker({
  detail,
  overrideField,
  setOverrideField,
  overrideValue,
  setOverrideValue,
  overrideRationale,
  setOverrideRationale,
  handleSubmitOverride,
  auditEvents,
}: OutcomeTrackerProps) {
  return (
    <>
      <div className="drawer-section">
        <h3>Human overrides</h3>
        <div className="drawer-actions">
          <button
            type="button"
            data-testid="override-fit-score-btn"
            onClick={() => {
              setOverrideField('fit');
              setOverrideValue(String(detail.grant.fit));
              setOverrideRationale('');
            }}
          >
            Override fit score
          </button>
          <button
            type="button"
            onClick={() => {
              setOverrideField('category');
              setOverrideValue(detail.grant.category ?? '');
              setOverrideRationale('');
            }}
          >
            Override category
          </button>
          <button
            type="button"
            onClick={() => {
              setOverrideField('status');
              setOverrideValue(detail.grant.status);
              setOverrideRationale('');
            }}
          >
            Override status
          </button>
        </div>
        {overrideField && (
          <div className="override-panel">
            <div className="drawer-note">Provide a rationale before saving.</div>
            {overrideField === 'fit' ? (
              <input
                type="number"
                min={0}
                max={100}
                className="form-input"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
            ) : overrideField === 'status' ? (
              <select value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)}>
                {(
                  [
                    'matched',
                    'draft',
                    'review',
                    'approved',
                    'submission-ready',
                    'submitted',
                    'follow-up',
                    'awarded',
                    'declined',
                    'closed',
                    'archived',
                  ] as GrantStatus[]
                ).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
            )}
            <textarea
              className="form-input"
              rows={3}
              placeholder="Rationale"
              value={overrideRationale}
              onChange={(e) => setOverrideRationale(e.target.value)}
            />
            <div className={styles.actionRowWithMargin}>
              <button type="button" onClick={() => void handleSubmitOverride()}>
                Save override
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverrideField(null);
                  setOverrideValue('');
                  setOverrideRationale('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="drawer-section">
        <h3>Audit Trail</h3>
        <div className="activity-list">
          {auditEvents.slice(0, 10).map((event) => (
            <div key={event.id} className="activity-item">
              <div>
                <div className="activity-text">
                  <strong>{event.eventType}</strong> · {event.actorLabel}
                </div>
                <div className="activity-time">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
