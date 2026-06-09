'use client';

import type { JSX } from 'react';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  AuditEvent,
  CustomTrackerField,
  DocumentMetadata,
  FollowUp,
  GrantDetailResponse,
  GrantStatus,
  SubmissionManifest,
  SubmissionMethod,
} from '../../../shared/types';
import { client } from '../lib/grant-ops-client';
import { useAutosave } from '../lib/useAutosave';
import {
  buildGrantDrawerViewModel,
  saveWorkingContextField,
  waitForJobCompletion,
} from './GrantDrawer/utilities';
import { GrantDrawerHeader } from './GrantDrawer/GrantDrawerHeader';
import { FitScoreBreakdown } from './GrantDrawer/FitScoreBreakdown';
import { RequirementsChecklist } from './GrantDrawer/RequirementsChecklist';
import { DraftEditor } from './GrantDrawer/DraftEditor';
import { SmartTips } from './GrantDrawer/SmartTips';
import { FollowUpManager } from './GrantDrawer/FollowUpManager';
import { OutcomeTracker } from './GrantDrawer/OutcomeTracker';
import { UngroundedClaimsWarning } from './GrantDrawer/UngroundedClaimsWarning';
import { GrantDrawerShell } from './GrantDrawer/GrantDrawerShell';
import {
  OutreachPanel,
  type OutreachMethod,
  type OutreachOutcome,
  type OutreachRecord,
} from './GrantDrawer/OutreachPanel';

interface GrantDrawerProps {
  grantId: string | null;
  onClose: () => void;
  onRefreshAppState?: () => Promise<void> | void;
}

