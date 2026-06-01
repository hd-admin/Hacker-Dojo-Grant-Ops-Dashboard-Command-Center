'use client';

import type { GrantDetailResponse } from '../../../../shared/types';
import { client } from '../../lib/grant-ops-client';

export interface GrantDrawerViewModel {
  grant: GrantDetailResponse['grant'] | null;
  latestDraftVersionLabel: string;
  latestDraftPreview: string;
  showGenerateDraft: boolean;
  showRequestRevision: boolean;
  showApprove: boolean;
  showSubmit: boolean;
  submitDisabledReason: string | null;
}

export function buildGrantDrawerViewModel(
  detail: GrantDetailResponse | null,
): GrantDrawerViewModel {
  if (!detail) {
    return {
      grant: null,
      latestDraftVersionLabel: 'No draft yet',
      latestDraftPreview: '',
      showGenerateDraft: false,
      showRequestRevision: false,
      showApprove: false,
      showSubmit: false,
      submitDisabledReason: null,
    };
  }

  const latestDraftVersionLabel = detail.latestDraft
    ? `Version ${detail.latestDraft.version}`
    : detail.grant.latestDraftVersion
      ? `Version ${detail.grant.latestDraftVersion}`
      : 'No draft yet';

  const latestDraftPreview = detail.latestDraft?.content || detail.grant.draftContent || '';

  return {
    grant: detail.grant,
    latestDraftVersionLabel,
    latestDraftPreview,
    showGenerateDraft:
      detail.workflow.canGenerateDraft && !detail.latestDraft && !detail.grant.draftContent,
    showRequestRevision: detail.workflow.canRequestRevision,
    showApprove: detail.workflow.canApprove,
    showSubmit: detail.workflow.canSubmit,
    submitDisabledReason: detail.workflow.canSubmit ? null : detail.workflow.blockingReason,
  };
}

export function formatDate(dateStr: string): string {
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

export function previewText(text: string, limit = 280): string {
  if (!text) return 'No draft has been generated yet.';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}\u2026`;
}

const WORKING_CONTEXT_KEY = 'grantops.workingContext';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function readWorkingContext(): Record<string, unknown> {
  const storage = getWorkingContextStorage();
  if (!storage || typeof storage.getItem !== 'function') return {};
  try {
    return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveWorkingContextField(field: string, value: unknown): void {
  const storage = getWorkingContextStorage();
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    return;
  const next = { ...readWorkingContext(), [field]: value };
  storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(next));
}

export async function waitForJobCompletion(jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = await client.jobs.get(jobId);
    if (job.status === 'completed') return;
    if (job.status === 'failed') {
      throw new Error(job.errorMessage || 'Draft job failed');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for draft job');
}
