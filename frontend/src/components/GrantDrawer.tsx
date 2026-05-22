'use client';

import { useState, useEffect } from 'react';
import { mockGrants, isElectronAPIavailable } from '../lib/mockData';
import type { Grant } from '../../../shared/types';

interface GrantDrawerProps {
  grantId: string | null;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const year = parts[0] ?? '';
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}, ${year}`;
}

export default function GrantDrawer({ grantId, onClose }: GrantDrawerProps) {
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  useEffect(() => {
    if (grantId) {
      setLoading(true);
      if (isElectronAPIavailable()) {
        window.electronAPI
          .getGrantById(grantId)
          .then((data) => {
            setGrant(data);
            setLoading(false);
          })
          .catch((err) => {
            console.error('Error loading grant:', err);
            setLoading(false);
          });
      } else {
        // Use mock data for browser/E2E testing
        const mockGrant = mockGrants.find((g) => g.id === grantId) || null;
        setGrant(mockGrant);
        setLoading(false);
      }
    } else {
      setGrant(null);
    }
    // Reset revision state when drawer closes
    setShowRevision(false);
    setRevisionNote('');
  }, [grantId]);

  const handleApproveAndLock = async () => {
    if (!grant) return;
    try {
      await window.electronAPI.updateGrantStatus(grant.id, 'submitted');
      onClose();
    } catch (error) {
      console.error('Error updating grant status:', error);
    }
  };

  const handleRequestRevision = () => {
    setShowRevision(true);
  };

  const handleConfirmRevision = () => {
    console.warn('Revision note - backend not yet implemented:', revisionNote);
    setShowRevision(false);
    setRevisionNote('');
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

  const isOpen = !!grantId;

  return (
    <>
      {/* Overlay */}
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />

      {/* Drawer */}
      <aside className={`drawer ${isOpen ? 'open' : ''}`}>
        {loading ? (
          <div className="drawer-header">
            <div className="drawer-funder">Loading...</div>
          </div>
        ) : grant ? (
          <>
            <div className="drawer-header">
              <button className="drawer-close" onClick={onClose}>
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
              {/* Why it fits - Fit Breakdown */}
              {grant.fitBreakdown && (
                <div className="drawer-section">
                  <h3>Why it fits</h3>
                  <div className="fit-breakdown">
                    <div className="fit-row">
                      <div className="fit-row-label">Mission alignment</div>
                      <div className="fit-row-bar">
                        <div style={{ width: `${grant.fitBreakdown.missionAlignment}%` }} />
                      </div>
                      <div className="fit-row-val">{grant.fitBreakdown.missionAlignment}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Geographic focus</div>
                      <div className="fit-row-bar">
                        <div style={{ width: `${grant.fitBreakdown.geographicFocus}%` }} />
                      </div>
                      <div className="fit-row-val">{grant.fitBreakdown.geographicFocus}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Program track record</div>
                      <div className="fit-row-bar">
                        <div style={{ width: `${grant.fitBreakdown.programTrackrecord}%` }} />
                      </div>
                      <div className="fit-row-val">{grant.fitBreakdown.programTrackrecord}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Budget capacity</div>
                      <div className="fit-row-bar">
                        <div style={{ width: `${grant.fitBreakdown.budgetCapacity}%` }} />
                      </div>
                      <div className="fit-row-val">{grant.fitBreakdown.budgetCapacity}</div>
                    </div>
                    <div className="fit-row">
                      <div className="fit-row-label">Partnership readiness</div>
                      <div className="fit-row-bar">
                        <div style={{ width: `${grant.fitBreakdown.partnershipReadiness}%` }} />
                      </div>
                      <div className="fit-row-val">{grant.fitBreakdown.partnershipReadiness}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Funder Summary */}
              <div className="drawer-section">
                <h3>Funder summary</h3>
                <p>
                  {grant.draftContent
                    ? grant.draftContent.substring(0, 200) + '...'
                    : 'No summary available for this grant.'}
                </p>
              </div>

              {/* Requirements Checklist */}
              {grant.checklist && grant.checklist.length > 0 && (
                <div className="drawer-section">
                  <h3>Requirements checklist</h3>
                  <div className="checklist">
                    {grant.checklist.map((item, idx) => (
                      <div key={idx} className={`check-item ${item.done ? 'done' : ''}`}>
                        <div className="check-box" />
                        <div className="check-label">{item.label}</div>
                        <div className="check-source">{item.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Preview */}
              {grant.draftContent && (
                <div className="drawer-section">
                  <h3>Drafted Letter of Intent — preview</h3>
                  <div className="draft-preview">
                    {grant.draftContent.split('\n\n').map((para, idx) => {
                      if (para.startsWith('**') && para.endsWith('**')) {
                        return <h4 key={idx}>{para.replace(/\*\*/g, '')}</h4>;
                      }
                      return <p key={idx}>{para}</p>;
                    })}
                    <div className="draft-meta">
                      <span className="ai-badge">
                        Drafted by agent · grounded in 6 org documents · 12 funder sources
                      </span>
                      <span>{grant.draftContent.split(' ').length} words</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Revision Textarea */}
              <div className={`revision-area ${showRevision ? 'visible' : ''}`}>
                <textarea
                  placeholder="Describe the revisions needed..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                />
                <div className="revision-actions">
                  <button className="btn btn-sm btn-primary" onClick={handleConfirmRevision}>
                    Confirm
                  </button>
                  <button className="btn btn-sm" onClick={handleCancelRevision}>
                    Cancel
                  </button>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="drawer-footer">
                <button className="btn btn-primary" onClick={handleApproveAndLock}>
                  Approve &amp; lock draft
                </button>
                <button className="btn" onClick={handleRequestRevision}>
                  Request revision
                </button>
                <button className="btn btn-ghost" onClick={handleOpenInEditor}>
                  Open in editor
                </button>
                <button className="btn btn-ghost" onClick={handleViewOnGrantsGov}>
                  View on grants.gov →
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="drawer-header">
            <button className="drawer-close" onClick={onClose}>
              ×
            </button>
            <div className="drawer-funder">Grant not found</div>
          </div>
        )}
      </aside>
    </>
  );
}
