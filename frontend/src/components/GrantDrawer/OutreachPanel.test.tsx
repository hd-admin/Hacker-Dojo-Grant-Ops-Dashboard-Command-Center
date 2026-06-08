// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { OutreachPanel, type OutreachRecord } from './OutreachPanel';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const FIXED_NOW = new Date('2026-06-08T12:00:00Z');

function makeRecord(overrides: Partial<OutreachRecord> = {}): OutreachRecord {
  return {
    id: 'out-1',
    grantId: 'g1',
    contactName: 'Jane Program Officer',
    contactEmail: 'jane@acme.org',
    method: 'email',
    notes: 'Initial inquiry',
    outcome: 'no-response',
    followUpDate: '',
    createdAt: '2026-05-20T13:00:00.000Z',
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
});

describe('OutreachPanel', () => {
  const defaultProps = () => ({
    outreach: [] as OutreachRecord[],
    outreachLoading: false,
    showOutreachForm: false,
    setShowOutreachForm: vi.fn(),
    newContactName: '',
    setNewContactName: vi.fn(),
    newContactEmail: '',
    setNewContactEmail: vi.fn(),
    newMethod: 'email' as const,
    setNewMethod: vi.fn(),
    newNotes: '',
    setNewNotes: vi.fn(),
    newOutcome: '' as const,
    setNewOutcome: vi.fn(),
    newFollowUpDate: '',
    setNewFollowUpDate: vi.fn(),
    handleCreateOutreach: vi.fn(async () => {}),
    handleDeleteOutreach: vi.fn(async (_id: string) => {}),
    now: FIXED_NOW,
  });

  it('renders the outreach section heading', async () => {
    root.render(React.createElement(OutreachPanel, defaultProps()));
    await waitFor(() => container.querySelector('h3') !== null);
    expect(container.querySelector('h3')?.textContent).toBe('Outreach');
  });

  it('shows the log-outreach button with accessible label', async () => {
    root.render(React.createElement(OutreachPanel, defaultProps()));
    await waitFor(() => container.querySelector("[aria-label='Log outreach']") !== null);
  });

  it('toggles the form display when the add button is clicked', async () => {
    const setShowOutreachForm = vi.fn();
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), setShowOutreachForm }));
    await waitFor(() => container.querySelector("[data-testid='add-outreach-btn']") !== null);
    (container.querySelector("[data-testid='add-outreach-btn']") as HTMLButtonElement)?.click();
    expect(setShowOutreachForm).toHaveBeenCalledWith(true);
  });

  it('shows the form when showOutreachForm is true', async () => {
    root.render(
      React.createElement(OutreachPanel, { ...defaultProps(), showOutreachForm: true }),
    );
    await waitFor(() => container.querySelector("[data-testid='outreach-create-form']") !== null);
    expect(container.querySelector("input[aria-label='Contact name']")).not.toBeNull();
    expect(container.querySelector("input[aria-label='Contact email']")).not.toBeNull();
    expect(container.querySelector("select[aria-label='Contact method']")).not.toBeNull();
    expect(container.querySelector("select[aria-label='Response status']")).not.toBeNull();
    expect(container.querySelector("textarea[aria-label='Outreach notes']")).not.toBeNull();
  });

  it('disables the save button when contact name is empty', async () => {
    root.render(
      React.createElement(OutreachPanel, {
        ...defaultProps(),
        showOutreachForm: true,
        newContactName: '',
      }),
    );
    await waitFor(() => container.querySelector("[data-testid='save-outreach-btn']") !== null);
    expect(
      (container.querySelector("[data-testid='save-outreach-btn']") as HTMLButtonElement)
        ?.disabled,
    ).toBe(true);
  });

  it('enables the save button when contact name is non-empty', async () => {
    root.render(
      React.createElement(OutreachPanel, {
        ...defaultProps(),
        showOutreachForm: true,
        newContactName: 'Jane PO',
      }),
    );
    await waitFor(() => container.querySelector("[data-testid='save-outreach-btn']") !== null);
    expect(
      (container.querySelector("[data-testid='save-outreach-btn']") as HTMLButtonElement)
        ?.disabled,
    ).toBe(false);
  });

  it('closes the form when Escape is pressed', async () => {
    const setShowOutreachForm = vi.fn();
    root.render(
      React.createElement(OutreachPanel, {
        ...defaultProps(),
        showOutreachForm: true,
        setShowOutreachForm,
      }),
    );
    await waitFor(() => container.querySelector("[data-testid='outreach-create-form']") !== null);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(setShowOutreachForm).toHaveBeenCalledWith(false);
  });

  it('shows loading state when outreach is loading', async () => {
    root.render(
      React.createElement(OutreachPanel, { ...defaultProps(), outreachLoading: true }),
    );
    await waitFor(() => container.textContent?.includes('Loading outreach...') === true);
  });

  it('shows empty state when no outreach records exist', async () => {
    root.render(React.createElement(OutreachPanel, defaultProps()));
    await waitFor(() => container.textContent?.includes('No outreach logged yet') === true);
  });

  it('renders outreach items with the contact name', async () => {
    const outreach = [makeRecord()];
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach }));
    await waitFor(() => container.querySelector("[data-testid='outreach-item-out-1']") !== null);
    expect(container.querySelector("[data-testid='outreach-item-out-1']")?.textContent).toContain(
      'Jane Program Officer',
    );
  });

  it('uses role="list" on the list container and role="listitem" on each item', async () => {
    const outreach = [makeRecord(), makeRecord({ id: 'out-2', contactName: 'Bob' })];
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach }));
    await waitFor(() => container.querySelector("[data-testid='outreach-list']") !== null);
    const list = container.querySelector("[data-testid='outreach-list']");
    expect(list?.getAttribute('role')).toBe('list');
    const items = container.querySelectorAll("[role='listitem']");
    expect(items.length).toBe(2);
  });

  it('shows the OVERDUE badge when an awaiting-reply record is older than 14 days', async () => {
    const old = makeRecord({
      id: 'out-old',
      createdAt: '2026-05-01T13:00:00.000Z',
      outcome: 'no-response',
    });
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach: [old] }));
    await waitFor(
      () => container.querySelector("[data-testid='outreach-overdue-badge-out-old']") !== null,
    );
    expect(
      container.querySelector("[data-testid='outreach-overdue-badge-out-old']")?.textContent,
    ).toBe('Overdue');
  });

  it('does not show the overdue badge for a confirmed record even after 14 days', async () => {
    const confirmed = makeRecord({
      id: 'out-confirmed',
      createdAt: '2026-05-01T13:00:00.000Z',
      outcome: 'positive',
    });
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach: [confirmed] }));
    await waitFor(() => container.querySelector("[data-testid='outreach-item-out-confirmed']") !== null);
    expect(
      container.querySelector("[data-testid='outreach-overdue-badge-out-confirmed']"),
    ).toBeNull();
  });

  it('does not show overdue for a record younger than 14 days', async () => {
    const fresh = makeRecord({
      id: 'out-fresh',
      createdAt: '2026-06-01T13:00:00.000Z',
      outcome: 'no-response',
    });
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach: [fresh] }));
    await waitFor(() => container.querySelector("[data-testid='outreach-item-out-fresh']") !== null);
    expect(
      container.querySelector("[data-testid='outreach-overdue-badge-out-fresh']"),
    ).toBeNull();
  });

  it('calls handleDeleteOutreach when the delete button is clicked', async () => {
    const handleDeleteOutreach = vi.fn(async () => {});
    const outreach = [makeRecord()];
    root.render(
      React.createElement(OutreachPanel, { ...defaultProps(), outreach, handleDeleteOutreach }),
    );
    await waitFor(
      () => container.querySelector("[data-testid='delete-outreach-btn-out-1']") !== null,
    );
    (
      container.querySelector("[data-testid='delete-outreach-btn-out-1']") as HTMLButtonElement
    )?.click();
    expect(handleDeleteOutreach).toHaveBeenCalledWith('out-1');
  });

  it('shows the delete button with an accessible label', async () => {
    const outreach = [makeRecord()];
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach }));
    await waitFor(
      () =>
        container.querySelector('[aria-label=\'Delete outreach to "Jane Program Officer"\']') !==
        null,
    );
  });

  it('calls handleCreateOutreach when the save button is clicked', async () => {
    const handleCreateOutreach = vi.fn(async () => {});
    root.render(
      React.createElement(OutreachPanel, {
        ...defaultProps(),
        showOutreachForm: true,
        newContactName: 'Alice',
        handleCreateOutreach,
      }),
    );
    await waitFor(() => container.querySelector("[data-testid='save-outreach-btn']") !== null);
    (container.querySelector("[data-testid='save-outreach-btn']") as HTMLButtonElement)?.click();
    expect(handleCreateOutreach).toHaveBeenCalled();
  });

  it('uses Confirmed label for positive outcome', async () => {
    const record = makeRecord({ id: 'out-c', outcome: 'positive' });
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach: [record] }));
    await waitFor(() => container.textContent?.includes('Confirmed') === true);
  });

  it('uses Declined label for negative outcome', async () => {
    const record = makeRecord({ id: 'out-d', outcome: 'negative' });
    root.render(React.createElement(OutreachPanel, { ...defaultProps(), outreach: [record] }));
    await waitFor(() => container.textContent?.includes('Declined') === true);
  });
});
