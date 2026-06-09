'use client';

import type { JSX } from 'react';
import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { CrawlStatus, HealthCheckResult } from '../../../shared/types';

export type HealthTier = 'fully_online' | 'partially_degraded' | 'fully_offline';

export interface AppShellHealthBannerProps {
  healthTier: HealthTier;
  healthResult: HealthCheckResult | null;
  isCrawlStale: boolean;
  crawlStatus: CrawlStatus;
  opencodeBlocked: boolean;
  hasStorageError: boolean;
  onRefreshHealth: () => void;
  getRelativeTime: (isoString: string) => string;
}

export function AppShellHealthBanner({
  healthTier,
  healthResult,
  isCrawlStale,
  crawlStatus,
  opencodeBlocked,
  hasStorageError,
  onRefreshHealth,
  getRelativeTime,
}: AppShellHealthBannerProps): JSX.Element {
  return (
    <>
      {healthTier !== 'fully_online' && (
        <div
          className={`health-banner ${healthTier === 'partially_degraded' ? 'degraded' : 'offline'}`}
          role="alert"
          aria-live="polite"
          data-testid="health-banner"
        >
          <span className="health-banner-icon" aria-hidden="true">
            {healthTier === 'partially_degraded' ? <AlertTriangle size={16} /> : <X size={16} />}
          </span>
          <span className="health-banner-text">
            {healthTier === 'partially_degraded'
              ? 'AI drafting and research are unavailable. You can still browse grants, sources, and tasks.'
              : 'Storage is unavailable. Grant data, sources, and tasks cannot be saved or loaded.'}
          </span>
          <button
            type="button"
            className="health-banner-action"
            onClick={() => {
              onRefreshHealth();
            }}
            aria-label="Re-check system health"
          >
            Re-check
          </button>
        </div>
      )}

      {healthTier === 'fully_online' &&
        healthResult &&
        opencodeBlocked === false &&
        healthResult.opencode === 'ok' && (
          <div
            className="health-banner online"
            role="status"
            aria-live="polite"
            data-testid="health-banner-online"
          >
            <span className="health-banner-icon" aria-hidden="true">
              <Check size={16} />
            </span>
            <span className="health-banner-text">
              All systems operational
              {crawlStatus.lastSync && (
                <>
                  {' \u00b7 '}
                  <span data-testid="health-banner-crawl-sync">
                    Last crawl: {getRelativeTime(crawlStatus.lastSync)}
                    {isCrawlStale && (
                      <span className="health-banner-stale-badge" data-testid="health-banner-stale">
                        {' '}
                        Stale
                      </span>
                    )}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

      <div className="shell-banner-row">
        {hasStorageError && (
          <div data-testid="storage-blocked-banner">
            Storage unavailable: {healthResult?.storageError ?? 'Unknown error'}
          </div>
        )}
        {(healthResult?.opencode === 'not-installed' ||
          healthResult?.opencode === 'not-reachable') && (
          <div data-testid="opencode-degraded-banner">
            AI features unavailable until opencode is configured.
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="rerun-health-check-btn"
          onClick={() => {
            onRefreshHealth();
          }}
        >
          Re-run Health Check
        </button>
      </div>
    </>
  );
}
