// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { AuditEvent, GrantDetailResponse } from '../../../../shared/types';
import { OutcomeTracker } from './OutcomeTracker';

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
    await waitFor(() => container.querySelector('h3') !== null);
    expect(container.textContent).toContain('Human overrides');
  });

  it('shows override buttons', async () => {
    root.render(React.createElement(OutcomeTracker, defaultProps()));
    await waitFor(() => container.querySelector("[data-testid='override-fit-score-btn']") !== null);
    const buttonTexts = Array.from(container.querySelectorAll('.drawer-actions button')).map(
      (b) => b.textContent,
    );
    expect(buttonTexts).toContain('Override fit score');
    expect(buttonTexts).toContain('Override category');
    expect(buttonTexts).toContain('Override status');
  });

  it('opens override panel when override-fit-score-btn is clicked', async () => {
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
    await waitFor(() => container.querySelector("[data-testid='override-fit-score-btn']") !== null);
    (
      container.querySelector("[data-testid='override-fit-score-btn']") as HTMLButtonElement
    )?.click();
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
    await waitFor(() => container.textContent?.includes('Override category') === true);
    (
      Array.from(container.querySelectorAll('.drawer-actions button')).find(
        (btn) => btn.textContent === 'Override category',
      ) as HTMLButtonElement
    )?.click();
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
    await waitFor(() => container.textContent?.includes('Override status') === true);
    (
      Array.from(container.querySelectorAll('.drawer-actions button')).find(
        (btn) => btn.textContent === 'Override status',
      ) as HTMLButtonElement
    )?.click();
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
    await waitFor(() => container.querySelector('.override-panel') !== null);
    expect(container.querySelector('.override-panel')?.textContent).toContain(
      'Provide a rationale before saving.',
    );
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
    await waitFor(() => container.querySelector('.override-panel') !== null);
    const buttonTexts = Array.from(container.querySelectorAll('.override-panel button')).map(
      (b) => b.textContent,
    );
    expect(buttonTexts).toContain('Save override');
    expect(buttonTexts).toContain('Cancel');
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
    await waitFor(() => container.textContent?.includes('Save override') === true);
    (
      Array.from(container.querySelectorAll('.override-panel button')).find(
        (btn) => btn.textContent === 'Save override',
      ) as HTMLButtonElement
    )?.click();
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
    await waitFor(() => container.textContent?.includes('Cancel') === true);
    (
      Array.from(container.querySelectorAll('.override-panel button')).find(
        (btn) => btn.textContent === 'Cancel',
      ) as HTMLButtonElement
    )?.click();
    expect(setOverrideField).toHaveBeenCalledWith(null);
    expect(setOverrideValue).toHaveBeenCalledWith('');
    expect(setOverrideRationale).toHaveBeenCalledWith('');
  });

  it('renders audit trail section with events', async () => {
    root.render(React.createElement(OutcomeTracker, defaultProps()));
    await waitFor(() => container.textContent?.includes('Audit Trail') === true);
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
    await waitFor(() => container.querySelectorAll('.activity-item').length === 10);
  });

  it('renders empty audit trail without errors', async () => {
    root.render(React.createElement(OutcomeTracker, { ...defaultProps(), auditEvents: [] }));
    await waitFor(() => container.textContent?.includes('Audit Trail') === true);
    expect(container.querySelectorAll('.activity-item').length).toBe(0);
  });
});
