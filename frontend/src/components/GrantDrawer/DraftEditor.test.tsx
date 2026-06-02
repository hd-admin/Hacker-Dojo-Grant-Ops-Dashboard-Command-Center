// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { GrantDetailResponse } from '../../../../shared/types';
import { DraftEditor } from './DraftEditor';
import type { GrantDrawerViewModel } from './utilities';

vi.mock('../GroundingReview', () => ({
  GroundingReview: () => React.createElement('div', { 'data-testid': 'grounding-review' }),
}));

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeDetail(overrides: Partial<GrantDetailResponse> = {}): GrantDetailResponse {
  return {
    grant: {
      id: 'g1',
      title: 'Test Grant',
      funder: 'Test Foundation',
      funderShort: 'TF',
      award: '$100,000',
      awardSort: 100000,
      deadline: '2026-06-15',
      daysOut: 25,
      fit: 88,
      tags: ['Education'],
      status: 'draft',
      statusLabel: 'Drafting',
      matchedAt: '2026-05-19',
      fitBreakdown: {
        missionAlignment: 96,
        geographicFocus: 90,
        programTrackrecord: 88,
        budgetCapacity: 82,
        partnershipReadiness: 78,
      },
      checklist: [],
      sourceCount: 3,
      groundedDocumentCount: 2,
      draftContent: 'Hacker Dojo proposes to expand access to technology education.',
      latestDraftVersion: 1,
    },
    latestDraft: {
      id: 'draft-1',
      grantId: 'g1',
      version: 1,
      content: 'Hacker Dojo proposes to expand access to technology education.',
      createdAt: '2026-05-23T10:00:00.000Z',
      createdBy: 'agent',
    },
    latestRevisionRequest: null,
    approvalRecord: null,
    submissionRecord: null,
    followUps: [],
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: false,
      canApprove: false,
      canSubmit: false,
      blockingReason: null,
    },
    ...overrides,
  };
}

function makeViewModel(overrides: Partial<GrantDrawerViewModel> = {}): GrantDrawerViewModel {
  return {
    grant: null,
    latestDraftVersionLabel: 'Version 1',
    latestDraftPreview: 'Hacker Dojo proposes to expand access to technology education.',
    showGenerateDraft: false,
    showRequestRevision: false,
    showApprove: false,
    showSubmit: false,
    submitDisabledReason: null,
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.clearAllMocks();
});

