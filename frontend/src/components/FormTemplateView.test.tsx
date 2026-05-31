// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import FormTemplateView from './FormTemplateView';

describe('FormTemplateView', () => {
  it('renders form template', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(FormTemplateView, {
        template: {
          id: 't1',
          funderName: 'Test Funder',
          fields: [
            { id: 'f1', label: 'Mission Statement', type: 'textarea', suggestedAnswer: 'We help...' },
          ],
        },
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="form-template-view"]')).not.toBeNull();
    expect(container.textContent).toContain('Test Funder');
    root.unmount();
    container.remove();
  });
});
