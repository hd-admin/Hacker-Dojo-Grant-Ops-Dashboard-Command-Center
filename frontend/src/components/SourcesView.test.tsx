import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Source, SourceDiscoverySuggestion } from '../../../shared/types';

const {
  onRefreshAppState,
} = vi.hoisted(() => ({
  onRefreshAppState: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({}));

import SourcesView from './SourcesView';

const mockSources: Source[] = [
  {
    id: 'src-1',
    name: 'Foundation A',
    url: 'https://foundation-a.example.org',
    reviewStatus: 'approved',
    category: 'foundation',
  },
  {
    id: 'src-2',
    name: 'Government Grant',
    url: 'https://gov.grants.example',
    reviewStatus: 'approved',
    category: 'government',
  },
];

const mockPendingSources: Source[] = [
  {
    id: 'pending-1',
    name: 'Pending Source 1',
    url: 'https://pending-1.example.org',
    reviewStatus: 'pending-review',
    suggestionReason: 'AI suggested this source',
    suggestedBy: 'ai',
    category: 'foundation',
  },
  {
    id: 'pending-2',
    name: 'Pending Source 2',
    url: 'https://pending-2.example.org',
    reviewStatus: 'pending-review',
    suggestionReason: 'Manually submitted',
    suggestedBy: 'human',
    category: 'corporate',
  },
];

const mockSuggestions: SourceDiscoverySuggestion[] = [
  {
    id: 'sug-1',
    name: 'Discovered Grant Source',
    url: 'https://discovered.example.org',
    type: 'grant',
    rationale: 'Highly relevant for community programs',
    confidence: 0.92,
  },
  {
    id: 'sug-2',
    name: 'Another Discovered Source',
    url: 'https://another.example.org',
    type: 'database',
    rationale: 'Good resource for technology education',
    confidence: 0.85,
  },
];

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
  onRefreshAppState.mockReset();

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/api/sources/discover')) {
      return new Response(JSON.stringify({
        suggestions: mockSuggestions,
        unavailable: false,
      }), { headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('/api/sources?filter=pending-review')) {
      return new Response(JSON.stringify(mockPendingSources), { headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('/api/sources')) {
      return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('/api/sources/')) {
      if (url.includes('/review')) {
        return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
    }

    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  }));

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SourcesView', () => {
  it('renders the header with "Sources" and "Review queue" text', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    expect(container.textContent).toContain('Sources');
    expect(container.textContent).toContain('Review queue');
  });

  it('shows pending sources count in header subtitle', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('2 sources awaiting review') === true);

    expect(container.textContent).toContain('2 sources awaiting review');
  });

  it('shows pending review section with approve/reject buttons when pending sources exist', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="approve-source-btn-pending-1"]') !== null);

    expect(container.textContent).toContain('Pending review');
    expect(container.textContent).toContain('Pending Source 1');
    expect(container.textContent).toContain('Pending Source 2');
    expect(container.querySelector('[data-testid="approve-source-btn-pending-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="approve-source-btn-pending-2"]')).not.toBeNull();
  });

  it('clicking "Discover Sources" button toggles the discovery form', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    const discoverBtn = container.querySelector('[data-testid="discover-sources-btn"]');
    expect(discoverBtn).not.toBeNull();

    expect(container.querySelector('[data-testid="discovery-prompt-input"]')).toBeNull();

    discoverBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="discovery-prompt-input"]') !== null);

    expect(container.querySelector('[data-testid="discovery-prompt-input"]')).not.toBeNull();

    discoverBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="discovery-prompt-input"]') === null);
  });

  it('submitting discovery with prompt shows discovery suggestions', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    const discoverBtn = container.querySelector('[data-testid="discover-sources-btn"]');
    discoverBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="discovery-prompt-input"]') !== null);

    const promptInput = container.querySelector('[data-testid="discovery-prompt-input"]') as HTMLTextAreaElement;
    promptInput.value = 'grants for makerspaces';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = container.querySelector('[data-testid="find-sources-submit-btn"]');
    submitBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.textContent?.includes('Discovered Grant Source') === true);

    expect(container.textContent).toContain('Discovered Grant Source');
    expect(container.textContent).toContain('Another Discovered Source');
    expect(container.textContent).toContain('Suggestions');
  });

  it('shows "discovery-unavailable-msg" when source discovery is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/sources/discover')) {
        return new Response(JSON.stringify({
          suggestions: [],
          unavailable: true,
        }), { headers: { 'content-type': 'application/json' } });
      }

      if (url.includes('/api/sources?filter=pending-review')) {
        return new Response(JSON.stringify(mockPendingSources), { headers: { 'content-type': 'application/json' } });
      }

      if (url.includes('/api/sources')) {
        return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
      }

      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    const discoverBtn = container.querySelector('[data-testid="discover-sources-btn"]');
    discoverBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="discovery-prompt-input"]') !== null);

    const promptInput = container.querySelector('[data-testid="discovery-prompt-input"]') as HTMLTextAreaElement;
    promptInput.value = 'grants for makerspaces';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = container.querySelector('[data-testid="find-sources-submit-btn"]');
    submitBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="discovery-unavailable-msg"]') !== null);

    expect(container.querySelector('[data-testid="discovery-unavailable-msg"]')).not.toBeNull();
    expect(container.textContent).toContain('Source discovery requires opencode. Configure it in Settings.');
  });

  it('approving a discovery suggestion calls the approve API', async () => {
    const fetchMock = vi.mocked(global.fetch as unknown as typeof fetch);

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    const discoverBtn = container.querySelector('[data-testid="discover-sources-btn"]');
    discoverBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="discovery-prompt-input"]') !== null);

    const promptInput = container.querySelector('[data-testid="discovery-prompt-input"]') as HTMLTextAreaElement;
    promptInput.value = 'grants for makerspaces';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = container.querySelector('[data-testid="find-sources-submit-btn"]');
    submitBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.textContent?.includes('Discovered Grant Source') === true);

    const approveSuggestionBtn = container.querySelector('[data-testid="approve-suggestion-btn"]');
    approveSuggestionBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => fetchMock.mock.calls.some(([url]) => String(url).includes('/api/sources')) === true);

    const sourcesApiCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/sources') && !String(url).includes('/filter=pending-review'));
    expect(sourcesApiCalls.length).toBeGreaterThan(0);
  });

  it('editing a source shows edit panel with save button', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="sources-pending-review-section"]') !== null);

    const editBtn = container.querySelector('[data-testid="edit-source-btn-pending-1"]');
    editBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => {
      const editPanel = container.querySelector('.edit-panel');
      return editPanel !== null && container.textContent?.includes('Save') === true;
    });

    expect(container.querySelector('.edit-panel')).not.toBeNull();
    expect(container.textContent).toContain('Save');
  });

  it('shows empty state "No sources pending review" when no pending sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/sources?filter=pending-review')) {
        return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      }

      if (url.includes('/api/sources')) {
        return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
      }

      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('0 sources awaiting review') === true);

    expect(container.textContent).toContain('No sources pending review');
  });
});

