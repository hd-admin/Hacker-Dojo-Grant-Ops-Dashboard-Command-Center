// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getByText, queryByText } from '../test-helpers';
import { AppShellHealthBanner } from './AppShellHealthBanner';
import type { CrawlStatus, HealthCheckResult } from '../../../shared/types';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const FULLY_ONLINE_HEALTH: HealthCheckResult = {
  storage: 'ok',
  opencode: 'ok',
  crawlerStatus: 'ok',
  documentIndexer: 'ok',
};

const DEGRADED_HEALTH: HealthCheckResult = {
  storage: 'ok',
  opencode: 'error',
  crawlerStatus: 'ok',
  documentIndexer: 'ok',
};

const OFFLINE_HEALTH: HealthCheckResult = {
  storage: 'error',
  opencode: 'error',
  crawlerStatus: 'stale',
  documentIndexer: 'error',
  storageError: 'Database file is locked',
  opencodeError: 'OpenCode not reachable',
};

const HEALTHY_CRAWL: CrawlStatus = {
  online: true,
  lastSync: new Date().toISOString(),
};

function makeProps(
  overrides: Partial<React.ComponentProps<typeof AppShellHealthBanner>> = {},
): React.ComponentProps<typeof AppShellHealthBanner> {
  return {
    healthTier: 'fully_online',
    healthResult: FULLY_ONLINE_HEALTH,
    isCrawlStale: false,
    crawlStatus: HEALTHY_CRAWL,
    opencodeBlocked: false,
    hasStorageError: false,
    onRefreshHealth: vi.fn(),
    getRelativeTime: (iso: string) => `mock-time(${iso})`,
    ...overrides,
  };
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

describe('AppShellHealthBanner', () => {
  it('renders the fully_online tier with role="status" and a positive banner', async () => {
    const props = makeProps({
      healthTier: 'fully_online',
      healthResult: FULLY_ONLINE_HEALTH,
      opencodeBlocked: false,
    });
    root.render(React.createElement(AppShellHealthBanner, props));
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    const banner = container.querySelector('[data-testid="health-banner-online"]');
    expect(banner, 'online banner should be in the DOM').not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.getAttribute('aria-live')).toBe('polite');
    expect(getByText(container, 'All systems operational')).not.toBeNull();
    // The degraded alert banner should NOT be present in the fully_online tier.
    expect(container.querySelector('[data-testid="health-banner"]')).toBeNull();
  });

  it('renders the partially_degraded tier with role="alert" and the degraded banner', async () => {
    const props = makeProps({
      healthTier: 'partially_degraded',
      healthResult: DEGRADED_HEALTH,
    });
    root.render(React.createElement(AppShellHealthBanner, props));
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    const banner = container.querySelector('[data-testid="health-banner"]');
    expect(banner, 'degraded banner should be in the DOM').not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.getAttribute('aria-live')).toBe('polite');
    expect(banner?.className).toContain('degraded');
    expect(
      getByText(
        container,
        'AI drafting and research are unavailable. You can still browse grants, sources, and tasks.',
      ),
    ).not.toBeNull();
    // Re-check action button must be present and accessible.
    const refresh = getByRole(container, 'button', { name: 'Re-check system health' });
    expect(refresh).not.toBeNull();
  });

  it('renders the fully_offline tier with role="alert" and the offline banner', async () => {
    const props = makeProps({
      healthTier: 'fully_offline',
      healthResult: OFFLINE_HEALTH,
      hasStorageError: true,
    });
    root.render(React.createElement(AppShellHealthBanner, props));
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    const banner = container.querySelector('[data-testid="health-banner"]');
    expect(banner, 'offline banner should be in the DOM').not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.className).toContain('offline');
    expect(
      getByText(
        container,
        'Storage is unavailable. Grant data, sources, and tasks cannot be saved or loaded.',
      ),
    ).not.toBeNull();
    // The storage-blocked sub-banner should also render under fully_offline.
    expect(container.querySelector('[data-testid="storage-blocked-banner"]')).not.toBeNull();
    // The "All systems operational" string must not be present in the offline tier.
    expect(queryByText(container, 'All systems operational')).toBeNull();
  });
});
