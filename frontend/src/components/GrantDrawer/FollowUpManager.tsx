'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FollowUp } from '../../../../shared/types';
import { formatDate } from './utilities';
import styles from './FollowUpManager.module.css';

interface FollowUpManagerProps {
  followUps: FollowUp[];
  followUpsLoading: boolean;
  showFollowUpForm: boolean;
  setShowFollowUpForm: (show: boolean) => void;
  newFollowUpType: FollowUp['type'];
  setNewFollowUpType: (type: FollowUp['type']) => void;
  newFollowUpTitle: string;
  setNewFollowUpTitle: (title: string) => void;
  newFollowUpDescription: string;
  setNewFollowUpDescription: (desc: string) => void;
  newFollowUpDueDate: string;
  setNewFollowUpDueDate: (date: string) => void;
  handleCreateFollowUp: () => Promise<void>;
  handleMarkComplete: (followUp: FollowUp) => Promise<void>;
  handleDeleteFollowUp: (id: string) => Promise<void>;
  showOutcomeForm: boolean;
  outcomeNotes: string;
  setOutcomeNotes: (notes: string) => void;
  handleSaveOutcome: () => Promise<void>;
  setShowOutcomeForm: (show: boolean) => void;
  detail: { grant: { statusLabel: string; id: string } } | null;
}

function isOverdue(followUp: FollowUp): boolean {
  if (!followUp.dueDate) return false;
  if (followUp.status === 'completed') return false;
  return new Date(followUp.dueDate) < new Date();
}

