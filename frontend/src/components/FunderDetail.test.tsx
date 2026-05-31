// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import FunderDetail from './FunderDetail';

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

describe('FunderDetail', () => {
  const mockFunder = {
    id: 'funder-1',
    name: 'Test Foundation',
    type: 'foundation' as const,
    ein: '12-3456789',
    focusAreas: ['Education', 'Technology'],
    geographicFocus: ['California', 'National'],
    typicalAwardRange: { min: 10000, max: 100000 },
    givingHistory: [
      { year: 2025, totalGiving: 5000000, grantsCount: 50, averageGrantSize: 100000 },
      { year: 2024, totalGiving: 4500000, grantsCount: 45, averageGrantSize: 100000 },
    ],
    applicationProcess: 'Online application via website',
    deadlines: 'Rolling',
    sourceUrls: ['https://example.com'],
    lastUpdated: '2026-05-01',
  };

  it('renders funder details', async () => {
    const onClose = vi.fn();
    root.render(<FunderDetail funder={mockFunder} onClose={onClose} />);
    await waitFor(() => container.querySelector('[data-testid="funder-detail"]') !== null);
    expect(container.textContent).toContain('Test Foundation');
    expect(container.textContent).toContain('Foundation');
    expect(container.textContent).toContain('Education');
    expect(container.textContent).toContain('Technology');
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    root.render(<FunderDetail funder={mockFunder} onClose={onClose} />);
    await waitFor(() => container.querySelector('[data-testid="funder-detail"]') !== null);
    const closeBtn = container.querySelector('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders without optional fields', async () => {
    const minimalFunder = {
      ...mockFunder,
      ein: undefined,
      sourceUrls: [],
    };
    root.render(<FunderDetail funder={minimalFunder as unknown as typeof mockFunder} onClose={vi.fn()} />);
    await waitFor(() => container.querySelector('[data-testid="funder-detail"]') !== null);
    expect(container.textContent).toContain('Test Foundation');
  });

  it('triggers pattern detection when button clicked', async () => {
    const onDetectPatterns = vi.fn().mockResolvedValue(undefined);
    root.render(<FunderDetail funder={mockFunder} onClose={vi.fn()} onDetectPatterns={onDetectPatterns} />);
    await waitFor(() => container.querySelector('[data-testid="funder-detail"]') !== null);
    const detectBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Detect Hidden Patterns'),
    );
    expect(detectBtn).toBeDefined();
    detectBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => onDetectPatterns.mock.calls.length > 0);
    expect(onDetectPatterns).toHaveBeenCalledWith('funder-1');
  });
});
