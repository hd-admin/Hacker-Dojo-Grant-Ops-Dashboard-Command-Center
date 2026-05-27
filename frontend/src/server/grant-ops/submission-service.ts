/**
 * Submission Service
 *
 * Handles grant submission workflow:
 * - Approval locking (separate from submission)
 * - Submission recording (human-assisted external submission)
 * - Follow-up task generation
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 */

import type {
  ApprovalRecord,
  SubmissionRecord,
  SubmissionMethod,
  FollowUp,
  Grant,
  Notification,
  Task,
} from '../../../../shared/types';
import { escapeForHtml } from '../../lib/sanitize-html';
import { getDependencies } from './dependencies';

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
  const deps = getDependencies();
  const grant = await deps.repository.getGrant(grantId);

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

  const existingSubmission = await deps.repository.getSubmissionRecord(grantId);
  if (existingSubmission) {
    return { canSubmit: false, reason: 'Grant has already been submitted' };
  }

  // Check if there's an approval record
  const approval = await deps.repository.getApprovalRecord(grantId);
  if (!approval) {
    return { canSubmit: false, reason: 'Grant must be approved before submission' };
  }

  const manifests = await deps.repository.getSubmissionManifests(grantId);
  if (manifests.length === 0) {
    return { canSubmit: false, reason: 'Submission manifest is required before submission' };
  }

  const blockedItems = (grant.checklist || []).filter((item) => item.required === true && item.done === false);
  if (blockedItems.length > 0) {
    return {
      canSubmit: false,
      reason: `Required checklist items incomplete: ${blockedItems.map((item) => item.label).join(', ')}`,
    };
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
    const deps = getDependencies();
    const idGenerator = deps.idGenerator;
    const clock = deps.clock;

    const { grant, approvedBy, lockedUntil } = input;

    const existingSubmission = await deps.repository.getSubmissionRecord(grant.id);
    if (existingSubmission || grant.status === 'submitted') {
      return {
        success: false,
        error: 'Grant has already been submitted',
      };
    }

    if (grant.status === 'awarded') {
      return {
        success: false,
        error: 'Grant has already been awarded',
      };
    }

    // Get latest draft
    const drafts = await deps.repository.getDraftArtifacts(grant.id);
    const latestVersion = drafts.length > 0
      ? Math.max(...drafts.map((d) => d.version))
      : 1;

    // Create approval record
    const approvalRecord: ApprovalRecord = {
      id: idGenerator.generateId('approval'),
      grantId: grant.id,
      draftVersion: latestVersion,
      approvedAt: clock.now().toISOString(),
      approvedBy,
      lockedUntil: lockedUntil || '',
    };

    await deps.repository.addApprovalRecord(approvalRecord);
    await deps.repository.updateGrant(grant.id, {
      status: 'approved',
      statusLabel: 'Approved',
    });
    await deps.repository.addAuditEvent({
      id: idGenerator.generateId('audit'),
      eventType: 'grant_approved',
      entityId: grant.id,
      entityType: 'grant',
      actorLabel: approvedBy,
      timestamp: clock.now().toISOString(),
      metadata: { approvedBy, draftVersion: latestVersion },
    });

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
    const deps = getDependencies();
    const clock = deps.clock;
    const idGenerator = deps.idGenerator;

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
      id: idGenerator.generateId('submission'),
      grantId: grant.id,
      submittedAt: clock.now().toISOString(),
      method,
      notes: notes || '',
      followUpsCreated: [],
    };

    await deps.repository.addSubmissionRecord(submissionRecord);

    // Update grant status to submitted
    await deps.repository.updateGrant(grant.id, {
      status: 'submitted',
      statusLabel: 'Submitted',
    });

    // Generate follow-up tasks
    const followUps = await generateFollowUps(grant, submissionRecord, submittedBy, deps);

    // Update submission record with follow-up IDs and persist the linkage
    submissionRecord.followUpsCreated = followUps.map((f) => f.id);
    await deps.repository.updateSubmissionRecord(submissionRecord);

    // Email submission: create notification and task for human follow-up
    if (method.type === 'email') {
      await createEmailSubmissionArtifacts(grant, submissionRecord, method.confirmationId, deps);
    }

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
  deps: ReturnType<typeof getDependencies>,
): Promise<FollowUp[]> {
  const followUps: FollowUp[] = [];
  const idGenerator = deps.idGenerator;
  const clock = deps.clock;

  // Follow-up: Check on status (30 days before deadline if applicable)
  if (grant.daysOut > 60) {
    const followUp: FollowUp = {
      id: idGenerator.generateId('followup'),
      grantId: grant.id,
      submissionId: submission.id,
      type: 'progress_check',
      title: `Follow up on ${grant.title}`,
      description: `Check status of application to ${grant.funder}. Confirmation: ${submission.method.confirmationId || 'N/A'}`,
      dueDate: new Date(clock.now().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      status: 'pending',
      createdAt: clock.now().toISOString(),
    };
    await deps.repository.addFollowUp(followUp);
    followUps.push(followUp);
  }

  // Follow-up: Report due (if grant is awarded)
  if (grant.deadline !== 'Rolling') {
    const dueDate = new Date(grant.deadline);
    const reportDueDate = new Date(dueDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days after deadline

    const reportFollowUp: FollowUp = {
      id: idGenerator.generateId('followup'),
      grantId: grant.id,
      submissionId: submission.id,
      type: 'report_due',
      title: `Progress report due for ${grant.title}`,
      description: `Submit progress report to ${grant.funder}`,
      dueDate: reportDueDate.toISOString(),
      status: 'pending',
      createdAt: clock.now().toISOString(),
    };
    await deps.repository.addFollowUp(reportFollowUp);
    followUps.push(reportFollowUp);
  }

  return followUps;
}

/**
 * Create notification and task artifacts for email submission.
 * This implements the 'notify human for any needed follow-ups, email, data, etc.' requirement.
 */
async function createEmailSubmissionArtifacts(
  grant: Grant,
  submission: SubmissionRecord,
  confirmationId: string | undefined,
  deps: ReturnType<typeof getDependencies>,
): Promise<void> {
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  // Get organization profile to access notifyEmail
  const profile = await deps.repository.getOrgProfile();
  const notifyEmail = profile?.agentBehavior?.notifyEmail;

  if (!notifyEmail) {
    // No email configured, skip notification creation
    return;
  }

  // Create notification for the submission
  const notification: Notification = {
    id: idGenerator.generateId('notification'),
    text: `Email submission sent to ${escapeForHtml(grant.funder)} for "${escapeForHtml(grant.title)}". Confirmation: ${escapeForHtml(confirmationId ?? 'N/A')}. Sent to: ${escapeForHtml(notifyEmail)}`,
    time: clock.now().toISOString(),
    dot: 'blue',
  };

  // Get existing notifications and add the new one
  const notifications = await deps.repository.getNotifications();
  notifications.unshift(notification); // Add to beginning
  await deps.repository.updateNotifications(notifications);

  // Create task for human follow-up
  const task: Task = {
    id: idGenerator.generateId('task'),
    text: `Follow up on email submission to ${grant.funder} - ${grant.title} (Confirmation: ${confirmationId || 'N/A'})`,
    completed: false,
  };

  // Get existing tasks and add the new one
  const tasks = await deps.repository.getTasks();
  tasks.push(task);
  await deps.repository.updateTasks(tasks);
}

export async function getApprovalRecord(grantId: string): Promise<ApprovalRecord | null> {
  const deps = getDependencies();
  return deps.repository.getApprovalRecord(grantId);
}

export async function getSubmissionRecord(grantId: string): Promise<SubmissionRecord | null> {
  const deps = getDependencies();
  return deps.repository.getSubmissionRecord(grantId);
}

export async function getFollowUps(): Promise<FollowUp[]> {
  const deps = getDependencies();
  return deps.repository.getFollowUps();
}

export async function createFollowUp(followUp: FollowUp): Promise<FollowUp> {
  const deps = getDependencies();
  await deps.repository.addFollowUp(followUp);
  return followUp;
}

export async function updateFollowUp(followUp: FollowUp): Promise<void> {
  const deps = getDependencies();
  await deps.repository.updateFollowUp(followUp);
}
