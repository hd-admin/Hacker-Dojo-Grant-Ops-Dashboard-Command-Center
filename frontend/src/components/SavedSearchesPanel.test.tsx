// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, queryByRole, queryByText } from '../test-helpers';
import { SavedSearchesPanel } from './SavedSearchesPanel';

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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.restoreAllMocks();
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe('SavedSearchesPanel', () => {
  it('renders empty state when no saved searches', async () => {
    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch: () => {},
      }),
    );
    await waitFor(() => queryByText(container, 'No saved searches yet') !== null);
    expect(queryByText(container, 'No saved searches yet')).not.toBeNull();
  });

  it('renders saved search cards when data is loaded', async () => {
    const mockSearches = [
      {
        id: 'ss-1',
        name: 'NSF Grants',
        queryText: 'NSF',
        filters: {},
        newResultsCount: 3,
        lastCheckedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSearches,
    } as Response);

    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch: () => {},
      }),
    );

    await waitFor(
      () => queryByRole(container, 'button', { name: 'Run saved search NSF Grants' }) !== null,
    );
    expect(container.textContent).toContain('NSF Grants');
    expect(container.textContent).toContain('NSF');
    expect(container.textContent).toContain('3 new');

    fetchMock.mockRestore();
  });

  it('shows save search input when Save current search is clicked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch: () => {},
      }),
    );

    await waitFor(() => queryByText(container, 'No saved searches yet') !== null);

    const saveBtn = getByRole(container, 'button', { name: 'Save current search' });
    expect(saveBtn).not.toBeNull();
    saveBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(
      () => queryByRole(container, 'textbox', { name: 'Name for saved search' }) !== null,
    );
    expect(getByRole(container, 'textbox', { name: 'Name for saved search' })).not.toBeNull();

    fetchMock.mockRestore();
  });

  it('calls onRunSearch when Run button is clicked', async () => {
    const mockSearches = [
      {
        id: 'ss-1',
        name: 'NSF Grants',
        queryText: 'NSF',
        filters: {},
        newResultsCount: 0,
        lastCheckedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSearches,
    } as Response);

    const onRunSearch = vi.fn();
    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch,
      }),
    );

    await waitFor(
      () => queryByRole(container, 'button', { name: 'Run saved search NSF Grants' }) !== null,
    );
    const runBtn = getByRole(container, 'button', { name: 'Run saved search NSF Grants' });
    runBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onRunSearch).toHaveBeenCalledWith('NSF');

    fetchMock.mockRestore();
  });

  it('enters edit mode when Edit button is clicked', async () => {
    const mockSearches = [
      {
        id: 'ss-1',
        name: 'NSF Grants',
        queryText: 'NSF',
        filters: {},
        newResultsCount: 0,
        lastCheckedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSearches,
    } as Response);

    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch: () => {},
      }),
    );

    await waitFor(
      () => queryByRole(container, 'button', { name: 'Edit saved search NSF Grants' }) !== null,
    );
    const editBtn = getByRole(container, 'button', { name: 'Edit saved search NSF Grants' });
    editBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => queryByRole(container, 'textbox', { name: 'Edit search name' }) !== null);
    expect(getByRole(container, 'textbox', { name: 'Edit search name' })).not.toBeNull();

    fetchMock.mockRestore();
  });

  it('collapses and expands when toggle is clicked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    root.render(
      React.createElement(SavedSearchesPanel, {
        currentSearchQuery: 'test',
        onRunSearch: () => {},
      }),
    );

    await waitFor(() => queryByText(container, 'No saved searches yet') !== null);

    const toggle = getByRole(container, 'button', { name: 'Collapse saved searches' });
    expect(toggle).not.toBeNull();
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => queryByText(container, 'No saved searches yet') === null);
    expect(queryByText(container, 'No saved searches yet')).toBeNull();

    const expandToggle = getByRole(container, 'button', { name: 'Expand saved searches' });
    expect(expandToggle).not.toBeNull();

    fetchMock.mockRestore();
  });
});
