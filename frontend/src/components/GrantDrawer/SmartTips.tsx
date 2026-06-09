'use client';

import React from 'react';
import type { GrantDetailResponse, SubmissionManifest } from '../../../../shared/types';
import { SubmissionReadiness } from '../SubmissionReadiness';
import { formatDate } from './utilities';
import styles from './SmartTips.module.css';
import type { GrantDrawerViewModel } from './utilities';
import type { DocumentMetadata } from '../../../../shared/types';

interface SmartTipsProps {
  detail: GrantDetailResponse;
  viewModel: GrantDrawerViewModel;
  manifest: SubmissionManifest | null;
  manifestLoading: boolean;
  handleGenerateDraft: () => Promise<void>;
  handleApproveAndLock: () => Promise<void>;
  handleRequestRevision: () => void;
  setShowSubmitForm: (show: boolean) => void;
  handleOpenInEditor: () => void;
  handleViewOnGrantsGov: () => void;
  handleCreateManifest: () => Promise<void>;
  submissionDocuments: DocumentMetadata[];
  handleSubmitComplete: (_data: {
    confirmationNumber: string;
    submittedAt: string;
  }) => Promise<void>;
  runbookExpanded: boolean;
  setRunbookExpanded: (expanded: boolean) => void;
  runbookConfirmationNumber: string;
  setRunbookConfirmationNumber: (num: string) => void;
  runbookCompleted: boolean;
  setRunbookCompleted: (completed: boolean) => void;
  handleSaveRunbook: () => Promise<void>;
  runbookSaving: boolean;
}

