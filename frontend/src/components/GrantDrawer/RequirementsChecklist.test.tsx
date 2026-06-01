// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { ChecklistItem } from '../../../../shared/types';
import { RequirementsChecklist } from './RequirementsChecklist';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeChecklist(): ChecklistItem[] {
  return [
    { label: 'Funder summary captured', done: true, source: 'Research' },
    { label: 'Fit review documented', done: true, source: 'Scoring' },
    { label: 'Draft preview ready', done: false, source: 'Drafting' },
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

describe('RequirementsChecklist', () => {
  it('renders all checklist items with labels and sources', async () => {
    const checklist = makeChecklist();
    root.render(React.createElement(RequirementsChecklist, { checklist }));
    await waitFor(() => container.querySelectorAll('.checklist-item').length === 3);

    expect(container.textContent).toContain('Funder summary captured');
    expect(container.textContent).toContain('Research');
    expect(container.textContent).toContain('Fit review documented');
    expect(container.textContent).toContain('Scoring');
    expect(container.textContent).toContain('Draft preview ready');
    expect(container.textContent).toContain('Drafting');
  });

  it('renders the section heading with accessible text', async () => {
    const checklist = makeChecklist();
    root.render(React.createElement(RequirementsChecklist, { checklist }));
    await waitFor(() => container.querySelector('h3') !== null);
    expect(container.querySelector('h3')?.textContent).toBe('Requirements checklist');
  });

  it("marks done items with the 'done' class", async () => {
    const checklist = makeChecklist();
    root.render(React.createElement(RequirementsChecklist, { checklist }));
    await waitFor(() => container.querySelectorAll('.checklist-item').length === 3);
    expect(container.querySelectorAll('.checklist-item.done').length).toBe(2);
  });

  it('does not mark incomplete items as done', async () => {
    const checklist = makeChecklist();
    root.render(React.createElement(RequirementsChecklist, { checklist }));
    await waitFor(() => container.querySelectorAll('.checklist-item').length === 3);
    const items = container.querySelectorAll('.checklist-item:not(.done)');
    expect(items.length).toBe(1);
    expect(items[0]?.textContent).toContain('Draft preview ready');
  });

  it('renders empty checklist without errors', async () => {
    root.render(React.createElement(RequirementsChecklist, { checklist: [] }));
    await waitFor(() => container.querySelector('.checklist-list') !== null);
    expect(container.textContent).toContain('Requirements checklist');
    expect(container.querySelectorAll('.checklist-item').length).toBe(0);
  });

  it('shows checkmark character for done items and circle for pending', async () => {
    const checklist = makeChecklist();
    root.render(React.createElement(RequirementsChecklist, { checklist }));
    await waitFor(() => container.querySelectorAll('.checklist-item').length === 3);
    const items = container.querySelectorAll('.checklist-item');
    expect(items[0]?.textContent).toContain('\u2713');
    expect(items[1]?.textContent).toContain('\u2713');
    expect(items[2]?.textContent).toContain('\u25CB');
  });
});
