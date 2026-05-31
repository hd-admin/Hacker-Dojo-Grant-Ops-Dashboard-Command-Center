// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { PipelineBoard } from './PipelineBoard';

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
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('PipelineBoard', () => {
  const mockGrants = [
    {
      id: 'grant-1',
      title: 'NSF Grant',
      funder: 'National Science Foundation',
      funderShort: 'NSF',
      award: '$350,000',
      awardSort: 350000,
      deadline: '2026-06-15',
      daysOut: 25,
      fit: 88,
      tags: ['Science'],
      status: 'matched' as const,
      statusLabel: 'Matched',
      matchedAt: '2026-05-19',
    },
    {
      id: 'grant-2',
      title: 'Community Fund',
      funder: 'Candid',
      funderShort: 'Candid',
      award: '$75,000',
      awardSort: 75000,
      deadline: 'Rolling',
      daysOut: 0,
      fit: 82,
      tags: ['Community'],
      status: 'draft' as const,
      statusLabel: 'Draft',
      matchedAt: '2026-05-23',
    },
  ];

  it('renders pipeline columns', async () => {
    root.render(
      <PipelineBoard
        grants={mockGrants}
        onSelectGrant={vi.fn()}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="pipeline-board"]') !== null);
    expect(container.querySelector('[data-testid="pipeline-column-matched"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pipeline-column-draft"]')).not.toBeNull();
  });

  it('shows grant cards in correct columns', async () => {
    root.render(
      <PipelineBoard
        grants={mockGrants}
        onSelectGrant={vi.fn()}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="pipeline-board"]') !== null);
    expect(container.querySelector('[data-testid="pipeline-card-grant-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pipeline-card-grant-2"]')).not.toBeNull();
    expect(container.textContent).toContain('NSF Grant');
    expect(container.textContent).toContain('Community Fund');
  });

  it('shows empty state for columns with no grants', async () => {
    root.render(
      <PipelineBoard
        grants={[]}
        onSelectGrant={vi.fn()}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="pipeline-board"]') !== null);
    expect(container.textContent).toContain('No grants');
  });

  it('calls onSelectGrant when card is clicked', async () => {
    const onSelectGrant = vi.fn();
    root.render(
      <PipelineBoard
        grants={mockGrants}
        onSelectGrant={onSelectGrant}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await waitFor(() => container.querySelector('[data-testid="pipeline-board"]') !== null);
    const card = container.querySelector('[data-testid="pipeline-card-grant-1"]');
    expect(card).not.toBeNull();
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelectGrant).toHaveBeenCalledWith('grant-1');
  });
});
