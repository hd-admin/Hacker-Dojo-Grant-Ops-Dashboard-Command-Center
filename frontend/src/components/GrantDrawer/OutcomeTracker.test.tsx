// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { AuditEvent, GrantDetailResponse } from '../../../../shared/types';
import { OutcomeTracker } from './OutcomeTracker';
import { getByRole, getAllByRole, getByText, queryByRole, queryByText } from '../../test-helpers';

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
      status: 'review',
      statusLabel: 'Review',
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
      groundedDocumentCount: 0,
    },
    latestDraft: null,
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

function makeAuditEvents(): AuditEvent[] {
  return [
    {
      id: 'evt-1',
      entityId: 'g1',
      entityType: 'grant',
      eventType: 'fit-override',
      actorLabel: 'Operator',
      timestamp: '2026-05-23T12:00:00.000Z',
    },
    {
      id: 'evt-2',
      entityId: 'g1',
      entityType: 'grant',
      eventType: 'approval',
      actorLabel: 'Operator',
      timestamp: '2026-05-23T13:00:00.000Z',
    },
  ];
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe('OutcomeTracker', () => {
  const defaultProps = () => {
    const detail = makeDetail();
    return {
      detail,
      overrideField: null as 'fit' | 'category' | 'status' | null,
      setOverrideField: vi.fn(),
      overrideValue: '',
      setOverrideValue: vi.fn(),
      overrideRationale: '',
      setOverrideRationale: vi.fn(),
      handleSubmitOverride: vi.fn(async () => {}),
      auditEvents: makeAuditEvents(),
    };
  };

  it('renders human overrides section with accessible heading', async () => {
    root.render(React.createElement(OutcomeTracker, defaultProps()));
    await waitFor(() => getAllByRole(container, 'heading').length >= 2);
    expect(queryByText(container, 'Human overrides')).not.toBeNull();
  });

  it('shows override buttons', async () => {
    root.render(React.createElement(OutcomeTracker, defaultProps()));
    await waitFor(() => queryByRole(container, 'button', { name: 'Override fit score' }) !== null);
    expect(getByRole(container, 'button', { name: 'Override fit score' })).not.toBeNull();
    expect(getByRole(container, 'button', { name: 'Override category' })).not.toBeNull();
    expect(getByRole(container, 'button', { name: 'Override status' })).not.toBeNull();
  });

  it('opens override panel when override fit score button is clicked', async () => {
    const setOverrideField = vi.fn();
    const setOverrideValue = vi.fn();
    const setOverrideRationale = vi.fn();
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        setOverrideField,
        setOverrideValue,
        setOverrideRationale,
      }),
    );
    await waitFor(() => queryByRole(container, 'button', { name: 'Override fit score' }) !== null);
    getByRole(container, 'button', { name: 'Override fit score' }).click();
    expect(setOverrideField).toHaveBeenCalledWith('fit');
    expect(setOverrideValue).toHaveBeenCalledWith('88');
    expect(setOverrideRationale).toHaveBeenCalledWith('');
  });

  it('opens category override panel', async () => {
    const setOverrideField = vi.fn();
    const detail = makeDetail({ grant: { ...makeDetail().grant, category: 'Education' } });
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        detail,
        setOverrideField,
        setOverrideValue: vi.fn(),
        setOverrideRationale: vi.fn(),
      }),
    );
    await waitFor(() => queryByText(container, 'Override category') !== null);
    getByRole(container, 'button', { name: 'Override category' }).click();
    expect(setOverrideField).toHaveBeenCalledWith('category');
  });

  it('opens status override panel with select dropdown', async () => {
    const setOverrideField = vi.fn();
    const detail = makeDetail({ grant: { ...makeDetail().grant, status: 'review' } });
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        detail,
        setOverrideField,
        setOverrideValue: vi.fn(),
        setOverrideRationale: vi.fn(),
      }),
    );
    await waitFor(() => queryByText(container, 'Override status') !== null);
    getByRole(container, 'button', { name: 'Override status' }).click();
    expect(setOverrideField).toHaveBeenCalledWith('status');
  });

  it('renders override panel with inputs when overrideField is set', async () => {
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        overrideField: 'fit',
        overrideValue: '75',
        overrideRationale: 'Adjusted',
      }),
    );
    await waitFor(() => queryByRole(container, 'group', { name: 'Override panel' }) !== null);
    expect(getByText(container, 'Provide a rationale before saving.')).not.toBeNull();
  });

  it('shows Cancel and Save override buttons in the panel', async () => {
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        overrideField: 'fit',
        overrideValue: '75',
        overrideRationale: 'Test',
      }),
    );
    await waitFor(() => queryByRole(container, 'group', { name: 'Override panel' }) !== null);
    expect(getByRole(container, 'button', { name: 'Save override' })).not.toBeNull();
    expect(getByRole(container, 'button', { name: 'Cancel' })).not.toBeNull();
  });

  it('calls handleSubmitOverride when Save override is clicked', async () => {
    const handleSubmitOverride = vi.fn(async () => {});
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        overrideField: 'fit',
        overrideValue: '91',
        overrideRationale: 'Test rationale',
        handleSubmitOverride,
      }),
    );
    await waitFor(() => queryByRole(container, 'button', { name: 'Save override' }) !== null);
    getByRole(container, 'button', { name: 'Save override' }).click();
    expect(handleSubmitOverride).toHaveBeenCalled();
  });

  it('clears override state on Cancel', async () => {
    const setOverrideField = vi.fn();
    const setOverrideValue = vi.fn();
    const setOverrideRationale = vi.fn();
    root.render(
      React.createElement(OutcomeTracker, {
        ...defaultProps(),
        overrideField: 'fit',
        overrideValue: '91',
        overrideRationale: 'Test',
        setOverrideField,
        setOverrideValue,
        setOverrideRationale,
      }),
    );
    await waitFor(() => queryByRole(container, 'button', { name: 'Cancel' }) !== null);
    getByRole(container, 'button', { name: 'Cancel' }).click();
    expect(setOverrideField).toHaveBeenCalledWith(null);
    expect(setOverrideValue).toHaveBeenCalledWith('');
    expect(setOverrideRationale).toHaveBeenCalledWith('');
  });

  it('renders audit trail section with events', async () => {
    root.render(React.createElement(OutcomeTracker, defaultProps()));
    await waitFor(() => queryByText(container, 'Audit Trail') !== null);
    expect(container.textContent).toContain('fit-override');
    expect(container.textContent).toContain('Operator');
  });

  it('limits audit events to 10', async () => {
    const manyEvents: AuditEvent[] = Array.from({ length: 15 }, (_, i) => ({
      id: `evt-${i}`,
      entityId: 'g1',
      entityType: 'grant',
      eventType: `event-${i}`,
      actorLabel: `Actor ${i}`,
      timestamp: `2026-05-${23 + i}T12:00:00.000Z`,
    }));
    root.render(
      React.createElement(OutcomeTracker, { ...defaultProps(), auditEvents: manyEvents }),
    );
    await waitFor(() => getAllByRole(container, 'listitem').length === 10);
  });

  it('renders empty audit trail without errors', async () => {
    root.render(React.createElement(OutcomeTracker, { ...defaultProps(), auditEvents: [] }));
    await waitFor(() => queryByText(container, 'Audit Trail') !== null);
    expect(getAllByRole(container, 'listitem').length).toBe(0);
  });
});
