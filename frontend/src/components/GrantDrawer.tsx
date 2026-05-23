'use client';

import React, { useState, useEffect } from 'react';
import { grantsApi, revisionsApi } from '../lib/grant-ops-client';
import type { Grant, SubmissionMethod } from '../../../shared/types';

interface GrantDrawerProps {
  grantId: string | null;
  onClose: () => void;
  onRefreshAppState?: () => Promise<void> | void;
}

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const year = parts[0] ?? '';
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}, ${year}`;
}

export default function GrantDrawer({ grantId, onClose, onRefreshAppState }: GrantDrawerProps) {
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitMethod, setSubmitMethod] = useState<SubmissionMethod['type']>('portal');
  const [confirmationId, setConfirmationId] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');

  useEffect(() => {
    async function loadGrant() {
      if (grantId) {
        setLoading(true);
        try {
          const data = await grantsApi.getById(grantId);
          setGrant(data);
        } catch (err) {
          console.error('Error loading grant:', err);
          setGrant(null);
        } finally {
          setLoading(false);
        }
      } else {
        setGrant(null);
      }
      setShowRevision(false);
      setRevisionNote('');
    }
    loadGrant();
  }, [grantId]);

  const handleApproveAndLock = async () => {
    if (!grant) return;
    try {
      const response = await fetch(`/api/grants/${grant.id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      });
      if (response.ok) {
        const updatedGrant = await grantsApi.getById(grant.id);
        if (updatedGrant) setGrant(updatedGrant);
        await onRefreshAppState?.();
      } else {
        const error = await response.json();
        console.error('Error approving grant:', error);
      }
    } catch (error) {
      console.error('Error approving grant:', error);
    }
  };

  const handleSubmit = async () => {
    if (!grant) return;
    try {
      const method: SubmissionMethod = {
        type: submitMethod,
        submittedBy: 'human',
      };
      if (submitMethod === 'portal' && portalUrl) {
        method.portalUrl = portalUrl;
      }
      if (confirmationId) {
        method.confirmationId = confirmationId;
      }
      const response = await fetch(`/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, notes: submitNotes }),
      });
      if (response.ok) {
        setShowSubmitForm(false);
        await onRefreshAppState?.();
        onClose();
      } else {
        const error = await response.json();
        console.error('Error submitting grant:', error);
      }
    } catch (error) {
      console.error('Error submitting grant:', error);
    }
  };

  const handleRequestRevision = () => {
    setShowRevision(true);
  };

  const handleConfirmRevision = async () => {
    if (!grant || !revisionNote.trim()) return;
    try {
      await revisionsApi.create(grant.id, revisionNote, 'human');
      const updatedGrant = await grantsApi.getById(grant.id);
      if (updatedGrant) setGrant(updatedGrant);
      await onRefreshAppState?.();
      setShowRevision(false);
      setRevisionNote('');
    } catch (error) {
      console.error('Error creating revision request:', error);
    }
  };

  const handleCancelRevision = () => {
    setShowRevision(false);
    setRevisionNote('');
  };

  const handleOpenInEditor = () => {
    if (grant?.externalUrl) {
      window.open(grant.externalUrl);
    } else {
      console.warn('No external URL for this grant');
    }
  };

  const handleViewOnGrantsGov = () => {
    if (grant) {
      window.open(`https://www.grants.gov/search?keyword=${encodeURIComponent(grant.title)}`);
    }
  };

  if (!grantId) {
    return null;
  }

  return (
    <>
      <button type="button" className="drawer-overlay open" onClick={onClose} aria-label="Close grant drawer" />
      <aside className="drawer open">
        {loading ? (
          <div className="drawer-header">
            <div className="drawer-funder">Loading...</div>
          </div>
        ) : grant ? (
          <>
            <div className="drawer-header">
              <button type="button" className="drawer-close" onClick={onClose}>
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
                  </div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Fit Score</div>
                  <div
                    className="meta-value"
                    style={{
                      color:
                        grant.fit >= 85
                          ? 'var(--success)'
                          : grant.fit >= 70
                            ? 'var(--accent)'
                            : 'var(--text)',
                    }}
                  >
                    {grant.fit}
                  </div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Status</div>
                  <div className="meta-value">{grant.statusLabel}</div>
                </div>
              </div>
            </div>

            <div className="drawer-body">
              {grant.fitBreakdown && (
                <div className="drawer-section">
                  <h3>Why it fits</h3>
                  <div className="fit-breakdown">
                    <div className="fit-row">
                      <div className="fit-row-label">Mission alignment</div>
                      <div className="fit-row-bar"><div style={{ width: `${grant.fitBreakdown.missionAlignment}%` }} /></div>
                      <div className="fit-row-val">{grant.fitBreakdown.missionAlignment}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Geographic focus</div>
                      <div className="fit-row-bar"><div style={{ width: `${grant.fitBreakdown.geographicFocus}%` }} /></div>
                      <div className="fit-row-val">{grant.fitBreakdown.geographicFocus}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Program track record</div>
                      <div className="fit-row-bar"><div style={{ width: `${grant.fitBreakdown.programTrackrecord}%` }} /></div>
                      <div className="fit-row-val">{grant.fitBreakdown.programTrackrecord}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Budget capacity</div>
                      <div className="fit-row-bar"><div style={{ width: `${grant.fitBreakdown.budgetCapacity}%` }} /></div>
                      <div className="fit-row-val">{grant.fitBreakdown.budgetCapacity}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Partnership readiness</div>
                      <div className="fit-row-bar"><div style={{ width: `${grant.fitBreakdown.partnershipReadiness}%` }} /></div>
                      <div className="fit-row-val">{grant.fitBreakdown.partnershipReadiness}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h3>Actions</h3>
                <div className="drawer-actions">
                  <button type="button" className="btn btn-primary" onClick={handleApproveAndLock}>
                    Approve &amp; lock
                  </button>
                  <button type="button" className="btn" onClick={handleRequestRevision}>
                    Request revision
                  </button>
                  <button type="button" className="btn" onClick={() => setShowSubmitForm(true)}>
                    Submit
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={handleOpenInEditor}>
                    Open in editor
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={handleViewOnGrantsGov}>
                    View on grants.gov
                  </button>
                </div>
              </div>

              {showRevision && (
                <div className="drawer-section">
                  <h3>Revision notes</h3>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button type="button" className="btn btn-primary" onClick={handleConfirmRevision}>
                      Save revision
                    </button>
                    <button type="button" className="btn" onClick={handleCancelRevision}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showSubmitForm && (
                <div className="drawer-section">
                  <h3>Submit grant</h3>
                  <select value={submitMethod} onChange={(e) => setSubmitMethod(e.target.value as SubmissionMethod['type'])}>
                    <option value="portal">Portal</option>
                    <option value="email">Email</option>
                    <option value="mail">Mail</option>
                    <option value="other">Other</option>
                  </select>
                  {submitMethod === 'portal' && (
                    <input
                      type="url"
                      className="form-input"
                      placeholder="Portal URL"
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                    />
                  )}
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Confirmation ID"
                    value={confirmationId}
                    onChange={(e) => setConfirmationId(e.target.value)}
                  />
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Submission notes"
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                      Submit
                    </button>
                    <button type="button" className="btn" onClick={() => setShowSubmitForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
