// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import DiffViewer from './DiffViewer';

describe('DiffViewer', () => {
  it('renders diff with additions and deletions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiffViewer, {
        oldText: 'Line 1\nLine 2\nLine 3',
        newText: 'Line 1\nLine 2 modified\nLine 3',
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="diff-viewer"]')).not.toBeNull();
    expect(container.textContent).toContain('Previous Version');
    expect(container.textContent).toContain('Current Version');
    root.unmount();
    container.remove();
  });
});
