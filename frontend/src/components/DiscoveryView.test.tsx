import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant, Source } from '../../../shared/types';

const { grantsGetAll, sourcesAdd, sourcesGetAll, sourcesRemove, researchTrigger, researchGetRuns, onGrantSelect, onRefreshAppState } = vi.hoisted(() => ({
  grantsGetAll: vi.fn(),
  sourcesAdd: vi.fn(),
  sourcesGetAll: vi.fn(),
  sourcesRemove: vi.fn(),
  researchTrigger: vi.fn(),
  researchGetRuns: vi.fn(),
  onGrantSelect: vi.fn(),
  onRefreshAppState: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: grantsGetAll },
    sources: { add: sourcesAdd, getAll: sourcesGetAll, remove: sourcesRemove },
    research: { trigger: researchTrigger, getRuns: researchGetRuns },
  },
}));

import DiscoveryView from './DiscoveryView';

const initialGrants: Grant[] = [
  {
    id: 'nsf-tech',
    title: 'NSF Technology Access Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Science & Tech', 'Federal', 'EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
  },
];

const refreshedGrants: Grant[] = [
  ...initialGrants,
  {
    id: 'candid-community',
    title: 'Candid Community Innovation Fund',
    funder: 'Candid',
    funderShort: 'Candid',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 82,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-23',
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  grantsGetAll.mockReset();
  sourcesAdd.mockReset();
  sourcesGetAll.mockReset();
  sourcesRemove.mockReset();
  researchTrigger.mockReset();
  researchGetRuns.mockReset();
  onGrantSelect.mockReset();
  onRefreshAppState.mockReset();

  grantsGetAll.mockResolvedValueOnce(initialGrants).mockResolvedValue(refreshedGrants);
  sourcesAdd.mockResolvedValue({ success: true, source: { id: 'source-1' } });
  sourcesGetAll.mockResolvedValue([]);
  sourcesRemove.mockResolvedValue({ success: true });
  researchTrigger.mockResolvedValue({ success: true, sourcesCrawled: 1 });
  researchGetRuns.mockResolvedValue({
    latestRun: { id: 'run-0', status: 'completed', sourcesCrawled: 0, grantsFound: 0, grantsMatched: 0, startedAt: new Date().toISOString() },
    allRuns: [],
  });

  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.unstubAllGlobals();
});

describe('DiscoveryView', () => {
  it('renders persisted grants and refreshes after adding a source and crawling', async () => {
    root.render(React.createElement(DiscoveryView, { onGrantSelect, onRefreshAppState }));
    await waitFor(() => container.querySelectorAll('.grants-row:not(.header)').length === 1);
    expect(container.textContent).toContain('NSF Technology Access Grant');

    (container.querySelector('button.btn-primary') as HTMLButtonElement | null)?.click();
    await waitFor(() => container.querySelector('input[placeholder="Source name"]') !== null);

    const nameInput = container.querySelector('input[placeholder="Source name"]') as HTMLInputElement;
    const urlInput = container.querySelector('input[placeholder="https://..."]') as HTMLInputElement;
    const addButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    setInputValue(nameInput, 'Candid');
    setInputValue(urlInput, 'https://www.candid.org');
    await waitFor(() => addButton.disabled === false);

    addButton.click();
    await waitFor(() => container.querySelectorAll('.grants-row:not(.header)').length === 2);

    expect(sourcesAdd).toHaveBeenCalledWith({ name: 'Candid', url: 'https://www.candid.org', type: 'website', reviewStatus: 'pending-review' });
    // Note: researchTrigger is NOT called automatically when adding a source.
    // Sources enter pending-review status and must be approved before research runs.
    expect(researchTrigger).not.toHaveBeenCalled();
    expect(onRefreshAppState).toHaveBeenCalledTimes(1);
    expect(grantsGetAll).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Candid Community Innovation Fund');

    container.querySelector('.grants-row:not(.header)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onGrantSelect).toHaveBeenCalledWith('nsf-tech');
  });

  it('deletes a source and updates the UI', async () => {
    const testSource: Source = {
      id: 'src-1',
      name: 'Candid',
      url: 'https://www.candid.org',
      type: 'website',
      createdAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
      sourceCrawlState: 'never-crawled',
      crawlAccessCategory: 'crawlable',
    };
    sourcesGetAll.mockResolvedValueOnce([testSource]).mockResolvedValue([]);
    grantsGetAll.mockResolvedValueOnce(initialGrants).mockResolvedValue(initialGrants);
    
    root.render(React.createElement(DiscoveryView, { onGrantSelect, onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Candid') === true);
    
    const deleteButton = container.querySelector('.source-item button') as HTMLButtonElement;
    deleteButton.click();
    
    await waitFor(() => sourcesRemove.mock.calls.length > 0);
    expect(sourcesRemove).toHaveBeenCalledWith('src-1');
  });
});
