import type {
  ApprovalRecord,
  DraftArtifact,
  Grant,
  GrantDetailResponse,
  GrantDetailWorkflow,
  RevisionRequest,
  SubmissionRecord,
} from '../../../../shared/types';
import {
  createDefaultFunderSummary,
  createDefaultGrantChecklist,
  normalizeGrantDetailFields,
} from '../../../../shared/seed-data';
import { getDependencies } from './dependencies';
import { canSubmit as canSubmitGrant } from './submission-service';

function latestByVersion(drafts: DraftArtifact[]): DraftArtifact | null {
  if (drafts.length === 0) {
    return null;
  }

  return [...drafts].sort((a, b) => b.version - a.version)[0] ?? null;
}

function latestRevisionRequest(revisions: RevisionRequest[]): RevisionRequest | null {
  if (revisions.length === 0) {
    return null;
  }

  return [...revisions].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0] ?? null;
}

function buildWorkflow(
  grant: Grant,
  latestDraft: DraftArtifact | null,
  approvalRecord: ApprovalRecord | null,
  submissionRecord: SubmissionRecord | null,
  canSubmitResult: Awaited<ReturnType<typeof canSubmitGrant>>,
): GrantDetailWorkflow {
  const submitted = Boolean(submissionRecord) || grant.status === 'submitted';
  const terminalState = submitted || grant.status === 'awarded';
  const hasDraft = Boolean(latestDraft);

  return {
    canGenerateDraft: !terminalState,
    canRequestRevision: hasDraft && !terminalState,
    canApprove: hasDraft && !terminalState && !approvalRecord && !submissionRecord,
    canSubmit: !submitted && canSubmitResult.canSubmit,
    blockingReason: submitted
      ? 'Grant has already been submitted'
      : canSubmitResult.canSubmit
        ? null
        : canSubmitResult.reason ?? 'Submission is blocked',
  };
}

function normalizeDetailGrant(
  grant: Grant,
  latestDraft: DraftArtifact | null,
): Grant {
  const normalizedGrant = normalizeGrantDetailFields({
    ...grant,
    funderSummary: grant.funderSummary ?? createDefaultFunderSummary(grant),
    latestDraftVersion: grant.latestDraftVersion ?? latestDraft?.version ?? 0,
    groundedDocumentCount: grant.groundedDocumentCount ?? 0,
    sourceCount: grant.sourceCount ?? 0,
  });

  if (!normalizedGrant.checklist || normalizedGrant.checklist.length === 0) {
    normalizedGrant.checklist = createDefaultGrantChecklist(normalizedGrant);
  }

  return normalizedGrant;
}

export async function loadGrantDetail(grantId: string): Promise<GrantDetailResponse | null> {
  const deps = getDependencies();
  const grant = await deps.repository.getGrant(grantId);

  if (!grant) {
    return null;
  }

  const [drafts, revisions, approvalRecord, submissionRecord, followUps, canSubmitResult] = await Promise.all([
    deps.repository.getDraftArtifacts(grantId),
    deps.repository.getRevisionRequests(grantId),
    deps.repository.getApprovalRecord(grantId),
    deps.repository.getSubmissionRecord(grantId),
    deps.repository.getFollowUps(),
    canSubmitGrant(grantId),
  ]);

  const grantFollowUps = followUps.filter((followUp) => followUp.grantId === grantId);
  const latestDraft = latestByVersion(drafts);
  const latestRevision = latestRevisionRequest(revisions);
  const normalizedGrant = normalizeDetailGrant(grant, latestDraft);

  return {
    grant: normalizedGrant,
    latestDraft,
    latestRevisionRequest: latestRevision,
    approvalRecord,
    submissionRecord,
    followUps: grantFollowUps,
    workflow: buildWorkflow(normalizedGrant, latestDraft, approvalRecord, submissionRecord, canSubmitResult),
  };
}
