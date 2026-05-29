// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant } from '../../../shared/types';

const { grantsGetAll } = vi.hoisted(() => ({
  grantsGetAll: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: grantsGetAll },
    themes: {
      get: vi.fn().mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] }),
      update: vi.fn().mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] }),
      rescore: vi.fn().mockResolvedValue({ success: true, rescored: 0 }),
    },
  },
}));

import PipelineView from './PipelineView';

const grants: Grant[] = [
  {
    id: 'grant-1',
    title: 'NSF Technology Access Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Science & Tech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
  },
];

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  grantsGetAll.mockReset();
  grantsGetAll.mockResolvedValue(grants);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('PipelineView', () => {
  it('renders grants and shows Export CSV button', async () => {
    root.render(React.createElement(PipelineView, { onGrantSelect: vi.fn() }));
    await waitFor(() => container.textContent?.includes('NSF Technology Access Grant') === true);

    const exportBtn = container.querySelector('[aria-label="Export pipeline as CSV"]');
    expect(exportBtn).not.toBeNull();
    expect(exportBtn?.textContent).toContain('Export CSV');
  });

  it('Export CSV button triggers a download link click', async () => {
    const linkClicks: string[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement('a') as HTMLAnchorElement;
        vi.spyOn(anchor, 'click').mockImplementation(() => {
          linkClicks.push(anchor.href);
        });
        return anchor;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    root.render(React.createElement(PipelineView, { onGrantSelect: vi.fn() }));
    await waitFor(() => container.textContent?.includes('NSF Technology Access Grant') === true);

    const exportBtn = container.querySelector('[aria-label="Export pipeline as CSV"]') as HTMLButtonElement;
    expect(exportBtn).not.toBeNull();
    exportBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => linkClicks.length > 0);
    expect(linkClicks.some((href) => href.includes('export'))).toBe(true);
  });
});
