import { describe, expect, it } from 'vitest';
import type { GrantDetailResponse } from '../../../shared/types';
import { buildGrantDrawerViewModel } from './GrantDrawer';

const baseGrant: GrantDetailResponse['grant'] = {
  id: 'nsf-tech',
  title: 'NSF Technology Access Grant',
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
    { label: '501(c)(3) verification + EIN', done: true, source: 'From profile' },
    { label: 'SAM.gov registration active', done: true, source: 'Verified Apr 12' },
    { label: 'LOI draft', done: false, source: 'In progress' },
  ],
  draftContent: 'Hacker Dojo proposes to anchor the Silicon Valley AI-Ready Hub...',
  externalUrl: 'https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734',
  funderSummary: 'NSF supports community technology programs.',
  latestDraftVersion: 1,
  groundedDocumentCount: 2,
  sourceCount: 3,
};

const { draftContent: _draftContent, ...baseGrantWithoutDraft } = baseGrant;

describe('GrantDrawer view model', () => {
  it('shows a generate-draft action when a matched grant has no draft', () => {
    const detail: GrantDetailResponse = {
      grant: {
        ...baseGrantWithoutDraft,
        latestDraftVersion: 0,
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
    };

    const viewModel = buildGrantDrawerViewModel(detail);
    expect(viewModel.showGenerateDraft).toBe(true);
    expect(viewModel.showApprove).toBe(false);
    expect(viewModel.showSubmit).toBe(true);
    expect(viewModel.submitDisabledReason).toBe('Grant must be approved before submission');
    expect(viewModel.latestDraftVersionLabel).toBe('No draft yet');
  });

  it('shows draft and approval actions when a draft exists', () => {
    const detail: GrantDetailResponse = {
      grant: baseGrant,
      latestDraft: {
        id: 'draft-1',
        grantId: baseGrant.id,
        version: 2,
        content: 'Draft body',
        createdAt: '2026-05-20T12:00:00.000Z',
        createdBy: 'agent',
      },
      latestRevisionRequest: {
        id: 'revision-1',
        grantId: baseGrant.id,
        draftVersion: 2,
        notes: 'Please tighten the budget narrative',
        requestedAt: '2026-05-21T12:00:00.000Z',
        requestedBy: 'human',
        status: 'pending',
      },
      approvalRecord: null,
      submissionRecord: null,
      followUps: [],
      workflow: {
        canGenerateDraft: true,
        canRequestRevision: true,
        canApprove: true,
        canSubmit: false,
        blockingReason: 'Grant must be approved before submission',
      },
    };

    const viewModel = buildGrantDrawerViewModel(detail);
    expect(viewModel.latestDraftVersionLabel).toBe('Version 2');
    expect(viewModel.latestDraftPreview).toBe('Draft body');
    expect(viewModel.showApprove).toBe(true);
    expect(viewModel.showGenerateDraft).toBe(false);
    expect(viewModel.showSubmit).toBe(true);
  });

  it('returns null-safe defaults when no detail is loaded', () => {
    const viewModel = buildGrantDrawerViewModel(null);
    expect(viewModel.grant).toBeNull();
    expect(viewModel.showGenerateDraft).toBe(false);
    expect(viewModel.showApprove).toBe(false);
    expect(viewModel.showSubmit).toBe(false);
  });
});