describe('ProPublica search section', () => {
  it('renders ProPublica search input and button', async () => {
    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Sources') === true);

    expect(container.querySelector('[data-testid="propublica-search-input"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="propublica-search-btn"]')).not.toBeNull();
  });

  it('shows propublica-unavailable-msg on unavailable response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('propublica')) {
        return new Response(JSON.stringify({ unavailable: true, grants: [] }), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources?filter=pending-review')) {
        return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources')) {
        return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="propublica-search-input"]') !== null);

    const input = container.querySelector('[data-testid="propublica-search-input"]') as HTMLInputElement;
    // Use native setter to bypass React's internal value tracking
    const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputSetter?.call(input, 'STEM education');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !(container.querySelector('[data-testid="propublica-search-btn"]') as HTMLButtonElement | null)?.disabled);

    const form = container.querySelector('.propublica-search-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="propublica-unavailable-msg"]') !== null);
    expect(container.querySelector('[data-testid="propublica-unavailable-msg"]')).not.toBeNull();
  });

  it('shows propublica-empty-results when grants array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('propublica')) {
        return new Response(JSON.stringify({ grants: [] }), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources?filter=pending-review')) {
        return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources')) {
        return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="propublica-search-input"]') !== null);

    const input = container.querySelector('[data-testid="propublica-search-input"]') as HTMLInputElement;
    const nativeInputSetter2 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputSetter2?.call(input, 'STEM education');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !(container.querySelector('[data-testid="propublica-search-btn"]') as HTMLButtonElement | null)?.disabled);

    const form = container.querySelector('.propublica-search-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="propublica-empty-results"]') !== null);
    expect(container.querySelector('[data-testid="propublica-empty-results"]')).not.toBeNull();
  });

  it('shows propublica-results-list when grants returned', async () => {
    const mockGrant = {
      id: 'pp-1',
      title: 'Test Grant',
      funder: 'SVCF',
      funderShort: 'SVCF',
      award: '$50,000',
      awardSort: 50000,
      deadline: 'Rolling',
      daysOut: 365,
      fit: 80,
      tags: [],
      status: 'matched',
      statusLabel: 'Matched',
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('propublica')) {
        return new Response(JSON.stringify({ grants: [mockGrant] }), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources?filter=pending-review')) {
        return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/sources')) {
        return new Response(JSON.stringify(mockSources), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(SourcesView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="propublica-search-input"]') !== null);

    const input = container.querySelector('[data-testid="propublica-search-input"]') as HTMLInputElement;
    const nativeInputSetter3 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputSetter3?.call(input, 'STEM education');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !(container.querySelector('[data-testid="propublica-search-btn"]') as HTMLButtonElement | null)?.disabled);

    const form = container.querySelector('.propublica-search-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="propublica-results-list"]') !== null);
    expect(container.querySelector('[data-testid="propublica-results-list"]')).not.toBeNull();
  });
});
