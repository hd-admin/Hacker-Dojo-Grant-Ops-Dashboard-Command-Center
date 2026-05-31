// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import BudgetImportView from './BudgetImportView';

describe('BudgetImportView', () => {
  it('renders drop zone', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(BudgetImportView, {
        awardId: 'award-1',
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="budget-import-view"]')).not.toBeNull();
    expect(container.textContent).toContain('Drag and drop');
    root.unmount();
    container.remove();
  });
});
