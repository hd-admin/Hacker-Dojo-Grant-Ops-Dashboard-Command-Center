// @vitest-environment jsdom
import { createRoot } from 'next/dist/compiled/react-dom/client';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GrantDetailResponse,
  SubmissionManifest,
  SubmissionMethod,
} from '../../../shared/types';

const {
  getGrantDetail,
  getManifest,
  createManifest,
  createDraft,
  createApproval,
  createSubmission,
  createRevision,
  getDocuments,
  getFollowUps,
} = vi.hoisted(() => ({
  getGrantDetail: vi.fn(),
  getManifest: vi.fn(),
  createManifest: vi.fn(),
  createDraft: vi.fn(),
  createApproval: vi.fn(),
  createSubmission: vi.fn(),
  createRevision: vi.fn(),
  getDocuments: vi.fn(),
  getFollowUps: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getById: getGrantDetail },
    manifest: { get: getManifest, create: createManifest },
    drafts: { create: createDraft },
    approvals: { create: createApproval },
    submit: { create: createSubmission },
    revisions: { create: createRevision },
    jobs: { get: vi.fn() },
    documents: { getAll: getDocuments },
    followUps: { getFiltered: getFollowUps, create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { getByRole, getByText, queryByRole, queryByText } from '../test-helpers';
import { GrantDrawer } from './GrantDrawer';

const grantId = 'nsf-techaccess';

function makeGrantDetail(overrides: Partial<GrantDetailResponse> = {}): GrantDetailResponse {
  const base: GrantDetailResponse = {
    grant: {
      id: grantId,
      title: 'NSF Technology Access and Adoption Program',
      funder: 'National Science Foundation',
      funderShort: 'NSF',
      award: '$350,000',
      awardSort: 350000,
      deadline: '2026-06-15',
      daysOut: 25,
      fit: 88,
      tags: ['Science & Tech', 'Federal', 'EdTech'],
      status: 'matched',
      statusLabel: 'Matched',
      matchedAt: '2026-05-19',
      fitBreakdown: {
        missionAlignment: 96,
        geographicFocus: 90,
        programTrackrecord: 88,
        budgetCapacity: 82,
        partnershipReadiness: 78,
      },
      checklist: [
        {
          label: 'Funder summary captured',
          done: true,
          source: 'Prototype detail view',
        },
        {
          label: 'Fit review documented',
          done: true,
          source: 'Research scoring',
        },
        {
          label: 'Draft preview ready',
          done: false,
          source: 'Drafting workflow',
        },
      ],
      draftContent: '',
      externalUrl: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734',
      funderSummary: 'NSF is a strong fit for community technology access.',
      latestDraftVersion: 0,
      groundedDocumentCount: 0,
      sourceCount: 3,
    },
    latestDraft: null,
    latestRevisionRequest: null,
    approvalRecord: null,
    submissionRecord: null,
    followUps: [],
    workflow: {
      canGenerateDraft: true,
      canRequestRevision: false,
      canApprove: false,
      canSubmit: false,
      blockingReason: 'Grant must be approved before submission',
    },
    ...overrides,
  };

  return base;
}

function makeManifest(overrides: Partial<SubmissionManifest> = {}): SubmissionManifest {
  return {
    id: 'manifest-1',
    grantId,
    version: 1,
    createdAt: '2026-05-23T08:00:00.000Z',
    updatedAt: '2026-05-23T08:30:00.000Z',
    instructions: 'Upload all portal materials as PDFs.',
    portalUrl: 'https://example.org/submit',
    fileConstraints: 'PDF only, max 10MB',
    dueDate: '2026-06-14',
    materialRefs: [
      { documentId: 'doc-1', documentName: 'Narrative.pdf', role: 'narrative' },
      { documentId: 'doc-2', documentName: 'Budget.xlsx', version: 'v2', role: 'budget' },
    ],
    notes: 'Confirm budget attachment before submitting.',
    ...overrides,
  };
}

function buildGeneratedDetail(): GrantDetailResponse {
  return makeGrantDetail({
    grant: {
      ...makeGrantDetail().grant,
      status: 'draft',
      statusLabel: 'Drafting',
      draftContent:
        'Hacker Dojo proposes to expand access to technology education and community innovation in Silicon Valley.',
      latestDraftVersion: 1,
      groundedDocumentCount: 2,
      sourceCount: 2,
    },
    latestDraft: {
      id: 'draft-1',
      grantId,
      version: 1,
      content:
        'Hacker Dojo proposes to expand access to technology education and community innovation in Silicon Valley.',
      createdAt: '2026-05-23T10:00:00.000Z',
      createdBy: 'agent',
    },
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: true,
      canApprove: true,
      canSubmit: false,
      blockingReason: 'Grant must be approved before submission',
    },
  });
}

function buildRevisedDetail(): GrantDetailResponse {
  return makeGrantDetail({
    grant: {
      ...buildGeneratedDetail().grant,
      latestDraftVersion: 1,
      groundedDocumentCount: 2,
    },
    latestDraft: buildGeneratedDetail().latestDraft,
    latestRevisionRequest: {
      id: 'revision-1',
      grantId,
      draftVersion: 1,
      notes: 'Please tighten the budget narrative.',
      requestedAt: '2026-05-23T11:00:00.000Z',
      requestedBy: 'human',
      status: 'pending',
    },
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: true,
      canApprove: true,
      canSubmit: false,
      blockingReason: 'Grant must be approved before submission',
    },
  });
}

function buildApprovedDetail(): GrantDetailResponse {
  return makeGrantDetail({
    grant: {
      ...buildRevisedDetail().grant,
      status: 'review',
      statusLabel: 'Review',
    },
    latestDraft: buildRevisedDetail().latestDraft,
    latestRevisionRequest: buildRevisedDetail().latestRevisionRequest,
    approvalRecord: {
      id: 'approval-1',
      grantId,
      draftVersion: 1,
      approvedAt: '2026-05-23T12:00:00.000Z',
      approvedBy: 'human',
    },
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: true,
      canApprove: false,
      canSubmit: true,
      blockingReason: null,
    },
  });
}

