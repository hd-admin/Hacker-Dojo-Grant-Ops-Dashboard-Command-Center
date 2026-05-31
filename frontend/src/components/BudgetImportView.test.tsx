// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { BudgetImportView } from './BudgetImportView';

function renderBudgetImport(props: React.ComponentProps<typeof BudgetImportView>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(React.createElement(BudgetImportView, props));
  return { container, root };
}

describe('BudgetImportView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders drop zone', async () => {
    const { container, root } = renderBudgetImport({ awardId: 'award-1' });
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="budget-import-view"]')).not.toBeNull();
    expect(container.textContent).toContain('Drag and drop');
    root.unmount();
    container.remove();
  });

  it('shows file input on click', async () => {
    const { container, root } = renderBudgetImport({ awardId: 'award-1' });
    await new Promise((r) => setTimeout(r, 50));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.style.display).toBe('none');
    root.unmount();
    container.remove();
  });

  it('calls onUpload when file is selected', async () => {
    const onUpload = vi.fn();
    const { container, root } = renderBudgetImport({ awardId: 'award-1', onUpload });
    await new Promise((r) => setTimeout(r, 50));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const file = new File(['category,amount\nTest,100'], 'test.csv', { type: 'text/csv' });
    Object.defineProperty(input!, 'files', { value: [file], writable: false });
    input!.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(onUpload).toHaveBeenCalledWith('award-1', file);
    root.unmount();
    container.remove();
  });

  it('has accessible drop zone with keyboard support', async () => {
    const { container, root } = renderBudgetImport({ awardId: 'award-1' });
    await new Promise((r) => setTimeout(r, 50));
    const dropZone = container.querySelector('[role="button"]') as HTMLElement | null;
    expect(dropZone).not.toBeNull();
    expect(dropZone?.getAttribute('aria-label')).toContain('Drop budget file');
    expect(dropZone?.tabIndex).toBe(0);
    root.unmount();
    container.remove();
  });
});
