import type { GrantStatus, Grant } from './types';

export const PIPELINE_TRANSITIONS: Record<GrantStatus, GrantStatus[]> = {
  matched: ['draft', 'closed', 'archived'],
  draft: ['review', 'closed'],
  review: ['approved', 'draft', 'closed'],
  approved: ['submission-ready', 'closed'],
  'submission-ready': ['submitted', 'closed'],
  submitted: ['follow-up', 'awarded', 'declined'],
  'follow-up': ['awarded', 'declined', 'submitted'],
  awarded: ['closed'],
  declined: ['closed', 'archived'],
  closed: ['archived'],
  archived: [],
};

export function validateTransition(
  fromStatus: GrantStatus,
  toStatus: GrantStatus,
): { valid: boolean; reason?: string } {
  const allowed = PIPELINE_TRANSITIONS[fromStatus];
  if (!allowed) {
    return { valid: false, reason: `Unknown source status: ${fromStatus}` };
  }
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      reason: `Invalid transition from '${fromStatus}' to '${toStatus}'. Allowed targets: ${allowed.join(', ')}`,
    };
  }
  return { valid: true };
}

export interface SubmissionReadinessResult {
  ready: boolean;
  blockingReasons: string[];
  checklistComplete: boolean;
  hasDraft: boolean;
  hasApproval: boolean;
  requiredDocuments: boolean;
}

export function checkSubmissionReadiness(
  grant: Grant,
  profileReady?: boolean,
): SubmissionReadinessResult {
  const blockingReasons: string[] = [];

  if (!grant.draftContent || grant.draftContent.length === 0) {
    blockingReasons.push('No draft content available');
  }

  if (grant.status !== 'approved' && grant.status !== 'submission-ready') {
    blockingReasons.push('Grant must be approved before submission');
  }

  const checklist = grant.checklist ?? [];
  const requiredItems = checklist.filter((item: { required?: boolean }) => item.required !== false);
  const incompleteRequired = requiredItems.filter((item: { done: boolean }) => !item.done);

  if (incompleteRequired.length > 0) {
    blockingReasons.push(
      `${incompleteRequired.length} required checklist item(s) not completed: ${incompleteRequired.map((i: { label: string }) => i.label).join(', ')}`,
    );
  }

  const blockingItems = checklist.filter(
    (item: { blockSubmission?: boolean; done: boolean }) =>
      item.blockSubmission === true && !item.done,
  );
  if (blockingItems.length > 0) {
    blockingReasons.push(
      `${blockingItems.length} submission-blocking checklist item(s) not completed: ${blockingItems.map((i: { label: string }) => i.label).join(', ')}`,
    );
  }

  if (profileReady === false) {
    blockingReasons.push(
      'Organization profile is incomplete. Complete required profile fields before submission.',
    );
  }

  const checklistComplete =
    (requiredItems.length === 0 || incompleteRequired.length === 0) && blockingItems.length === 0;

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    checklistComplete,
    hasDraft: Boolean(grant.draftContent),
    hasApproval: grant.status === 'approved' || grant.status === 'submission-ready',
    requiredDocuments: checklistComplete,
  };
}

export const STATUS_LABELS: Record<GrantStatus, string> = {
  matched: 'New Match',
  draft: 'Drafting',
  review: 'In Review',
  approved: 'Approved',
  'submission-ready': 'Ready to Submit',
  submitted: 'Submitted',
  'follow-up': 'Follow-up',
  awarded: 'Awarded',
  declined: 'Declined',
  closed: 'Closed',
  archived: 'Archived',
};

export function getNextStates(fromStatus: GrantStatus): GrantStatus[] {
  return PIPELINE_TRANSITIONS[fromStatus] ?? [];
}

export function canTransition(fromStatus: GrantStatus, toStatus: GrantStatus): boolean {
  return getNextStates(fromStatus).includes(toStatus);
}