export function FollowUpManager({
  followUps,
  followUpsLoading,
  showFollowUpForm,
  setShowFollowUpForm,
  newFollowUpType,
  setNewFollowUpType,
  newFollowUpTitle,
  setNewFollowUpTitle,
  newFollowUpDescription,
  setNewFollowUpDescription,
  newFollowUpDueDate,
  setNewFollowUpDueDate,
  handleCreateFollowUp,
  handleMarkComplete,
  handleDeleteFollowUp,
  showOutcomeForm,
  outcomeNotes,
  setOutcomeNotes,
  handleSaveOutcome,
  setShowOutcomeForm,
  detail,
}: FollowUpManagerProps) {
  return (
    <div className="drawer-section" data-testid="grant-drawer-follow-ups">
      <div className={styles.followUpsHeader}>
        <h3 className={styles.followUpsTitle}>Follow-ups</h3>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowFollowUpForm(!showFollowUpForm)}
          data-testid="add-follow-up-btn"
          aria-label={showFollowUpForm ? 'Cancel new follow-up' : 'Add follow-up'}
        >
          {showFollowUpForm ? 'Cancel' : '+ Add follow-up'}
        </button>
      </div>

      {showFollowUpForm && (
        <div className={styles.followUpForm} data-testid="follow-up-create-form">
          <select
            className={`form-input ${styles.formField}`}
            value={newFollowUpType}
            onChange={(e) => setNewFollowUpType(e.target.value as FollowUp['type'])}
            aria-label="Follow-up type"
          >
            <option value="progress_check">Progress Check</option>
            <option value="report_due">Report Due</option>
            <option value="stipulation">Stipulation</option>
            <option value="next_steps">Next Steps</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            className={`form-input ${styles.formField}`}
            placeholder="Title"
            value={newFollowUpTitle}
            onChange={(e) => setNewFollowUpTitle(e.target.value)}
            aria-label="Follow-up title"
          />
          <textarea
            className={`form-input ${styles.formField}`}
            rows={2}
            placeholder="Description (optional)"
            value={newFollowUpDescription}
            onChange={(e) => setNewFollowUpDescription(e.target.value)}
            aria-label="Follow-up description"
          />
          <input
            type="date"
            className={`form-input ${styles.formField}`}
            value={newFollowUpDueDate}
            onChange={(e) => setNewFollowUpDueDate(e.target.value)}
            aria-label="Due date"
          />
          <div className={styles.actionRow}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCreateFollowUp}
              disabled={!newFollowUpTitle.trim()}
              data-testid="save-follow-up-btn"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {showOutcomeForm && detail && (
        <div className={styles.outcomeForm} data-testid="outcome-tracking-form">
          <div className={`drawer-note ${styles.outcomeLabel}`}>
            Grant is now <strong>{detail.grant.statusLabel}</strong>. Record outcome notes:
          </div>
          <textarea
            className={`form-input ${styles.formField}`}
            rows={3}
            placeholder="What happened? Capture lessons learned, next steps, or closure notes..."
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            aria-label="Outcome notes"
          />
          <div className={styles.actionRow}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveOutcome}
              disabled={!outcomeNotes.trim()}
              data-testid="save-outcome-btn"
            >
              Save outcome
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setShowOutcomeForm(false);
                setOutcomeNotes('');
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {followUpsLoading ? (
        <div className="drawer-note">Loading follow-ups...</div>
      ) : followUps.length === 0 ? (
        <div className="drawer-note">No follow-ups yet. Click "+ Add follow-up" to create one.</div>
      ) : (
        <div className="drawer-list">
          {[...followUps]
            .sort((a, b) => {
              const statusOrder: Record<string, number> = { overdue: 0, pending: 1, completed: 2 };
              const orderA = isOverdue(a) ? 0 : (statusOrder[a.status] ?? 1);
              const orderB = isOverdue(b) ? 0 : (statusOrder[b.status] ?? 1);
              if (orderA !== orderB) return orderA - orderB;
              if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
              return 0;
            })
            .map((followUp) => {
              const overdue = isOverdue(followUp);
              const statusColor =
                followUp.status === 'completed'
                  ? 'var(--success)'
                  : overdue
                    ? 'var(--danger)'
                    : 'var(--warning)';
              return (
                <div
                  key={followUp.id}
                  className="drawer-list-item"
                  data-testid={`follow-up-item-${followUp.id}`}
                  style={
                    overdue ? { borderColor: 'var(--danger)', borderWidth: '1.5px' } : undefined
                  }
                >
                  <div className={styles.followUpContent}>
                    <div className={styles.followUpHeader}>
                      <span
                        className={styles.followUpStatusBadge}
                        style={{
                          background: `${statusColor}22`,
                          color: statusColor,
                        }}
                      >
                        {overdue ? 'OVERDUE' : followUp.status}
                      </span>
                      <span className={styles.followUpTypeBadge}>
                        {followUp.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div
                      className={`drawer-list-title${overdue ? ` ${styles.overdueTitle}` : ''}`}
                    >
                      {overdue && (
                        <AlertTriangle
                          size={16}
                          aria-label="Warning"
                          className={styles.alertTriangle}
                        />
                      )}
                      {followUp.title}
                    </div>
                    {followUp.description && (
                      <div className={`drawer-note ${styles.followUpDescription}`}>
                        {followUp.description}
                      </div>
                    )}
                    <div className="drawer-note">
                      {followUp.dueDate && (
                        <span style={overdue ? { color: 'var(--danger)' } : undefined}>
                          Due {formatDate(followUp.dueDate.slice(0, 10))}
                        </span>
                      )}
                      {followUp.completedAt && (
                        <span className={styles.followUpCompletedBadge}>
                          {' '}
                          · Completed {new Date(followUp.completedAt).toLocaleString()}
                        </span>
                      )}
                      {!followUp.dueDate && !followUp.completedAt && <span>No due date</span>}
                    </div>
                  </div>
                  <div className={styles.followUpActions}>
                    {followUp.status !== 'completed' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleMarkComplete(followUp)}
                        data-testid={`mark-complete-btn-${followUp.id}`}
                        aria-label={`Mark "${followUp.title}" as complete`}
                        title="Mark complete"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn btn-sm btn-ghost ${styles.followUpDeleteBtn}`}
                      onClick={() => handleDeleteFollowUp(followUp.id)}
                      data-testid={`delete-follow-up-btn-${followUp.id}`}
                      aria-label={`Delete "${followUp.title}"`}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
