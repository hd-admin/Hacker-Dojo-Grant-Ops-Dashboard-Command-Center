/**
 * Submission Service
 *
 * Handles grant submission workflow:
 * - Approval locking (separate from submission)
 * - Submission recording (human-assisted external submission)
 * - Follow-up task generation
 */

import type {
  ApprovalRecord,
  SubmissionRecord,
  SubmissionMethod,
  FollowUp,
  Grant,
} from '../../../../shared/types';
import * as repository from './repository';

export interface ApprovalInput {
  grant: Grant;
  approvedBy: string;
  lockedUntil?: string;
}

export interface SubmissionInput {
  grant: Grant;
  method: SubmissionMethod;
  notes?: string;
  submittedBy: string;
}

export interface SubmissionResult {
  success: boolean;
  approvalRecord?: ApprovalRecord;
  submissionRecord?: SubmissionRecord;
  followUps?: FollowUp[];
  error?: string;
}

export interface ApprovalResult {
  success: boolean;
  approvalRecord?: ApprovalRecord;
  error?: string;
}

// Check if grant can be submitted (requires approval)
export async function canSubmit(grantId: string): Promise<{ canSubmit: boolean; reason?: string }> {
  const grant = await repository.getGrant(grantId);

  if (!grant) {
    return { canSubmit: false, reason: 'Grant not found' };
  }

  // Check if already submitted
  if (grant.status === 'submitted') {
    return { canSubmit: false, reason: 'Grant has already been submitted' };
  }

  // Check if awarded
  if (grant.status === 'awarded') {
    return { canSubmit: false, reason: 'Grant has already been awarded' };
  }

  // Check if there's an approval record
  const approval = await repository.getApprovalRecord(grantId);
  if (!approval) {
    return { canSubmit: false, reason: 'Grant must be approved before submission' };
  }

  // Check if approval is still valid
  if (approval.lockedUntil) {
    const lockedUntil = new Date(approval.lockedUntil);
    if (lockedUntil < new Date()) {
      return { canSubmit: false, reason: 'Approval has expired. Please re-approve.' };
    }
  }

  return { canSubmit: true };
}

// Approve and lock a grant draft
export async function approveGrant(input: ApprovalInput): Promise<ApprovalResult> {
  try {
    const { grant, approvedBy, lockedUntil } = input;

    // Get latest draft
    const drafts = await repository.getDraftArtifacts(grant.id);
    const latestVersion = drafts.length > 0
      ? Math.max(...drafts.map((d) => d.version))
      : 1;

    // Create approval record
    const approvalRecord: ApprovalRecord = {
      id: `approval-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      grantId: grant.id,
      draftVersion: latestVersion,
      approvedAt: new Date().toISOString(),
      approvedBy,
      lockedUntil: lockedUntil || '',
    };

    await repository.addApprovalRecord(approvalRecord);

    // Note: Grant status remains 'review' (or current board status) until actual submission.
    // Approval creates an ApprovalRecord which gates submission, but does not change
    // the board column. This matches the prototype pipeline which has no 'approved' column.

    return {
      success: true,
      approvalRecord,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Record a submission (human-assisted external submission)
export async function recordSubmission(input: SubmissionInput): Promise<SubmissionResult> {
  try {
    const { grant, method, notes, submittedBy } = input;

    // Check if can submit
    const canSubmitCheck = await canSubmit(grant.id);
    if (!canSubmitCheck.canSubmit) {
      return {
        success: false,
        error: canSubmitCheck.reason || 'Cannot submit',
      };
    }

    // Create submission record
    const submissionRecord: SubmissionRecord = {
      id: `submission-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      grantId: grant.id,
      submittedAt: new Date().toISOString(),
      method,
      notes: notes || '',
      followUpsCreated: [],
    };

    await repository.addSubmissionRecord(submissionRecord);

    // Update grant status to submitted
    await repository.updateGrant(grant.id, {
      status: 'submitted',
      statusLabel: 'Submitted',
    });

    // Generate follow-up tasks
    const followUps = await generateFollowUps(grant, submissionRecord, submittedBy);

    // Update submission record with follow-up IDs
    submissionRecord.followUpsCreated = followUps.map((f) => f.id);

    return {
      success: true,
      submissionRecord,
      followUps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function generateFollowUps(
  grant: Grant,
  submission: SubmissionRecord,
  _createdBy: string,
): Promise<FollowUp[]> {
  const followUps: FollowUp[] = [];

  // Follow-up: Check on status (30 days before deadline if applicable)
  if (grant.daysOut > 60) {
    const followUp: FollowUp = {
      id: `followup-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      grantId: grant.id,
      submissionId: submission.id,
      type: 'progress_check',
      title: `Follow up on ${grant.title}`,
      description: `Check status of application to ${grant.funder}. Confirmation: ${submission.method.confirmationId || 'N/A'}`,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await repository.addFollowUp(followUp);
    followUps.push(followUp);
  }

  // Follow-up: Report due (if grant is awarded)
  if (grant.deadline !== 'Rolling') {
    const dueDate = new Date(grant.deadline);
    const reportDueDate = new Date(dueDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days after deadline

    const reportFollowUp: FollowUp = {
      id: `followup-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      grantId: grant.id,
      submissionId: submission.id,
      type: 'report_due',
      title: `Progress report due for ${grant.title}`,
      description: `Submit progress report to ${grant.funder}`,
      dueDate: reportDueDate.toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await repository.addFollowUp(reportFollowUp);
    followUps.push(reportFollowUp);
  }

  return followUps;
}

export async function getApprovalRecord(grantId: string): Promise<ApprovalRecord | null> {
  return repository.getApprovalRecord(grantId);
}

export async function getSubmissionRecord(grantId: string): Promise<SubmissionRecord | null> {
  return repository.getSubmissionRecord(grantId);
}

export async function getFollowUps(): Promise<FollowUp[]> {
  return repository.getFollowUps();
}

export async function createFollowUp(followUp: FollowUp): Promise<FollowUp> {
  await repository.addFollowUp(followUp);
  return followUp;
}

export async function updateFollowUp(followUp: FollowUp): Promise<void> {
  await repository.updateFollowUp(followUp);
}
