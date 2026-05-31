// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import SnippetsBrowser from './SnippetsBrowser';

describe('SnippetsBrowser', () => {
  it('renders snippets list', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(SnippetsBrowser, {
        snippets: [
          { id: 's1', title: 'Test Snippet', sourceGrant: 'Grant 1', funder: 'Funder A', topicTags: ['STEM'], usageCount: 5, content: 'Hello world' },
        ],
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="snippets-browser"]')).not.toBeNull();
    expect(container.textContent).toContain('Test Snippet');
    root.unmount();
    container.remove();
  });
});
