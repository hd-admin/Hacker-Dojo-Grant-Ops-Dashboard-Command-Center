// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import PipelineView from './PipelineView';

describe('PipelineView', () => {
  it('renders empty state', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(PipelineView, {
        onGrantSelect: () => {},
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="pipeline-empty-state"]')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
