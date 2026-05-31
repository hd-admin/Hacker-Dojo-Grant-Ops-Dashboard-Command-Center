// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import PostAwardView from './PostAwardView';

describe('PostAwardView', () => {
  it('renders empty state when no awards', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(PostAwardView, null));
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="post-award-view"]')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
