'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DuplicateCandidate, Grant } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';
import styles from './DuplicatesView.module.css';

interface DuplicatesViewProps {
  onGrantSelect?: (grantId: string) => void;
  onRefreshAppState?: () => Promise<void> | void;
}

export function DuplicatesView({ onGrantSelect, onRefreshAppState }: DuplicatesViewProps) {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [candidatesData, grantsData] = await Promise.all([
        client.duplicates.getAll().catch(() => []) as Promise<DuplicateCandidate[]>,
        client.grants
          .getAll()
          .then((d) => d.items)
          .catch(() => []) as Promise<Grant[]>,
      ]);
      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      setGrants(Array.isArray(grantsData) ? grantsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicate candidates');
      setCandidates([]);
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getGrantTitle = useCallback(
    (grantId: string): string => {
      const grant = grants.find((g) => g.id === grantId);
      return grant?.title ?? `Grant ${grantId.substring(0, 8)}...`;
    },
    [grants],
  );

  const getGrantFunder = useCallback(
    (grantId: string): string => {
      const grant = grants.find((g) => g.id === grantId);
      return grant?.funder ?? '';
    },
    [grants],
  );

  const handleResolve = useCallback(
    async (candidateId: string, resolution: 'merged' | 'kept-separate') => {
      setActionLoading((prev) => ({ ...prev, [candidateId]: true }));
      try {
        const response = await fetch(`/api/duplicates/${encodeURIComponent(candidateId)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: resolution === 'merged' ? 'merge' : 'keep-separate' }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            body.error ?? `Failed to ${resolution === 'merged' ? 'merge' : 'separate'}`,
          );
        }
        await loadData();
        await onRefreshAppState?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Resolution failed');
      } finally {
        setActionLoading((prev) => {
          const next = { ...prev };
          delete next[candidateId];
          return next;
        });
      }
    },
    [loadData, onRefreshAppState],
  );

  const pendingCount = useMemo(
    () => candidates.filter((c) => c.status === 'pending').length,
    [candidates],
  );

  const resolvedCount = useMemo(
    () => candidates.filter((c) => c.status !== 'pending').length,
    [candidates],
  );

  if (loading) {
    return (
      <div className="header-title" data-testid="duplicates-view-loading">
        Loading duplicate candidates...
      </div>
    );
  }

  return (
    <>
      <div className="header" data-testid="duplicates-view-header">
        <div>
          <h1 className="header-title">
            Duplicate <span className="accent">Review</span>
          </h1>
          <div className="header-sub">
            {pendingCount} pending{pendingCount !== 0 ? '' : ' — all clear!'}
            {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="duplicates-refresh-btn"
            onClick={() => {
              void loadData();
            }}
          >
            {'↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="panel" data-testid="duplicates-error-banner">
          <div className={`drawer-note ${styles.errorText}`}>{error}</div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="empty-state-guide" data-testid="duplicates-empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            {'🔄'}
          </div>
          <div className="empty-state-title">No duplicate candidates</div>
          <div className="empty-state-description">
            Potential duplicate grants will appear here when the system detects similar grant
            records from different sources. You can review, merge, or keep them separate.
          </div>
        </div>
      ) : (
        <div className="panel" data-testid="duplicates-list">
          {candidates
            .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
            .map((candidate) => {
              const isPending = candidate.status === 'pending';
              const confidencePct = Math.round(candidate.confidenceScore * 100);
              const confidenceColor =
                confidencePct >= 80
                  ? 'var(--danger)'
                  : confidencePct >= 60
                    ? 'var(--warning)'
                    : 'var(--info)';

              return (
                <div
                  key={candidate.id}
                  className={`duplicate-card ${candidate.status} ${styles.duplicateCard} ${isPending ? styles.pendingCard : styles.resolvedCard}`}
                  data-testid={`duplicate-card-${candidate.id}`}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.cardTitle}>
                        <button
                          type="button"
                          className={`link-btn ${styles.grantLinkBtn}`}
                          data-testid={`duplicate-grant-link-1-${candidate.id}`}
                          onClick={() => onGrantSelect?.(candidate.grantId1)}
                        >
                          {getGrantTitle(candidate.grantId1)}
                        </button>
                        {' vs '}
                        <button
                          type="button"
                          className={`link-btn ${styles.grantLinkBtn}`}
                          data-testid={`duplicate-grant-link-2-${candidate.id}`}
                          onClick={() => onGrantSelect?.(candidate.grantId2)}
                        >
                          {getGrantTitle(candidate.grantId2)}
                        </button>
                      </div>
                      <div className={styles.funderInfo}>
                        {getGrantFunder(candidate.grantId1) || 'Unknown funder'} ·{' '}
                        {getGrantFunder(candidate.grantId2) || 'Unknown funder'}
                      </div>
                    </div>
                    <div className={styles.statusBadgeGroup}>
                      <span
                        className={`status-badge ${styles.statusBadge} ${isPending ? styles.statusBadgePending : styles.statusBadgeResolved}`}
                        data-testid={`duplicate-status-${candidate.id}`}
                      >
                        {candidate.status}
                      </span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className={styles.confidenceSection}>
                    <div className={styles.confidenceHeader}>
                      <span className={styles.confidenceLabel}>Duplicate confidence</span>
                      <span
                        className={styles.confidencePct}
                        style={{ color: confidenceColor }}
                        data-testid={`confidence-pct-${candidate.id}`}
                      >
                        {confidencePct}%
                      </span>
                    </div>
                    <div
                      className="job-progress-container"
                      data-testid={`confidence-bar-${candidate.id}`}
                    >
                      <div
                        className="job-progress-bar"
                        role="progressbar"
                        aria-valuenow={confidencePct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Duplicate confidence: ${confidencePct}%`}
                        style={{
                          transform: `scaleX(${confidencePct / 100})`,
                          transformOrigin: 'left',
                          background: confidenceColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Conflicting fields */}
                  {candidate.conflictingFields.length > 0 && (
                    <div className={styles.conflictingSection}>
                      <div className={styles.conflictingLabel}>Conflicting fields:</div>
                      <div className={styles.conflictingFieldsWrap}>
                        {candidate.conflictingFields.map((field) => (
                          <span
                            key={field}
                            data-testid={`conflicting-field-${candidate.id}-${field}`}
                            className={styles.conflictingFieldTag}
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected at */}
                  <div className={styles.detectedInfo}>
                    Detected: {new Date(candidate.detectedAt).toLocaleString()}
                    {candidate.resolvedAt && (
                      <span> · Resolved: {new Date(candidate.resolvedAt).toLocaleString()}</span>
                    )}
                    {candidate.resolvedBy && <span> · By: {candidate.resolvedBy}</span>}
                  </div>

                  {/* Action buttons */}
                  {isPending && (
                    <div className={styles.actionButtons}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        data-testid={`keep-separate-btn-${candidate.id}`}
                        aria-label="Keep Separate"
                        disabled={actionLoading[candidate.id] === true}
                        onClick={() => void handleResolve(candidate.id, 'kept-separate')}
                      >
                        {actionLoading[candidate.id] === true ? '...' : 'Keep Separate'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        data-testid={`merge-btn-${candidate.id}`}
                        aria-label="Merge"
                        disabled={actionLoading[candidate.id] === true}
                        onClick={() => void handleResolve(candidate.id, 'merged')}
                      >
                        {actionLoading[candidate.id] === true ? '...' : 'Merge'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