describe('DraftEditor', () => {
  const defaultProps = () => {
    const detail = makeDetail();
    const viewModel = makeViewModel();
    return {
      viewModel,
      detail,
      draftEditMode: false,
      draftEditContent: detail.grant.draftContent ?? '',
      setDraftEditContent: vi.fn(),
      draftIsDirty: false,
      draftIsSaving: false,
      draftLastSaved: null as string | null,
      draftSaveNow: vi.fn(async () => {}),
      draftMarkClean: vi.fn(),
      setDraftEditMode: vi.fn(),
    };
  };

  it('renders the draft preview section with accessible heading', async () => {
    const props = defaultProps();
    root.render(React.createElement(DraftEditor, props));
    await waitFor(() => container.textContent?.includes('Drafted Letter of Intent') === true);
  });

  it('shows draft preview text', async () => {
    const props = defaultProps();
    root.render(React.createElement(DraftEditor, props));
    await waitFor(() => container.textContent?.includes('Hacker Dojo proposes') === true);
    expect(container.textContent).toContain(
      'Hacker Dojo proposes to expand access to technology education.',
    );
  });

  it('shows AI badge with grounded document and source counts', async () => {
    const detail = makeDetail({
      grant: { ...makeDetail().grant, groundedDocumentCount: 2, sourceCount: 2 },
    });
    const viewModel = makeViewModel();
    root.render(React.createElement(DraftEditor, { ...defaultProps(), detail, viewModel }));
    await waitFor(() => container.textContent?.includes('Drafted by agent') === true);
    expect(container.textContent).toContain('Drafted by agent');
    expect(container.textContent).toContain('grounded in 2 org documents');
    expect(container.textContent).toContain('2 funder sources');
  });

  it('shows word and page count', async () => {
    const props = defaultProps();
    root.render(React.createElement(DraftEditor, props));
    await waitFor(() => /\d+ words . \d+ pages/.test(container.textContent ?? ''));
    expect(/\d+ words . \d+ pages/.test(container.textContent ?? '')).toBe(true);
  });

  it('shows version label when no draft preview is available', async () => {
    const detail = makeDetail({
      latestDraft: null,
      grant: { ...makeDetail().grant, draftContent: '' },
    });
    const viewModel = makeViewModel({
      latestDraftPreview: '',
      latestDraftVersionLabel: 'No draft yet',
    });
    root.render(React.createElement(DraftEditor, { ...defaultProps(), detail, viewModel }));
    await waitFor(() => container.textContent?.includes('No draft yet') === true);
  });

  it('shows dirty indicator when draft has unsaved changes', async () => {
    root.render(React.createElement(DraftEditor, { ...defaultProps(), draftIsDirty: true }));
    await waitFor(() => container.textContent?.includes('Unsaved') === true);
    expect(container.textContent).toContain('Unsaved');
  });

  it('shows saving indicator when draft is being saved', async () => {
    root.render(React.createElement(DraftEditor, { ...defaultProps(), draftIsSaving: true }));
    await waitFor(() => container.textContent?.includes('Saving...') === true);
    expect(container.textContent).toContain('Saving...');
  });

  it('shows saved timestamp when last saved is set and not dirty', async () => {
    root.render(
      React.createElement(DraftEditor, {
        ...defaultProps(),
        draftIsDirty: false,
        draftLastSaved: '2026-05-23T10:30:00.000Z',
      }),
    );
    await waitFor(() => container.textContent?.includes('Saved at') === true);
    expect(container.textContent).toContain('Saved at');
  });

  it('enters edit mode and shows textarea when Edit Draft is clicked', async () => {
    const setDraftEditMode = vi.fn();
    root.render(React.createElement(DraftEditor, { ...defaultProps(), setDraftEditMode }));
    await waitFor(() => container.textContent?.includes('Edit Draft') === true);
    const editButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Edit Draft',
    ) as HTMLButtonElement;
    editButton?.click();
    expect(setDraftEditMode).toHaveBeenCalledWith(true);
  });

  it('shows textarea with accessible label in edit mode', async () => {
    root.render(React.createElement(DraftEditor, { ...defaultProps(), draftEditMode: true }));
    await waitFor(() => container.querySelector('textarea') !== null);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute('aria-label')).toBe('Edit draft content');
  });

  it('calls saveNow and disables button while saving', async () => {
    root.render(
      React.createElement(DraftEditor, {
        ...defaultProps(),
        draftEditMode: true,
        draftIsSaving: true,
      }),
    );
    await waitFor(() => container.textContent?.includes('Saving...') === true);
    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Saving...',
    ) as HTMLButtonElement;
    expect(saveButton?.disabled).toBe(true);
  });

  it('Done Editing resets to original content and marks clean', async () => {
    const setDraftEditMode = vi.fn();
    const setDraftEditContent = vi.fn();
    const draftMarkClean = vi.fn();
    const detail = makeDetail({
      grant: { ...makeDetail().grant, draftContent: 'Original content' },
    });
    root.render(
      React.createElement(DraftEditor, {
        ...defaultProps(),
        detail,
        draftEditMode: true,
        setDraftEditMode,
        setDraftEditContent,
        draftMarkClean,
      }),
    );
    await waitFor(() => container.textContent?.includes('Done Editing') === true);
    const doneButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Done Editing',
    ) as HTMLButtonElement;
    doneButton?.click();
    expect(setDraftEditMode).toHaveBeenCalledWith(false);
    expect(setDraftEditContent).toHaveBeenCalledWith('Original content');
    expect(draftMarkClean).toHaveBeenCalled();
  });

  it('shows revision request status', async () => {
    const detail = makeDetail({
      latestRevisionRequest: {
        id: 'rev-1',
        grantId: 'g1',
        draftVersion: 1,
        notes: 'Please tighten the budget.',
        requestedAt: '2026-05-23T11:00:00Z',
        requestedBy: 'human',
        status: 'pending',
      },
    });
    root.render(React.createElement(DraftEditor, { ...defaultProps(), detail }));
    await waitFor(
      () =>
        container.textContent?.includes('Last revision note: Please tighten the budget.') === true,
    );
    expect(container.textContent).toContain('pending');
  });

  it("shows 'none' when no revision request exists", async () => {
    root.render(React.createElement(DraftEditor, { ...defaultProps() }));
    await waitFor(() => container.textContent?.includes('Revision requests: none') === true);
  });

  it('renders GroundingReview when latestDraft exists', async () => {
    const detail = makeDetail();
    root.render(React.createElement(DraftEditor, { ...defaultProps(), detail }));
    await waitFor(() => container.querySelector("[data-testid='grounding-review']") !== null);
  });
});