function buildSubmittedDetail(): GrantDetailResponse {
  return makeGrantDetail({
    grant: {
      ...buildApprovedDetail().grant,
      status: 'submitted',
      statusLabel: 'Submitted',
    },
    latestDraft: buildApprovedDetail().latestDraft,
    latestRevisionRequest: buildApprovedDetail().latestRevisionRequest,
    approvalRecord: buildApprovedDetail().approvalRecord,
    submissionRecord: {
      id: 'submission-1',
      grantId,
      submittedAt: '2026-05-23T13:00:00.000Z',
      method: {
        type: 'portal',
        portalUrl: 'https://example.com/portal',
        submittedBy: 'human',
      },
      notes: '',
      followUpsCreated: ['follow-up-1'],
    },
    followUps: [
      {
        id: 'follow-up-1',
        grantId,
        submissionId: 'submission-1',
        type: 'progress_check',
        title: 'Follow up on NSF submission',
        description: 'Check status of application to National Science Foundation.',
        dueDate: '2026-06-06T00:00:00.000Z',
        status: 'pending',
        createdAt: '2026-05-23T13:00:00.000Z',
      },
    ],
    workflow: {
      canGenerateDraft: false,
      canRequestRevision: false,
      canApprove: false,
      canSubmit: false,
      blockingReason: 'Grant has already been submitted',
    },
  });
}

