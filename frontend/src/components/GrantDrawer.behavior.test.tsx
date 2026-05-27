import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { GrantDetailResponse } from '../../../shared/types';

const {
  getGrantById,
  getManifest,
  createDraft,
  createApproval,
  createSubmission,
  createRevision,
} = vi.hoisted(() => ({
  getGrantById: vi.fn(),
  getManifest: vi.fn(),
  createDraft: vi.fn(),
  createApproval: vi.fn(),
  createSubmission: vi.fn(),
  createRevision: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getById: getGrantById },
    manifest: { get: getManifest, create: vi.fn() },
    drafts: { create: createDraft },
    approvals: { create: createApproval },
    submit: { create: createSubmission },
    revisions: { create: createRevision },
    jobs: { get: vi.fn() },
  },
}));

import GrantDrawer from './GrantDrawer';

const grantId = 'grant-override';
let currentDetail: GrantDetailResponse;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeDetail(): GrantDetailResponse {
  return {
    grant: {
      id: grantId,
      title: 'Override Test Grant',
      funder: 'Test Foundation',
      funderShort: 'TF',
      award: '$25,000',
      awardSort: 25000,
      deadline: '2026-12-31',
      daysOut: 30,
      fit: 72,
      tags: ['Education'],
      status: 'review',
      statusLabel: 'Review',
      matchedAt: '2026-05-27',
      fitBreakdown: {
        missionAlignment: 80,
        geographicFocus: 70,
        programTrackrecord: 65,
        budgetCapacity: 60,
        partnershipReadiness: 55,
      },
      checklist: [],
      sourceCount: 1,
      groundedDocumentCount: 0,
      humanOverrides: [],
    },
    latestDraft: null,
    latestRevisionRequest: null,
    approvalRecord: null,
    submissionRecord: null,
    followUps: [],
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: true,
      canApprove: true,
      canSubmit: false,
      blockingReason: 'Grant must be approved before submission',
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  currentDetail = makeDetail();
  getGrantById.mockImplementation(async () => currentDetail);
  getManifest.mockResolvedValue(null);
  createDraft.mockResolvedValue(null);
  createApproval.mockResolvedValue(null);
  createSubmission.mockResolvedValue(null);
  createRevision.mockResolvedValue(null);

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/override') && init?.body) {
      const body = JSON.parse(String(init.body)) as { field: string; newValue: unknown; rationale: string; overrideType: string };
      if (body.field === 'fit') {
        currentDetail = {
          ...currentDetail,
          grant: {
            ...currentDetail.grant,
            fit: Number(body.newValue),
            humanOverrides: [
              ...(currentDetail.grant.humanOverrides ?? []),
              {
                field: 'fit',
                previousValue: 72,
                newValue: Number(body.newValue),
                rationale: body.rationale,
                overriddenAt: new Date().toISOString(),
                overriddenBy: 'operator',
                overrideType: 'score',
              },
            ],
          },
        };
      }
      return new Response(JSON.stringify(currentDetail.grant), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
  }));

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('GrantDrawer behavior', () => {
  it('warns before closing when revision notes are dirty', async () => {
    const onClose = vi.fn();
    root.render(React.createElement(GrantDrawer, { grantId, onClose, onRefreshAppState: vi.fn() }));

    await waitFor(() => container.textContent?.includes('Request revision') === true);
    Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Request revision'))?.click();
    await waitFor(() => container.querySelector('textarea') !== null);

    setTextareaValue(container.querySelector('textarea') as HTMLTextAreaElement, 'Keep this note');
    (container.querySelector('.drawer-close') as HTMLButtonElement | null)?.click();

    await waitFor(() => container.querySelector('[data-testid="grant-drawer-unsaved-warning"]') !== null);
    expect(onClose).not.toHaveBeenCalled();

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Discard')?.click();
    await waitFor(() => onClose.mock.calls.length === 1);
  });

  it('applies a fit override and shows the human-confirmed badge', async () => {
    root.render(React.createElement(GrantDrawer, { grantId, onClose: vi.fn(), onRefreshAppState: vi.fn() }));

    await waitFor(() => container.querySelector('[data-testid="override-fit-score-btn"]') !== null);
    (container.querySelector('[data-testid="override-fit-score-btn"]') as HTMLButtonElement).click();
    await waitFor(() => container.querySelector('.override-panel') !== null);

    const inputs = container.querySelectorAll('.override-panel input, .override-panel textarea');
    const scoreInput = inputs[0] as HTMLInputElement;
    const rationaleInput = inputs[1] as HTMLTextAreaElement;
    const scoreSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    scoreSetter?.call(scoreInput, '91');
    scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
    scoreInput.dispatchEvent(new Event('change', { bubbles: true }));
    setTextareaValue(rationaleInput, 'Human review confirmed stronger fit.');

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save override')?.click();

    await waitFor(() => container.querySelector('[data-testid="fit-human-confirmed-badge"]') !== null);
    expect(container.querySelector('[data-testid="fit-human-confirmed-badge"]')).not.toBeNull();
    expect(currentDetail.grant.humanOverrides?.some((override) => override.field === 'fit')).toBe(true);
  });
});
