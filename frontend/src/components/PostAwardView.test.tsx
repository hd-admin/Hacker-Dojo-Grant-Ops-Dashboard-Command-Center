// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import PostAwardView from './PostAwardView';

describe('PostAwardView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ awards: [], alerts: [], events: [] }),
        ok: true,
      } as Response)
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders empty state when no awards', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(PostAwardView, null));
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector('[data-testid="post-award-view"]')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
