'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatDate } from './utilities';
import styles from './OutreachPanel.module.css';

export type OutreachMethod = 'email' | 'phone' | 'in-person' | 'meeting' | 'other';
export type OutreachOutcome =
  | ''
  | 'no-response'
  | 'positive'
  | 'negative'
  | 'follow-up-needed';

export interface OutreachRecord {
  id: string;
  grantId: string;
  funderId?: string;
  contactName: string;
  contactEmail: string;
  method: OutreachMethod;
  notes: string;
  outcome: OutreachOutcome;
  followUpDate: string;
  createdAt: string;
}

const OUTREACH_OVERDUE_DAYS = 14;

interface OutreachPanelProps {
  outreach: OutreachRecord[];
  outreachLoading: boolean;
  showOutreachForm: boolean;
  setShowOutreachForm: (show: boolean) => void;
  newContactName: string;
  setNewContactName: (v: string) => void;
  newContactEmail: string;
  setNewContactEmail: (v: string) => void;
  newMethod: OutreachMethod;
  setNewMethod: (v: OutreachMethod) => void;
  newNotes: string;
  setNewNotes: (v: string) => void;
  newOutcome: OutreachOutcome;
  setNewOutcome: (v: OutreachOutcome) => void;
  newFollowUpDate: string;
  setNewFollowUpDate: (v: string) => void;
  handleCreateOutreach: () => Promise<void>;
  handleDeleteOutreach: (id: string) => Promise<void>;
  now?: Date;
}

