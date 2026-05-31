// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import BudgetVsActualReport from './BudgetVsActualReport';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('BudgetVsActualReport', () => {
  const mockAward = {
    id: 'award-1',
    grantId: 'grant-1',
    funder: 'Test Foundation',
    title: 'Community Grant',
    amount: 100000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active' as const,
    awardLetterPath: '',
    notes: '',
    createdAt: '2026-01-01',
  };

  const mockCategories = [
    { id: 'cat-1', awardId: 'award-1', category: 'Personnel', budgeted: 50000, spent: 0 },
    { id: 'cat-2', awardId: 'award-1', category: 'Equipment', budgeted: 30000, spent: 0 },
    { id: 'cat-3', awardId: 'award-1', category: 'Travel', budgeted: 20000, spent: 0 },
  ];

  const mockExpenses = [
    { id: 'exp-1', awardId: 'award-1', categoryId: 'cat-1', amount: 25000, date: '2026-02-01', description: 'Salaries' },
    { id: 'exp-2', awardId: 'award-1', categoryId: 'cat-1', amount: 10000, date: '2026-03-01', description: 'Benefits' },
    { id: 'exp-3', awardId: 'award-1', categoryId: 'cat-2', amount: 15000, date: '2026-02-15', description: 'Computers' },
  ];

  it('renders with minimal props', async () => {
    root.render(
      <BudgetVsActualReport
        award={mockAward}
        budgetCategories={mockCategories}
        expenses={mockExpenses}
        periodStart="2026-01-01"
        periodEnd="2026-12-31"
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="budget-vs-actual-report"]') !== null);
    expect(container.textContent).toContain('Budget vs. Actual Report');
    expect(container.textContent).toContain('Personnel');
    expect(container.textContent).toContain('Equipment');
  });

  it('shows empty categories with zero spent', async () => {
    root.render(
      <BudgetVsActualReport
        award={mockAward}
        budgetCategories={mockCategories}
        expenses={[]}
        periodStart="2026-01-01"
        periodEnd="2026-12-31"
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="budget-vs-actual-report"]') !== null);
    expect(container.textContent).toContain('Total Spent: $0');
  });

  it('calculates variance correctly', async () => {
    root.render(
      <BudgetVsActualReport
        award={mockAward}
        budgetCategories={mockCategories}
        expenses={mockExpenses}
        periodStart="2026-01-01"
        periodEnd="2026-12-31"
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="budget-vs-actual-report"]') !== null);
    expect(container.textContent).toContain('Total Budgeted: $100,000');
    expect(container.textContent).toContain('Total Spent: $50,000');
    expect(container.textContent).toContain('Remaining: $50,000');
  });

  it('triggers CSV export on button click', async () => {
    const clickSpy = vi.fn();
    const createElementOrig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElementOrig(tag);
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: vi.fn() });

    root.render(
      <BudgetVsActualReport
        award={mockAward}
        budgetCategories={mockCategories}
        expenses={mockExpenses}
        periodStart="2026-01-01"
        periodEnd="2026-12-31"
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="budget-vs-actual-report"]') !== null);

    const exportBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Export CSV'));
    expect(exportBtn).toBeDefined();
    exportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