export function SmartTips({
  detail,
  viewModel,
  manifest,
  manifestLoading,
  handleGenerateDraft,
  handleApproveAndLock,
  handleRequestRevision,
  setShowSubmitForm,
  handleOpenInEditor,
  handleViewOnGrantsGov,
  handleCreateManifest,
  submissionDocuments,
  handleSubmitComplete,
  runbookExpanded,
  setRunbookExpanded,
  runbookConfirmationNumber,
  setRunbookConfirmationNumber,
  runbookCompleted,
  setRunbookCompleted,
  handleSaveRunbook,
  runbookSaving,
}: SmartTipsProps) {
  return (
    <>
      <div className="drawer-section">
        <h3>Funder summary (agent-generated)</h3>
        <p>{detail.grant.funderSummary}</p>
        <div className="drawer-note">
          Sources: {detail.grant.sourceCount ?? 0} · Grounded docs:{' '}
          {detail.grant.groundedDocumentCount ?? 0}
        </div>
      </div>

      <div className="drawer-section">
        <h3>Submission manifest</h3>
        {manifestLoading ? (
          <div className="drawer-note">Loading manifest...</div>
        ) : manifest ? (
          <>
            <div className="drawer-note">
              Version {manifest.version} · Updated {new Date(manifest.updatedAt).toLocaleString()}
            </div>
            <div className="drawer-list">
              <div className="drawer-list-item">
                <div className="drawer-list-title">Instructions</div>
                <div className="drawer-note">{manifest.instructions ?? 'Not set'}</div>
              </div>
              <div className="drawer-list-item">
                <div className="drawer-list-title">Portal URL</div>
                <div className="drawer-note">{manifest.portalUrl ?? 'Not set'}</div>
              </div>
              <div className="drawer-list-item">
                <div className="drawer-list-title">File constraints</div>
                <div className="drawer-note">{manifest.fileConstraints ?? 'Not set'}</div>
              </div>
              <div className="drawer-list-item">
                <div className="drawer-list-title">Due date</div>
                <div className="drawer-note">
                  {manifest.dueDate ? formatDate(manifest.dueDate) : 'Not set'}
                </div>
              </div>
              <div className="drawer-list-item">
                <div className="drawer-list-title">Materials</div>
                <div className="drawer-note">
                  {manifest.materialRefs.length > 0
                    ? `${manifest.materialRefs.length} item${manifest.materialRefs.length === 1 ? '' : 's'}`
                    : 'None yet'}
                </div>
              </div>
              {manifest.materialRefs.length > 0 && (
                <div className="drawer-list-item">
                  <div className="drawer-list-title">Material refs</div>
                  <div className="drawer-note">
                    {manifest.materialRefs
                      .map(
                        (item) =>
                          `${item.documentName}${item.version ? ` (${item.version})` : ''} · ${item.role}`,
                      )
                      .join(' | ')}
                  </div>
                </div>
              )}
              <div className="drawer-list-item">
                <div className="drawer-list-title">Notes</div>
                <div className="drawer-note">{manifest.notes ?? 'Not set'}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="drawer-note">No submission manifest yet.</div>
            <button type="button" className="btn btn-primary" onClick={handleCreateManifest}>
              Create manifest
            </button>
          </>
        )}
      </div>

      {(detail.grant.status === 'submission-ready' || detail.grant.status === 'submitted') && (
        <div className="drawer-section" data-testid="submission-runbook-section">
          <button
            type="button"
            className={`drawer-section-toggle ${styles.runbookToggleBtn}`}
            aria-expanded={runbookExpanded}
            aria-controls="submission-runbook-content"
            onClick={() => setRunbookExpanded(!runbookExpanded)}
            data-testid="runbook-toggle-btn"
          >
            <h3 className={styles.sectionHeaderWithMargin}>
              Submission Runbook
              {manifest?.runbookCompleted && (
                <span
                  className={styles.runbookCompletedBadge}
                  data-testid="runbook-completed-badge"
                >
                  ✓ Completed
                </span>
              )}
              <span className={styles.runbookExpandIcon}>{runbookExpanded ? '▲' : '▼'}</span>
            </h3>
          </button>
          {runbookExpanded && (
            <div id="submission-runbook-content" data-testid="runbook-content">
              {manifest?.submissionMethod && (
                <div className={styles.runbookSection}>
                  <span data-testid="runbook-method-badge" className={styles.runbookMethodBadge}>
                    {manifest.submissionMethod === 'portal' && '🌐 Portal'}
                    {manifest.submissionMethod === 'email' && '✉️ Email'}
                    {manifest.submissionMethod === 'mail' && '📮 Mail'}
                    {manifest.submissionMethod === 'other' && '❓ Other'}
                  </span>
                </div>
              )}

              <div className={styles.runbookSection}>
                <strong className={styles.runbookGuidanceTitle}>Step-by-step guidance:</strong>
                <ol className={styles.runbookSteps} data-testid="runbook-steps">
                  {(!manifest?.submissionMethod || manifest.submissionMethod === 'portal') && (
                    <>
                      <li>Log in at {manifest?.portalUrl || 'the submission portal'}</li>
                      <li>Navigate to the submissions section</li>
                      <li>
                        Upload required files
                        {manifest?.fileConstraints ? ` (${manifest.fileConstraints})` : ''}
                      </li>
                      <li>Review and confirm submission</li>
                      <li>Save the confirmation number below</li>
                    </>
                  )}
                  {manifest?.submissionMethod === 'email' && (
                    <>
                      <li>Compose email to the funder contact</li>
                      <li>
                        Attach required files
                        {manifest.fileConstraints ? ` (${manifest.fileConstraints})` : ''}
                      </li>
                      <li>Include confirmation request in the email body</li>
                      <li>Send and save the confirmation reply number below</li>
                    </>
                  )}
                  {manifest?.submissionMethod === 'mail' && (
                    <>
                      <li>Print all required documents</li>
                      <li>Package securely with tracking</li>
                      <li>Mail to the funder address</li>
                      <li>Record tracking number below</li>
                    </>
                  )}
                  {manifest?.submissionMethod === 'other' && (
                    <>
                      <li>Follow the funder&apos;s specific submission instructions</li>
                      <li>Record any confirmation details below</li>
                    </>
                  )}
                </ol>
              </div>

              <div className={styles.runbookSection}>
                <label htmlFor="runbook-confirmation-number" className={styles.runbookLabel}>
                  Confirmation number / tracking info:
                </label>
                <input
                  id="runbook-confirmation-number"
                  type="text"
                  className="form-input"
                  placeholder="Enter confirmation number"
                  value={runbookConfirmationNumber}
                  onChange={(e) => setRunbookConfirmationNumber(e.target.value)}
                  data-testid="runbook-confirmation-input"
                  aria-describedby="runbook-confirmation-help"
                />
              </div>

              <div className={styles.runbookSection}>
                <label className={styles.runbookCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={runbookCompleted}
                    onChange={(e) => setRunbookCompleted(e.target.checked)}
                    data-testid="runbook-completed-checkbox"
                  />
                  I have completed this step
                </label>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRunbook}
                disabled={runbookSaving}
                data-testid="runbook-save-btn"
              >
                {runbookSaving ? 'Saving...' : 'Save runbook progress'}
              </button>
            </div>
          )}
        </div>
      )}

      {detail.workflow.canSubmit && (
        <SubmissionReadiness
          grant={detail.grant}
          latestDraft={detail.latestDraft}
          approvalRecord={detail.approvalRecord}
          documents={submissionDocuments}
          manifest={manifest}
          onSubmitComplete={handleSubmitComplete}
        />
      )}

      <div className="drawer-section">
        <h3>Actions</h3>
        <div className="drawer-actions">
          {viewModel.showGenerateDraft && (
            <button
              type="button"
              className="btn btn-primary"
              title="Generate an AI-powered grant draft"
              aria-label="Generate draft"
              onClick={handleGenerateDraft}
            >
              Generate draft
            </button>
          )}
          {viewModel.showApprove && (
            <button
              type="button"
              className="btn btn-primary"
              title="Approve the draft and lock it from further edits"
              aria-label="Approve and lock"
              onClick={handleApproveAndLock}
            >
              Approve &amp; lock
            </button>
          )}
          {viewModel.showRequestRevision && (
            <button
              type="button"
              className="btn"
              title="Send the draft back for revision"
              aria-label="Request revision"
              onClick={handleRequestRevision}
            >
              Request revision
            </button>
          )}
          {viewModel.showSubmit && (
            <button
              type="button"
              className="btn"
              title="Submit the approved grant application"
              aria-label="Submit"
              onClick={() => setShowSubmitForm(true)}
            >
              Submit
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleOpenInEditor}>
            Open in editor
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleViewOnGrantsGov}>
            View source ↗
          </button>
        </div>
        {!detail.workflow.canSubmit && viewModel.submitDisabledReason && (
          <div className="drawer-note">Submission blocked: {viewModel.submitDisabledReason}</div>
        )}
      </div>
    </>
  );
}