function isOutreachOverdue(record: OutreachRecord, now: Date): boolean {
  if (record.outcome === 'positive' || record.outcome === 'negative') return false;
  const created = new Date(record.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const ageMs = now.getTime() - created.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= OUTREACH_OVERDUE_DAYS;
}

function outcomeLabel(outcome: OutreachOutcome): string {
  switch (outcome) {
    case 'positive':
      return 'Confirmed';
    case 'negative':
      return 'Declined';
    case 'no-response':
      return 'Awaiting reply';
    case 'follow-up-needed':
      return 'Follow-up needed';
    case '':
    default:
      return 'Logged';
  }
}

function outcomeBadgeClass(outcome: OutreachOutcome): string {
  const confirmed = styles.outreachStatusConfirmed ?? '';
  const declined = styles.outreachStatusDeclined ?? '';
  const awaiting = styles.outreachStatusAwaiting ?? '';
  const neutral = styles.outreachStatusNeutral ?? '';
  switch (outcome) {
    case 'positive':
      return confirmed;
    case 'negative':
      return declined;
    case 'no-response':
    case 'follow-up-needed':
      return awaiting;
    case '':
    default:
      return neutral;
  }
}

export function OutreachPanel({
  outreach,
  outreachLoading,
  showOutreachForm,
  setShowOutreachForm,
  newContactName,
  setNewContactName,
  newContactEmail,
  setNewContactEmail,
  newMethod,
  setNewMethod,
  newNotes,
  setNewNotes,
  newOutcome,
  setNewOutcome,
  newFollowUpDate,
  setNewFollowUpDate,
  handleCreateOutreach,
  handleDeleteOutreach,
  now,
}: OutreachPanelProps) {
  const referenceNow = now ?? new Date();
  const formRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showOutreachForm) {
      firstFieldRef.current?.focus();
    }
  }, [showOutreachForm]);

  useEffect(() => {
    if (!showOutreachForm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOutreachForm(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOutreachForm, setShowOutreachForm]);

  return (
    <div className="drawer-section" data-testid="grant-drawer-outreach">
      <div className={styles.outreachHeader}>
        <h3 className={styles.outreachTitle}>Outreach</h3>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowOutreachForm(!showOutreachForm)}
          data-testid="add-outreach-btn"
          aria-label={showOutreachForm ? 'Cancel new outreach' : 'Log outreach'}
        >
          {showOutreachForm ? 'Cancel' : '+ Log outreach'}
        </button>
      </div>

      {showOutreachForm && (
        <div ref={formRef} className={styles.outreachForm} data-testid="outreach-create-form">
          <input
            ref={firstFieldRef}
            type="text"
            className={`form-input ${styles.formField}`}
            placeholder="Contact name"
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            aria-label="Contact name"
          />
          <input
            type="email"
            className={`form-input ${styles.formField}`}
            placeholder="Contact email (optional)"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
            aria-label="Contact email"
          />
          <select
            className={`form-input ${styles.formField}`}
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value as OutreachMethod)}
            aria-label="Contact method"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in-person">In-person</option>
            <option value="meeting">Meeting</option>
            <option value="other">Other</option>
          </select>
          <select
            className={`form-input ${styles.formField}`}
            value={newOutcome}
            onChange={(e) => setNewOutcome(e.target.value as OutreachOutcome)}
            aria-label="Response status"
          >
            <option value="">— Logged —</option>
            <option value="no-response">Awaiting reply</option>
            <option value="positive">Confirmed</option>
            <option value="negative">Declined</option>
            <option value="follow-up-needed">Follow-up needed</option>
          </select>
          <textarea
            className={`form-input ${styles.formField}`}
            rows={2}
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            aria-label="Outreach notes"
          />
          <input
            type="date"
            className={`form-input ${styles.formField}`}
            value={newFollowUpDate}
            onChange={(e) => setNewFollowUpDate(e.target.value)}
            aria-label="Follow-up date"
          />
          <div className={styles.actionRow}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCreateOutreach}
              disabled={!newContactName.trim()}
              data-testid="save-outreach-btn"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {outreachLoading ? (
        <div className="drawer-note">Loading outreach...</div>
      ) : outreach.length === 0 ? (
        <div className="drawer-note">No outreach logged yet. Click "+ Log outreach" to record one.</div>
      ) : (
        <div className={styles.outreachList} role="list" data-testid="outreach-list">
          {outreach.map((record) => {
            const overdue = isOutreachOverdue(record, referenceNow);
            return (
              <div
                key={record.id}
                role="listitem"
                className={`${styles.outreachItem}${overdue ? ` ${styles.outreachItemOverdue}` : ''}`}
                data-testid={`outreach-item-${record.id}`}
              >
                <div className={styles.outreachContent}>
                  <div className={styles.outreachMetaRow}>
                    <span
                      className={`${styles.outreachStatusBadge} ${outcomeBadgeClass(record.outcome)}`}
                    >
                      {outcomeLabel(record.outcome)}
                    </span>
                    <span className={styles.outreachMethodBadge}>
                      {record.method.replace(/-/g, ' ')}
                    </span>
                    {overdue && (
                      <span
                        data-testid={`outreach-overdue-badge-${record.id}`}
                        className={`${styles.outreachStatusBadge} ${styles.outreachStatusAwaiting}`}
                        aria-label="Overdue"
                      >
                        Overdue
                      </span>
                    )}
                  </div>
                  <div
                    className={`${styles.outreachTitleText}${overdue ? ` ${styles.outreachTitleOverdue}` : ''}`}
                  >
                    {overdue && (
                      <AlertTriangle
                        size={16}
                        aria-label="Warning"
                        className={styles.outreachTitleOverdue}
                      />
                    )}
                    {record.contactName}
                  </div>
                  {record.contactEmail && (
                    <div className={styles.outreachContact}>{record.contactEmail}</div>
                  )}
                  {record.notes && (
                    <div className={styles.outreachNotes}>{record.notes}</div>
                  )}
                  <div
                    className={`${styles.outreachDate}${overdue ? ` ${styles.outreachDateOverdue}` : ''}`}
                  >
                    Logged {formatDate(record.createdAt.slice(0, 10))}
                    {record.followUpDate && (
                      <> · Follow-up {formatDate(record.followUpDate.slice(0, 10))}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm btn-ghost ${styles.outreachDeleteBtn}`}
                  onClick={() => handleDeleteOutreach(record.id)}
                  data-testid={`delete-outreach-btn-${record.id}`}
                  aria-label={`Delete outreach to "${record.contactName}"`}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