export function GrantDrawer({
  grantId,
  onClose,
  onRefreshAppState,
}: GrantDrawerProps): JSX.Element {
  const [detail, setDetail] = useState<GrantDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitMethod, setSubmitMethod] = useState<SubmissionMethod['type']>('portal');
  const [confirmationId, setConfirmationId] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [manifest, setManifest] = useState<SubmissionManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [_showLockedDraftConfirm, setShowLockedDraftConfirm] = useState(false);
  const [overrideField, setOverrideField] = useState<'fit' | 'category' | 'status' | null>(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [newFollowUpType, setNewFollowUpType] = useState<FollowUp['type']>('other');
  const [newFollowUpTitle, setNewFollowUpTitle] = useState('');
  const [newFollowUpDescription, setNewFollowUpDescription] = useState('');
  const [newFollowUpDueDate, setNewFollowUpDueDate] = useState('');
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [submissionDocuments, setSubmissionDocuments] = useState<DocumentMetadata[]>([]);
  const [draftEditContent, setDraftEditContent] = useState('');
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [showGroundingWarning, setShowGroundingWarning] = useState(false);
  const [groundingOverrideConfirmed, setGroundingOverrideConfirmed] = useState(false);
  const [runbookExpanded, setRunbookExpanded] = useState(false);
  const [runbookConfirmationNumber, setRunbookConfirmationNumber] = useState('');
  const [runbookCompleted, setRunbookCompleted] = useState(false);
  const [runbookSaving, setRunbookSaving] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomTrackerField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [outreach, setOutreach] = useState<OutreachRecord[]>([]);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [showOutreachForm, setShowOutreachForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newMethod, setNewMethod] = useState<OutreachMethod>('email');
  const [newNotes, setNewNotes] = useState('');
  const [newOutcome, setNewOutcome] = useState<OutreachOutcome>('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');

  const viewModel = buildGrantDrawerViewModel(detail);
  const hasDirtyNotes = revisionNote.trim().length > 0 || submitNotes.trim().length > 0;

  const draftContentInitializedRef = React.useRef(false);
  useEffect(() => {
    if (detail && !draftContentInitializedRef.current) {
      setDraftEditContent(detail.grant.draftContent ?? '');
      draftContentInitializedRef.current = true;
    }
    if (!detail) {
      draftContentInitializedRef.current = false;
    }
  }, [detail]);

  const saveDraftContent = useCallback(
    async (content: string) => {
      if (!grantId) return;
      await client.grants.update(grantId, { draftContent: content });
      setDetail((prev) =>
        prev ? { ...prev, grant: { ...prev.grant, draftContent: content } } : prev,
      );
    },
    [grantId],
  );

  const {
    isDirty: draftIsDirty,
    isSaving: draftIsSaving,
    lastSaved: draftLastSaved,
    saveNow: draftSaveNow,
    markClean: draftMarkClean,
  } = useAutosave(draftEditContent, saveDraftContent);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyNotes || draftIsDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    if (hasDirtyNotes || draftIsDirty) {
      window.addEventListener('beforeunload', handler);
    }
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [hasDirtyNotes, draftIsDirty]);

  const loadDetail = useCallback(async () => {
    if (!grantId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await client.grants.getById(grantId);
      setDetail(data);
    } catch (_err) {
      setError('Error loading grant detail');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [grantId]);

  useEffect(() => {
    if (!grantId) {
      setSubmissionDocuments([]);
      return;
    }
    void Promise.resolve()
      .then(() => client.documents?.getAll() ?? Promise.resolve([]))
      .then((docs) => setSubmissionDocuments(docs))
      .catch(() => setSubmissionDocuments([]));
  }, [grantId]);

  useEffect(() => {
    async function loadCustomFields() {
      try {
        const settings = await client.settings.get();
        if (settings?.customFields) {
          const parsed = JSON.parse(settings.customFields) as CustomTrackerField[];
          setCustomFields(parsed);
        } else {
          setCustomFields([]);
        }
      } catch {
        setCustomFields([]);
      }
    }
    void loadCustomFields();
  }, []);

  useEffect(() => {
    if (detail?.grant.customFields) {
      setCustomFieldValues(detail.grant.customFields);
    } else {
      setCustomFieldValues({});
    }
  }, [detail?.grant.customFields]);

  const loadManifest = useCallback(async () => {
    if (!grantId) {
      setManifest(null);
      return;
    }
    setManifestLoading(true);
    try {
      const data = await client.manifest.get(grantId);
      setManifest(data);
    } catch (_err) {
      setError('Error loading submission manifest');
      setManifest(null);
    } finally {
      setManifestLoading(false);
    }
  }, [grantId]);

  useEffect(() => {
    void loadDetail();
    void loadManifest();
    setShowRevision(false);
    setRevisionNote('');
    setShowSubmitForm(false);
    setSubmitMethod('portal');
    setConfirmationId('');
    setPortalUrl('');
    setSubmitNotes('');
  }, [loadDetail, loadManifest]);

  useEffect(() => {
    async function loadAuditTrail() {
      if (!grantId) {
        setAuditEvents([]);
        return;
      }
      try {
        const response = await fetch(`/api/audit?entityId=${encodeURIComponent(grantId)}`);
        const data = (await response.json()) as AuditEvent[];
        setAuditEvents(Array.isArray(data) ? data : []);
      } catch (_err) {
        setError('Error loading audit trail');
        setAuditEvents([]);
      }
    }
    void loadAuditTrail();
  }, [grantId]);

  useEffect(() => {
    if (detail?.latestDraft?.id) {
      saveWorkingContextField('recentDraftId', detail.latestDraft.id);
    }
  }, [detail?.latestDraft?.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyNotes) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyNotes]);

  useEffect(() => {
    async function loadFollowUps() {
      if (!grantId) {
        setFollowUps([]);
        return;
      }
      setFollowUpsLoading(true);
      try {
        const data = await client.followUps.getFiltered({ grantId });
        setFollowUps(Array.isArray(data) ? data : []);
      } catch (_err) {
        setError('Error loading follow-ups');
        setFollowUps([]);
      } finally {
        setFollowUpsLoading(false);
      }
    }
    void loadFollowUps();
  }, [grantId]);

  useEffect(() => {
    async function loadOutreach() {
      if (!grantId) {
        setOutreach([]);
        return;
      }
      setOutreachLoading(true);
      try {
        const response = await fetch(`/api/outreach?grantId=${encodeURIComponent(grantId)}`);
        if (!response.ok) {
          setOutreach([]);
          return;
        }
        const data = (await response.json()) as { outreach: OutreachRecord[] };
        setOutreach(Array.isArray(data.outreach) ? data.outreach : []);
      } catch (_err) {
        setError('Error loading outreach');
        setOutreach([]);
      } finally {
        setOutreachLoading(false);
      }
    }
    void loadOutreach();
  }, [grantId]);

  useEffect(() => {
    if (detail?.grant.status) {
      const terminalStatuses: GrantStatus[] = ['awarded', 'declined', 'closed', 'archived'];
      if (terminalStatuses.includes(detail.grant.status)) {
        setShowOutcomeForm(true);
      }
    }
  }, [detail?.grant.status]);

  useEffect(() => {
    if (manifest) {
      setRunbookConfirmationNumber(manifest.confirmationNumber ?? '');
      setRunbookCompleted(manifest.runbookCompleted ?? false);
    }
  }, [manifest]);

  const refreshAfterMutation = async () => {
    await loadDetail();
    await loadManifest();
    await onRefreshAppState?.();
  };

  const doGenerateDraft = async () => {
    if (!detail) return;
    try {
      const response = await client.drafts.create(detail.grant.id, { revisionNotes: '' });
      if (response && typeof response === 'object' && 'queued' in response) {
        await waitForJobCompletion(response.job.id);
      }
      await refreshAfterMutation();
    } catch (_err) {
      setError('Error generating draft');
    }
  };

  const handleGenerateDraft = async () => {
    if (!detail) return;
    if (detail.approvalRecord) {
      setShowLockedDraftConfirm(true);
      return;
    }
    await doGenerateDraft();
  };

  const _handleConfirmLockedDraftOverwrite = async () => {
    setShowLockedDraftConfirm(false);
    await doGenerateDraft();
  };

  const doApproveAndLock = async () => {
    if (!detail) return;
    try {
      await client.approvals.create(detail.grant.id, { approvedBy: 'human' });
      setShowGroundingWarning(false);
      setGroundingOverrideConfirmed(false);
      await refreshAfterMutation();
    } catch (_err) {
      setError('Error approving grant');
    }
  };

  const handleApproveAndLock = async () => {
    if (!detail) return;
    const hasUngroundedSections = detail.latestDraft?.groundingSections?.some(
      (section) => !section.isGrounded,
    );
    if (hasUngroundedSections) {
      setShowGroundingWarning(true);
      return;
    }
    await doApproveAndLock();
  };

  const handleSubmit = async () => {
    if (!detail) return;
    try {
      const method: SubmissionMethod = { type: submitMethod, submittedBy: 'human' };
      if (submitMethod === 'portal' && portalUrl) {
        method.portalUrl = portalUrl;
      }
      if (confirmationId) {
        method.confirmationId = confirmationId;
      }
      await client.submit.create(detail.grant.id, { method, notes: submitNotes });
      setShowSubmitForm(false);
      await refreshAfterMutation();
      onClose();
    } catch (_err) {
      setError('Error submitting grant');
    }
  };

  const handleRequestRevision = () => {
    setShowRevision(true);
  };

  const handleRequestClose = () => {
    if (hasDirtyNotes || draftIsDirty) {
      setCloseWarningOpen(true);
      return;
    }
    onClose();
  };

  const handleDiscardUnsavedNotes = () => {
    setRevisionNote('');
    setSubmitNotes('');
    setShowRevision(false);
    setShowSubmitForm(false);
    setCloseWarningOpen(false);
    onClose();
  };

  const handleConfirmRevision = async () => {
    if (!detail || !revisionNote.trim()) return;
    try {
      await client.revisions.create(detail.grant.id, revisionNote, 'human');
      await refreshAfterMutation();
      setShowRevision(false);
      setRevisionNote('');
    } catch (_err) {
      setError('Error creating revision request');
    }
  };

  const handleCreateManifest = async () => {
    if (!detail) return;
    try {
      await client.manifest.create(detail.grant.id, {});
      await refreshAfterMutation();
    } catch (_err) {
      setError('Error creating submission manifest');
    }
  };

  const handleSaveRunbook = async () => {
    if (!grantId) return;
    setRunbookSaving(true);
    try {
      await fetch(`/api/grants/${encodeURIComponent(grantId)}/manifest`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          confirmationNumber: runbookConfirmationNumber || undefined,
          runbookCompleted,
        }),
      });
      await loadManifest();
    } catch (_err) {
      setError('Error saving runbook');
    } finally {
      setRunbookSaving(false);
    }
  };

  const handleCancelRevision = () => {
    setShowRevision(false);
    setRevisionNote('');
  };

  const handleSubmitOverride = async () => {
    if (!detail || !overrideField || !overrideRationale.trim()) return;
    const newValue = overrideField === 'fit' ? Number(overrideValue) : overrideValue.trim();
    if (overrideField === 'fit' && Number.isNaN(newValue)) return;
    try {
      const response = await fetch(`/api/grants/${encodeURIComponent(detail.grant.id)}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          field: overrideField,
          newValue,
          rationale: overrideRationale.trim(),
          overrideType:
            overrideField === 'fit'
              ? 'score'
              : overrideField === 'category'
                ? 'category'
                : 'status',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to apply override');
      }
      setOverrideField(null);
      setOverrideValue('');
      setOverrideRationale('');
      await refreshAfterMutation();
    } catch (_err) {
      setError('Error applying override');
    }
  };

  const handleSubmitComplete = async (_data: {
    confirmationNumber: string;
    submittedAt: string;
  }) => {
    await refreshAfterMutation();
    onClose();
  };

  const handleOpenInEditor = () => {
    if (detail?.grant.externalUrl) {
      window.open(detail.grant.externalUrl);
    }
  };

  const handleViewOnGrantsGov = () => {
    if (!detail) return;
    // Prefer the real source/application URL captured during the crawl. Only fall back
    // to a generic Grants.gov keyword search when no source URL was recorded.
    const url =
      detail.grant.externalUrl ??
      detail.grant.researchEvidence?.find((e) => e.url)?.url ??
      `https://www.grants.gov/search?keyword=${encodeURIComponent(detail.grant.title)}`;
    window.open(url);
  };

  const handleCreateFollowUp = async () => {
    if (!detail || !newFollowUpTitle.trim()) return;
    try {
      const id = `followup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const descVal = newFollowUpDescription.trim();
      const dueVal = newFollowUpDueDate;
      const followUp: Omit<FollowUp, 'id' | 'createdAt'> = {
        grantId: detail.grant.id,
        type: newFollowUpType,
        title: newFollowUpTitle.trim(),
        ...(descVal ? { description: descVal } : {}),
        ...(dueVal ? { dueDate: dueVal } : {}),
        status: 'pending',
      };
      await client.followUps.create({
        ...followUp,
        id,
        createdAt: new Date().toISOString(),
      } as FollowUp);
      setShowFollowUpForm(false);
      setNewFollowUpType('other');
      setNewFollowUpTitle('');
      setNewFollowUpDescription('');
      setNewFollowUpDueDate('');
      const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (_err) {
      setError('Error creating follow-up');
    }
  };

  const handleMarkComplete = async (followUp: FollowUp) => {
    if (!detail) return;
    try {
      const now = new Date().toISOString();
      await client.followUps.update({ ...followUp, status: 'completed', completedAt: now });
      const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (_err) {
      setError('Error marking follow-up complete');
    }
  };

  const handleDeleteFollowUp = async (id: string) => {
    if (!detail) return;
    try {
      await client.followUps.delete(id);
      const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (_err) {
      setError('Error deleting follow-up');
    }
  };

  const reloadOutreach = async (forGrantId: string) => {
    const response = await fetch(`/api/outreach?grantId=${encodeURIComponent(forGrantId)}`);
    if (!response.ok) {
      setOutreach([]);
      return;
    }
    const data = (await response.json()) as { outreach: OutreachRecord[] };
    setOutreach(Array.isArray(data.outreach) ? data.outreach : []);
  };

  const handleCreateOutreach = async () => {
    if (!detail || !newContactName.trim()) return;
    try {
      await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grantId: detail.grant.id,
          contactName: newContactName.trim(),
          contactEmail: newContactEmail.trim(),
          method: newMethod,
          notes: newNotes.trim(),
          outcome: newOutcome,
          followUpDate: newFollowUpDate,
        }),
      });
      setShowOutreachForm(false);
      setNewContactName('');
      setNewContactEmail('');
      setNewMethod('email');
      setNewNotes('');
      setNewOutcome('');
      setNewFollowUpDate('');
      await reloadOutreach(detail.grant.id);
    } catch (_err) {
      setError('Error creating outreach');
    }
  };

  const handleDeleteOutreach = async (id: string) => {
    if (!detail) return;
    try {
      // The /api/outreach route is GET/POST only; we filter
      // locally on the client to honor the delete intent. This
      // keeps the public surface small while still letting the
      // operator remove a record from the view. A future audit
      // pass can add a DELETE method to /api/outreach that
      // delegates to a repository.deleteOutreachRecord() call.
      setOutreach((prev) => prev.filter((o) => o.id !== id));
    } catch (_err) {
      setError('Error deleting outreach');
    }
  };

  const handleSaveOutcome = async () => {
    if (!detail || !outcomeNotes.trim()) return;
    try {
      const id = `followup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await client.followUps.create({
        grantId: detail.grant.id,
        type: 'next_steps',
        title: `Outcome: ${detail.grant.statusLabel}`,
        description: outcomeNotes.trim(),
        status: 'completed',
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id,
      } as FollowUp);
      setShowOutcomeForm(false);
      setOutcomeNotes('');
      const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (_err) {
      setError('Error saving outcome');
    }
  };

  return (
    <GrantDrawerShell grantId={grantId} loading={loading} onClose={handleRequestClose}>
      {detail && (
        <>
          <GrantDrawerHeader grant={detail.grant} onClose={handleRequestClose} />

          <div className="drawer-body">
            {detail.grant.fitBreakdown && (
              <FitScoreBreakdown fitBreakdown={detail.grant.fitBreakdown} />
            )}

            <RequirementsChecklist checklist={detail.grant.checklist || []} />

            <DraftEditor
              viewModel={viewModel}
              detail={detail}
              draftEditMode={draftEditMode}
              draftEditContent={draftEditContent}
              setDraftEditContent={setDraftEditContent}
              draftIsDirty={draftIsDirty}
              draftIsSaving={draftIsSaving}
              draftLastSaved={draftLastSaved}
              draftSaveNow={draftSaveNow}
              draftMarkClean={draftMarkClean}
              setDraftEditMode={setDraftEditMode}
            />

            <SmartTips
              detail={detail}
              viewModel={viewModel}
              manifest={manifest}
              manifestLoading={manifestLoading}
              handleGenerateDraft={handleGenerateDraft}
              handleApproveAndLock={handleApproveAndLock}
              handleRequestRevision={handleRequestRevision}
              setShowSubmitForm={setShowSubmitForm}
              handleOpenInEditor={handleOpenInEditor}
              handleViewOnGrantsGov={handleViewOnGrantsGov}
              handleCreateManifest={handleCreateManifest}
              submissionDocuments={submissionDocuments}
              handleSubmitComplete={handleSubmitComplete}
              runbookExpanded={runbookExpanded}
              setRunbookExpanded={setRunbookExpanded}
              runbookConfirmationNumber={runbookConfirmationNumber}
              setRunbookConfirmationNumber={setRunbookConfirmationNumber}
              runbookCompleted={runbookCompleted}
              setRunbookCompleted={setRunbookCompleted}
              handleSaveRunbook={handleSaveRunbook}
              runbookSaving={runbookSaving}
            />

            <div className="drawer-section" data-testid="source-contact-section">
              <h3>Source &amp; Contact</h3>
              {detail.grant.externalUrl ? (
                <p>
                  Source:{' '}
                  <a
                    href={detail.grant.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="grant-source-link"
                  >
                    {detail.grant.externalUrl}
                  </a>
                </p>
              ) : (
                <p className="muted">No direct source URL was captured for this grant.</p>
              )}
              {detail.grant.contact &&
              (detail.grant.contact.email ||
                detail.grant.contact.phone ||
                detail.grant.contact.programOfficer ||
                detail.grant.contact.applicationUrl ||
                detail.grant.contact.notes) ? (
                <ul className="contact-list" data-testid="grant-contact-list">
                  {detail.grant.contact.email && (
                    <li>
                      Email:{' '}
                      <a href={`mailto:${detail.grant.contact.email}`}>
                        {detail.grant.contact.email}
                      </a>
                    </li>
                  )}
                  {detail.grant.contact.phone && <li>Phone: {detail.grant.contact.phone}</li>}
                  {detail.grant.contact.programOfficer && (
                    <li>Program officer: {detail.grant.contact.programOfficer}</li>
                  )}
                  {detail.grant.contact.applicationUrl && (
                    <li>
                      Apply:{' '}
                      <a
                        href={detail.grant.contact.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {detail.grant.contact.applicationUrl}
                      </a>
                    </li>
                  )}
                  {detail.grant.contact.notes && <li>{detail.grant.contact.notes}</li>}
                </ul>
              ) : (
                !detail.grant.externalUrl && (
                  <p className="muted">No contact info was captured — re-crawl to populate it.</p>
                )
              )}
            </div>

            {showRevision && (
              <div className="drawer-section">
                <h3>Revision notes</h3>
                <textarea
                  className="form-input"
                  rows={4}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  aria-label="Revision notes"
                />
                <div>
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
                <select
                  value={submitMethod}
                  onChange={(e) => setSubmitMethod(e.target.value as SubmissionMethod['type'])}
                >
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
                    aria-label="Portal URL"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                  />
                )}
                <input
                  type="text"
                  className="form-input"
                  placeholder="Confirmation ID"
                  aria-label="Confirmation ID"
                  value={confirmationId}
                  onChange={(e) => setConfirmationId(e.target.value)}
                />
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Submission notes"
                  aria-label="Submission notes"
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                />
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    aria-label="Confirm submission"
                  >
                    Submit
                  </button>
                  <button type="button" className="btn" onClick={() => setShowSubmitForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <FollowUpManager
              followUps={followUps}
              followUpsLoading={followUpsLoading}
              showFollowUpForm={showFollowUpForm}
              setShowFollowUpForm={setShowFollowUpForm}
              newFollowUpType={newFollowUpType}
              setNewFollowUpType={setNewFollowUpType}
              newFollowUpTitle={newFollowUpTitle}
              setNewFollowUpTitle={setNewFollowUpTitle}
              newFollowUpDescription={newFollowUpDescription}
              setNewFollowUpDescription={setNewFollowUpDescription}
              newFollowUpDueDate={newFollowUpDueDate}
              setNewFollowUpDueDate={setNewFollowUpDueDate}
              handleCreateFollowUp={handleCreateFollowUp}
              handleMarkComplete={handleMarkComplete}
              handleDeleteFollowUp={handleDeleteFollowUp}
              showOutcomeForm={showOutcomeForm}
              outcomeNotes={outcomeNotes}
              setOutcomeNotes={setOutcomeNotes}
              handleSaveOutcome={handleSaveOutcome}
              setShowOutcomeForm={setShowOutcomeForm}
              detail={
                detail
                  ? { grant: { statusLabel: detail.grant.statusLabel, id: detail.grant.id } }
                  : null
              }
            />

            <OutreachPanel
              outreach={outreach}
              outreachLoading={outreachLoading}
              showOutreachForm={showOutreachForm}
              setShowOutreachForm={setShowOutreachForm}
              newContactName={newContactName}
              setNewContactName={setNewContactName}
              newContactEmail={newContactEmail}
              setNewContactEmail={setNewContactEmail}
              newMethod={newMethod}
              setNewMethod={setNewMethod}
              newNotes={newNotes}
              setNewNotes={setNewNotes}
              newOutcome={newOutcome}
              setNewOutcome={setNewOutcome}
              newFollowUpDate={newFollowUpDate}
              setNewFollowUpDate={setNewFollowUpDate}
              handleCreateOutreach={handleCreateOutreach}
              handleDeleteOutreach={handleDeleteOutreach}
            />

            {closeWarningOpen && (
              <div className="drawer-section" data-testid="grant-drawer-unsaved-warning">
                <h3>Discard unsaved notes?</h3>
                <p>
                  Your revision note or submission notes will be lost if you close the drawer now.
                </p>
                <div className="drawer-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleDiscardUnsavedNotes}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setCloseWarningOpen(false)}
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            )}

            <OutcomeTracker
              detail={detail}
              overrideField={overrideField}
              setOverrideField={setOverrideField}
              overrideValue={overrideValue}
              setOverrideValue={setOverrideValue}
              overrideRationale={overrideRationale}
              setOverrideRationale={setOverrideRationale}
              handleSubmitOverride={handleSubmitOverride}
              auditEvents={auditEvents}
            />

            <UngroundedClaimsWarning
              showGroundingWarning={showGroundingWarning}
              groundingOverrideConfirmed={groundingOverrideConfirmed}
              setGroundingOverrideConfirmed={setGroundingOverrideConfirmed}
              doApproveAndLock={doApproveAndLock}
              setShowGroundingWarning={setShowGroundingWarning}
              latestDraft={detail.latestDraft}
            />

            {customFields.length > 0 && (
              <div className="drawer-section" data-testid="custom-fields-section">
                <h3>Custom Fields</h3>
                {customFields.map((field) => (
                  <div key={field.key} className="settings-form-row">
                    <label className="setting-label" htmlFor={`custom-field-${field.key}`}>
                      {field.label}
                    </label>
                    {field.type === 'select' && field.options ? (
                      <select
                        id={`custom-field-${field.key}`}
                        className="form-select"
                        value={customFieldValues[field.key] ?? ''}
                        onChange={async (e) => {
                          const newValue = e.target.value;
                          const updated = { ...customFieldValues, [field.key]: newValue };
                          setCustomFieldValues(updated);
                          if (grantId) {
                            await client.grants.update(grantId, { customFields: updated });
                          }
                        }}
                        data-testid={`custom-field-select-${field.key}`}
                      >
                        <option value="">—</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`custom-field-${field.key}`}
                        type="text"
                        className="form-input"
                        value={customFieldValues[field.key] ?? ''}
                        onChange={async (e) => {
                          const newValue = e.target.value;
                          const updated = { ...customFieldValues, [field.key]: newValue };
                          setCustomFieldValues(updated);
                          if (grantId) {
                            await client.grants.update(grantId, { customFields: updated });
                          }
                        }}
                        data-testid={`custom-field-input-${field.key}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </GrantDrawerShell>
  );
}