let currentDetail: GrantDetailResponse;
let currentManifest: SubmissionManifest | null;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalOpen = window.open;

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/grants/') && url.includes('/override') && init?.body) {
        const body = JSON.parse(String(init.body)) as {
          field: string;
          newValue: unknown;
          rationale: string;
          overrideType: string;
        };
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
                  previousValue: currentDetail.grant.fit,
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
        if (body.field === 'category') {
          currentDetail = {
            ...currentDetail,
            grant: {
              ...currentDetail.grant,
              category: String(body.newValue),
              humanOverrides: [
                ...(currentDetail.grant.humanOverrides ?? []),
                {
                  field: 'category',
                  previousValue: currentDetail.grant.category ?? null,
                  newValue: String(body.newValue),
                  rationale: body.rationale,
                  overriddenAt: new Date().toISOString(),
                  overriddenBy: 'operator',
                  overrideType: 'category',
                },
              ],
            },
          };
        }
        if (body.field === 'status') {
          currentDetail = {
            ...currentDetail,
            grant: {
              ...currentDetail.grant,
              status: body.newValue as GrantDetailResponse['grant']['status'],
              statusLabel: String(body.newValue),
              humanOverrides: [
                ...(currentDetail.grant.humanOverrides ?? []),
                {
                  field: 'status',
                  previousValue: currentDetail.grant.status,
                  newValue: body.newValue,
                  rationale: body.rationale,
                  overriddenAt: new Date().toISOString(),
                  overriddenBy: 'operator',
                  overrideType: 'status',
                },
              ],
            },
          };
        }
        return new Response(JSON.stringify(currentDetail.grant), {
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
    }),
  );
  currentDetail = makeGrantDetail();
  currentManifest = null;
  getGrantDetail.mockImplementation(async () => currentDetail);
  getManifest.mockImplementation(async () => currentManifest);
  getDocuments.mockResolvedValue([]);
  getFollowUps.mockResolvedValue([]);
  createManifest.mockImplementation(
    async (
      _grantId: string,
      request: {
        instructions?: string;
        portalUrl?: string;
        fileConstraints?: string;
        dueDate?: string;
        materialRefs?: Array<{
          documentId: string;
          documentName: string;
          version?: string;
          role: string;
        }>;
        notes?: string;
      },
    ) => {
      currentManifest = {
        ...makeManifest(request),
        ...request,
        materialRefs: request.materialRefs ?? [],
      };
      return currentManifest;
    },
  );
  createDraft.mockImplementation(async (_grantId: string, request: { revisionNotes?: string }) => {
    const generated = buildGeneratedDetail();
    const generatedLatestDraft = generated.latestDraft;
    if (!generatedLatestDraft) {
      throw new Error('Expected generated.latestDraft to exist');
    }
    const latestDraft = {
      ...generatedLatestDraft,
      revisionNotes: request.revisionNotes ?? '',
    };
    currentDetail = {
      ...generated,
      grant: {
        ...generated.grant,
        draftContent: latestDraft.content,
        latestDraftVersion: latestDraft.version,
      },
      latestDraft,
    };
    return latestDraft;
  });
  createApproval.mockImplementation(async () => {
    currentDetail = buildApprovedDetail();
    const approvalRecord = currentDetail.approvalRecord;
    if (!approvalRecord) {
      throw new Error('Expected approvalRecord to exist');
    }
    return approvalRecord;
  });
  createSubmission.mockImplementation(
    async (
      _grantId: string,
      request: {
        method: {
          type: SubmissionMethod['type'];
          portalUrl?: string;
          confirmationId?: string;
          submittedBy: string;
        };
        notes?: string;
      },
    ) => {
      const submitted = buildSubmittedDetail();
      const submissionRecord = submitted.submissionRecord;
      if (!submissionRecord) {
        throw new Error('Expected submissionRecord to exist');
      }
      currentDetail = {
        ...submitted,
        submissionRecord: {
          ...submissionRecord,
          method: request.method,
          notes: request.notes ?? '',
        },
      };
      const currentSubmissionRecord = currentDetail.submissionRecord;
      if (!currentSubmissionRecord) {
        throw new Error('Expected currentDetail.submissionRecord to exist');
      }
      return currentSubmissionRecord;
    },
  );
  createRevision.mockImplementation(async (_grantId: string, notes: string) => {
    currentDetail = buildRevisedDetail();
    currentDetail = {
      ...currentDetail,
      latestRevisionRequest: {
        id: 'revision-1',
        grantId,
        draftVersion: 1,
        notes,
        requestedAt: '2026-05-23T11:00:00.000Z',
        requestedBy: 'human',
        status: 'pending',
      },
    };
    return currentDetail.latestRevisionRequest;
  });

  window.open = vi.fn() as typeof window.open;

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  window.open = originalOpen;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('GrantDrawer', () => {
  it('renders the submission manifest section when a manifest exists', async () => {
    currentManifest = makeManifest();
    root.render(
      React.createElement(GrantDrawer, {
        grantId,
        onClose: vi.fn(),
        onRefreshAppState: vi.fn(),
      }),
    );

    await waitFor(
      () => queryByRole(container, 'heading', { name: 'Submission manifest' }) !== null,
    );
    const dialog = getByRole(container, 'dialog', { name: 'Grant details' });
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(getByText(container, 'Version 1')).not.toBeNull();
    expect(getByText(container, 'Upload all portal materials as PDFs.')).not.toBeNull();
    expect(getByText(container, 'https://example.org/submit')).not.toBeNull();
    expect(getByText(container, 'PDF only, max 10MB')).not.toBeNull();
    expect(getByText(container, 'Jun 14, 2026')).not.toBeNull();
    expect(getByText(container, '2 items')).not.toBeNull();
    expect(
      getByText(container, 'Narrative.pdf · narrative | Budget.xlsx (v2) · budget'),
    ).not.toBeNull();
    expect(getByText(container, 'Confirm budget attachment before submitting.')).not.toBeNull();
  });

  it('creates and displays a submission manifest when one is missing', async () => {
    const onRefreshAppState = vi.fn();
    root.render(
      React.createElement(GrantDrawer, {
        grantId,
        onClose: vi.fn(),
        onRefreshAppState,
      }),
    );

    await waitFor(() => queryByText(container, 'No submission manifest yet.') !== null);
    getByRole(container, 'button', { name: 'Create manifest' }).click();

    await waitFor(() => createManifest.mock.calls.length === 1);
    await waitFor(() => queryByText(container, 'Version 1') !== null);
    expect(createManifest).toHaveBeenCalledWith(grantId, {});
    expect(onRefreshAppState).toHaveBeenCalled();
    expect(container.textContent).not.toContain('No submission manifest yet.');
  });

  it('renders the prototype sections and initial action gates from detail data', async () => {
    root.render(
      React.createElement(GrantDrawer, {
        grantId,
        onClose: vi.fn(),
        onRefreshAppState: vi.fn(),
      }),
    );

    await waitFor(
      () =>
        queryByRole(container, 'heading', {
          name: 'NSF Technology Access and Adoption Program',
        }) !== null,
    );

    expect(getByText(container, 'Funder summary (agent-generated)')).not.toBeNull();
    expect(
      getByText(container, 'NSF is a strong fit for community technology access.'),
    ).not.toBeNull();
    expect(getByRole(container, 'heading', { name: 'Why it fits' })).not.toBeNull();
    // Check fit scores are visible
    expect(container.textContent).toContain('96');
    expect(container.textContent).toContain('90');
    expect(container.textContent).toContain('88');
    expect(container.textContent).toContain('82');
    expect(container.textContent).toContain('78');

    expect(getByRole(container, 'heading', { name: 'Requirements checklist' })).not.toBeNull();
    // Check checklist items by text
    expect(getByText(container, 'Funder summary captured')).not.toBeNull();
    expect(getByText(container, 'Fit review documented')).not.toBeNull();
    expect(getByText(container, 'Draft preview ready')).not.toBeNull();

    expect(
      getByRole(container, 'heading', { name: 'Drafted Letter of Intent — preview' }),
    ).not.toBeNull();

    // Verify section ordering: Why it fits should appear before Funder summary
    const whyItFitsHeading = getByRole(container, 'heading', { name: 'Why it fits' });
    const funderSummaryHeading = getByRole(container, 'heading', {
      name: 'Funder summary (agent-generated)',
    });
    expect(
      whyItFitsHeading.compareDocumentPosition(funderSummaryHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(getByText(container, 'No draft yet')).not.toBeNull();
    expect(container.textContent).not.toContain('Drafted by agent');
    expect(getByRole(container, 'button', { name: 'Generate draft' })).not.toBeNull();
    expect(getByText(container, 'Sources: 3 · Grounded docs: 0')).not.toBeNull();
    expect(
      getByText(container, 'Submission blocked: Grant must be approved before submission'),
    ).not.toBeNull();
    expect(container.querySelector('[aria-label="Approve and lock"]')).toBeNull();
    expect(container.querySelector('[aria-label="Submit"]')).toBeNull();
  });

  it(
    'supports generate, revise, approve, and submit through the rendered drawer',
    async () => {
      const onClose = vi.fn();
      const onRefreshAppState = vi.fn();
      root.render(React.createElement(GrantDrawer, { grantId, onClose, onRefreshAppState }));

      await waitFor(() => queryByRole(container, 'button', { name: 'Generate draft' }) !== null);
      getByRole(container, 'button', { name: 'Generate draft' }).click();

      await waitFor(() => createDraft.mock.calls.length === 1);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      if (!container.textContent?.includes('Drafted by agent')) {
        throw new Error(
          `getGrantDetail calls: ${getGrantDetail.mock.calls.length}, ` +
            `textContent snippet: ${container.textContent?.slice(0, 500)}`,
        );
      }
      expect(getByText(container, 'Drafted by agent')).not.toBeNull();
      expect(container.textContent).toContain('community innovation in Silicon Valley');
      expect(getByRole(container, 'button', { name: 'Request revision' })).not.toBeNull();
      expect(getByRole(container, 'button', { name: 'Approve and lock' })).not.toBeNull();
      expect(container.querySelector('[aria-label="Generate draft"]')).toBeNull();

      getByRole(container, 'button', { name: 'Request revision' }).click();
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await waitFor(() => queryByRole(container, 'textbox', { name: 'Revision notes' }) !== null);

      const textarea = getByRole(container, 'textbox', {
        name: 'Revision notes',
      }) as HTMLTextAreaElement;
      setTextareaValue(textarea, 'Please tighten the budget narrative.');
      getByRole(container, 'button', { name: 'Save revision' }).click();

      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await waitFor(
        () =>
          queryByText(container, 'Last revision note: Please tighten the budget narrative.') !==
          null,
      );
      expect(createRevision).toHaveBeenCalledWith(
        grantId,
        'Please tighten the budget narrative.',
        'human',
      );

      getByRole(container, 'button', { name: 'Approve and lock' }).click();
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      // Wait for the exact "Submit" button to appear in Actions (viewModel.showSubmit = true after approve)
      await waitFor(() => queryByRole(container, 'button', { name: 'Submit' }) !== null);
      expect(createApproval).toHaveBeenCalledWith(grantId, { approvedBy: 'human' });
      expect(container.textContent).not.toContain(
        'Submission blocked: Grant must be approved before submission',
      );

      getByRole(container, 'button', { name: 'Submit' }).click();
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await waitFor(() => queryByRole(container, 'heading', { name: 'Submit grant' }) !== null);

      getByRole(container, 'button', { name: 'Confirm submission' }).click();
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await waitFor(() => onClose.mock.calls.length === 1);
      await waitFor(() => createSubmission.mock.calls.length === 1);
      await waitFor(() => queryByText(container, 'Follow-ups') !== null);

      expect(onRefreshAppState).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(createSubmission).toHaveBeenCalledWith(
        grantId,
        expect.objectContaining({
          method: expect.objectContaining({ type: 'portal', submittedBy: 'human' }),
          notes: '',
        }),
      );
    },
    { timeout: 10000 },
  );

  describe('draft-preview AI badge', () => {
    it('shows AI badge with exact grounded counts when a draft exists', async () => {
      currentDetail = buildGeneratedDetail();
      root.render(
        React.createElement(GrantDrawer, {
          grantId,
          onClose: vi.fn(),
          onRefreshAppState: vi.fn(),
        }),
      );

      await waitFor(() => queryByText(container, 'Hacker Dojo proposes') !== null);

      expect(getByText(container, 'Drafted by agent')).not.toBeNull();
      expect(getByText(container, 'grounded in 2 org documents')).not.toBeNull();
      expect(getByText(container, '2 funder sources')).not.toBeNull();
      expect(/\d+ words \· \d+ pages/.test(container.textContent ?? '')).toBe(true);
    });
  });

  describe('grounding approval blocking', () => {
    it('blocks approval when grounding sections have ungrounded claims', async () => {
      const detail = buildGeneratedDetail();
      // Add grounding sections with one ungrounded
      detail.latestDraft = {
        ...detail.latestDraft!,
        groundingSections: [
          { sectionTitle: 'Executive Summary', evidence: ['Doc A'], isGrounded: true },
          { sectionTitle: 'Budget', evidence: [], isGrounded: false },
        ],
      };
      currentDetail = detail;

      root.render(
        React.createElement(GrantDrawer, {
          grantId,
          onClose: vi.fn(),
          onRefreshAppState: vi.fn(),
        }),
      );

      await waitFor(() => queryByRole(container, 'button', { name: 'Approve and lock' }) !== null);

      // Click Approve and lock
      getByRole(container, 'button', { name: 'Approve and lock' }).click();

      await waitFor(() => queryByText(container, 'Ungrounded Claims Detected') !== null);

      // Warning dialog should be visible
      expect(getByText(container, 'Ungrounded Claims Detected')).not.toBeNull();
      expect(getByText(container, 'Budget')).not.toBeNull();

      // Approve Anyway should be disabled until checkbox is checked
      const approveAnywayBtn = getByRole(container, 'button', {
        name: 'Approve Anyway',
      }) as HTMLButtonElement;
      expect(approveAnywayBtn).not.toBeNull();
      expect(approveAnywayBtn?.disabled).toBe(true);

      // Check the override checkbox
      const checkbox = container.querySelector(
        "[data-testid='grounding-override-checkbox']",
      ) as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      checkbox?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(
        (getByRole(container, 'button', { name: 'Approve Anyway' }) as HTMLButtonElement)?.disabled,
      ).toBe(false);
    });

    it('approves without warning when all grounding sections are grounded', async () => {
      const detail = buildGeneratedDetail();
      // Add grounding sections all grounded
      detail.latestDraft = {
        ...detail.latestDraft!,
        groundingSections: [
          { sectionTitle: 'Executive Summary', evidence: ['Doc A'], isGrounded: true },
          { sectionTitle: 'Budget', evidence: ['Doc B'], isGrounded: true },
        ],
      };
      currentDetail = detail;

      root.render(
        React.createElement(GrantDrawer, {
          grantId,
          onClose: vi.fn(),
          onRefreshAppState: vi.fn(),
        }),
      );

      await waitFor(() => queryByRole(container, 'button', { name: 'Approve and lock' }) !== null);

      // Click Approve and lock — should proceed without warning
      getByRole(container, 'button', { name: 'Approve and lock' }).click();

      // Should not show the warning dialog
      await new Promise((r) => setTimeout(r, 100));
      expect(container.textContent).not.toContain('Ungrounded Claims Detected');
    });

    it('cancel button dismisses the grounding warning dialog', async () => {
      const detail = buildGeneratedDetail();
      detail.latestDraft = {
        ...detail.latestDraft!,
        groundingSections: [{ sectionTitle: 'Budget', evidence: [], isGrounded: false }],
      };
      currentDetail = detail;

      root.render(
        React.createElement(GrantDrawer, {
          grantId,
          onClose: vi.fn(),
          onRefreshAppState: vi.fn(),
        }),
      );

      await waitFor(() => queryByRole(container, 'button', { name: 'Approve and lock' }) !== null);

      getByRole(container, 'button', { name: 'Approve and lock' }).click();

      await waitFor(() => queryByText(container, 'Ungrounded Claims Detected') !== null);

      // Click Cancel
      getByRole(container, 'button', { name: 'Cancel' }).click();

      await new Promise((r) => setTimeout(r, 50));
      expect(container.textContent).not.toContain('Ungrounded Claims Detected');
    });
  });

  describe('deadline confidence display', () => {
    it('shows (estimated) badge when deadlineConfidence is estimated', async () => {
      currentDetail = makeGrantDetail({
        grant: { ...makeGrantDetail().grant, deadlineConfidence: 'estimated' },
      });
      root.render(
        React.createElement(GrantDrawer, { grantId, onClose: vi.fn(), onRefreshAppState: vi.fn() }),
      );
      await waitFor(() => queryByText(container, '(estimated)') !== null);
      expect(getByText(container, '(estimated)')).not.toBeNull();
    });

    it('shows (date uncertain) badge when deadlineConfidence is unknown', async () => {
      currentDetail = makeGrantDetail({
        grant: { ...makeGrantDetail().grant, deadlineConfidence: 'unknown' },
      });
      root.render(
        React.createElement(GrantDrawer, { grantId, onClose: vi.fn(), onRefreshAppState: vi.fn() }),
      );
      await waitFor(() => queryByText(container, '(date uncertain)') !== null);
      expect(getByText(container, '(date uncertain)')).not.toBeNull();
    });

    it('renders no confidence badge when deadlineConfidence is exact or undefined', async () => {
      currentDetail = makeGrantDetail({
        grant: { ...makeGrantDetail().grant, deadlineConfidence: 'exact' },
      });
      root.render(
        React.createElement(GrantDrawer, { grantId, onClose: vi.fn(), onRefreshAppState: vi.fn() }),
      );
      await waitFor(
        () =>
          queryByRole(container, 'heading', {
            name: 'NSF Technology Access and Adoption Program',
          }) !== null,
      );
      expect(container.textContent).not.toContain('(estimated)');
      expect(container.textContent).not.toContain('(date uncertain)');
    });
  });

  describe('SubmissionReadiness integration', () => {
    it('renders SubmissionReadiness section when grant can be submitted (canSubmit=true)', async () => {
      // Use approved detail where workflow.canSubmit = true to trigger SubmissionReadiness rendering
      currentDetail = buildApprovedDetail();
      root.render(
        React.createElement(GrantDrawer, { grantId, onClose: vi.fn(), onRefreshAppState: vi.fn() }),
      );
      await waitFor(
        () =>
          queryByRole(container, 'heading', {
            name: 'NSF Technology Access and Adoption Program',
          }) !== null,
      );

      // SubmissionReadiness renders a "Submission Readiness" heading (only when canSubmit=true)
      expect(getByRole(container, 'heading', { name: 'Submission Readiness' })).not.toBeNull();
    });
  });
});
