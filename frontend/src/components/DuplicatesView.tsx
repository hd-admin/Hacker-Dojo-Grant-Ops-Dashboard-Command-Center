'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DuplicateCandidate, Grant } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';

interface DuplicatesViewProps {
  onGrantSelect?: (grantId: string) => void;
  onRefreshAppState?: () => Promise<void> | void;
}

export default function DuplicatesView({ onGrantSelect, onRefreshAppState }: DuplicatesViewProps) {
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
        client.grants.getAll().catch(() => []) as Promise<Grant[]>,
      ]);
      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      setGrants(Array.isArray(grantsData) ? grantsData : []);
    } catch (err) {
      console.error('Error loading duplicates:', err);
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
          const body = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Failed to ${resolution === 'merged' ? 'merge' : 'separate'}`);
        }
        await loadData();
        await onRefreshAppState?.();
      } catch (err) {
        console.error(`Error resolving duplicate ${candidateId}:`, err);
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
            onClick={() => { void loadData(); }}
          >
            {'↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="panel" data-testid="duplicates-error-banner">
          <div className="drawer-note" style={{ color: 'var(--text-error)' }}>
            {error}
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="empty-state-guide" data-testid="duplicates-empty-state">
          <div className="empty-state-icon" aria-hidden="true">{'🔄'}</div>
          <div className="empty-state-title">No duplicate candidates</div>
          <div className="empty-state-description">
            Potential duplicate grants will appear here when the system detects
            similar grant records from different sources. You can review, merge,
            or keep them separate.
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
                  ? 'var(--color-error, #ef4444)'
                  : confidencePct >= 60
                    ? 'var(--color-warning, #f59e0b)'
                    : 'var(--color-info, #3b82f6)';

              return (
                <div
                  key={candidate.id}
                  className={`duplicate-card ${candidate.status}`}
                  data-testid={`duplicate-card-${candidate.id}`}
                  style={{
                    border: `1px solid ${isPending ? 'var(--border)' : 'var(--border-dim)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    marginBottom: '12px',
                    background: isPending ? 'var(--surface-1)' : 'var(--surface-2)',
                    opacity: isPending ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                        <button
                          type="button"
                          className="link-btn"
                          data-testid={`duplicate-grant-link-1-${candidate.id}`}
                          onClick={() => onGrantSelect?.(candidate.grantId1)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                        >
                          {getGrantTitle(candidate.grantId1)}
                        </button>
                        {' vs '}
                        <button
                          type="button"
                          className="link-btn"
                          data-testid={`duplicate-grant-link-2-${candidate.id}`}
                          onClick={() => onGrantSelect?.(candidate.grantId2)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                        >
                          {getGrantTitle(candidate.grantId2)}
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {getGrantFunder(candidate.grantId1) || 'Unknown funder'} · {getGrantFunder(candidate.grantId2) || 'Unknown funder'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="status-badge"
                        data-testid={`duplicate-status-${candidate.id}`}
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isPending ? 'rgba(224, 137, 74, 0.12)' : 'rgba(138, 171, 111, 0.12)',
                          color: isPending ? 'var(--warning)' : 'var(--success)',
                        }}
                      >
                        {candidate.status}
                      </span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duplicate confidence</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: confidenceColor }} data-testid={`confidence-pct-${candidate.id}`}>
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
                        style={{ width: `${confidencePct}%`, background: confidenceColor }}
                      />
                    </div>
                  </div>

                  {/* Conflicting fields */}
                  {candidate.conflictingFields.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Conflicting fields:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {candidate.conflictingFields.map((field) => (
                          <span
                            key={field}
                            data-testid={`conflicting-field-${candidate.id}-${field}`}
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '10px',
                              padding: '2px 8px',
                              background: 'rgba(123, 163, 184, 0.12)',
                              color: 'var(--info)',
                              borderRadius: '10px',
                              border: '1px solid rgba(123, 163, 184, 0.2)',
                            }}
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected at */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Detected: {new Date(candidate.detectedAt).toLocaleString()}
                    {candidate.resolvedAt && (
                      <span> · Resolved: {new Date(candidate.resolvedAt).toLocaleString()}</span>
                    )}
                    {candidate.resolvedBy && (
                      <span> · By: {candidate.resolvedBy}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        data-testid={`keep-separate-btn-${candidate.id}`}
                        disabled={actionLoading[candidate.id] === true}
                        onClick={() => void handleResolve(candidate.id, 'kept-separate')}
                      >
                        {actionLoading[candidate.id] === true ? '...' : 'Keep Separate'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        data-testid={`merge-btn-${candidate.id}`}
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
