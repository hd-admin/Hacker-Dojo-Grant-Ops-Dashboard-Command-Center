/**
 * useHealthCheck Hook
 *
 * React hook that polls the /api/health endpoint every 30 seconds
 * and provides structured health state to components.
 *
 * Step 2f: Add useHealthCheck React hook polling /api/health every 30s
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthCheckResult } from '../../../shared/types';

export type HealthTier = 'fully_online' | 'partially_degraded' | 'fully_offline';

export interface HealthCheckState {
	/** The latest health check result */
	health: HealthCheckResult | null;
	/** Whether a health check is currently in progress */
	isLoading: boolean;
	/** The computed health tier */
	healthTier: HealthTier;
	/** Whether opencode features are blocked */
	isOpencodeBlocked: boolean;
	/** Whether storage is available */
	isStorageOk: boolean;
	/** Whether the crawler is stale (>7 days since last run) */
	isCrawlerStale: boolean;
	/** When the last successful health check completed */
	lastChecked: string | null;
	/** Manually trigger a health check */
	refresh: () => Promise<void>;
	/** Error from the last failed health check */
	error: string | null;
}

const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds
const CRAWL_STALENESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Compute health tier from health check result
 */
export function computeHealthTier(
	health: HealthCheckResult | null,
): HealthTier {
	if (!health) return 'fully_online';
	if (health.storage === 'error') return 'fully_offline';

	const opencodeDegraded =
		health.opencode === 'not-installed' ||
		health.opencode === 'not-reachable' ||
		health.opencode === 'incompatible' ||
		health.opencode === 'error';

	if (opencodeDegraded) return 'partially_degraded';
	return 'fully_online';
}

/**
 * Check if opencode features are blocked
 */
export function isOpencodeBlocked(
	health: HealthCheckResult | null,
): boolean {
	if (!health) return false;
	return (
		health.opencode === 'not-installed' ||
		health.opencode === 'not-reachable' ||
		health.opencode === 'incompatible' ||
		health.opencode === 'error'
	);
}

/**
 * Check if storage is OK
 */
export function isStorageOk(health: HealthCheckResult | null): boolean {
	if (!health) return true;
	return health.storage !== 'error';
}

/**
 * Check if crawler data is stale
 */
export function isCrawlerStale(health: HealthCheckResult | null): boolean {
	if (!health) return false;

	if (health.crawlerStatus === 'never-run') return true;
	if (health.crawlerStatus === 'stale') return true;

	if (health.crawlerLastRunAt) {
		const lastRun = new Date(health.crawlerLastRunAt).getTime();
		const now = Date.now();
		return now - lastRun > CRAWL_STALENESS_MS;
	}

	return false;
}

/**
 * useHealthCheck hook
 *
 * Provides reactive health state with automatic polling.
 * Components can subscribe to health changes without managing intervals.
 *
 * @param options - Configuration options
 * @param options.intervalMs - Polling interval in milliseconds (default: 30 seconds)
 * @param options.enabled - Whether to enable automatic polling (default: true)
 * @param options.onHealthChange - Optional callback when health state changes
 */
export function useHealthCheck(options: {
	intervalMs?: number;
	enabled?: boolean;
	onHealthChange?: (health: HealthCheckResult, tier: HealthTier) => void;
} = {}): HealthCheckState {
	const { intervalMs = HEALTH_CHECK_INTERVAL_MS, enabled = true, onHealthChange } = options;

	const [health, setHealth] = useState<HealthCheckResult | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [lastChecked, setLastChecked] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const onHealthChangeRef = useRef(onHealthChange);
	onHealthChangeRef.current = onHealthChange;

	const healthTier = computeHealthTier(health);
	const opencodeBlocked = isOpencodeBlocked(health);
	const storageOk = isStorageOk(health);
	const crawlerStale = isCrawlerStale(health);

	// Stable fetch function using ref to avoid dependency issues
	const fetchHealthRef = useRef(async (): Promise<void> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch('/api/health');
			if (!response.ok) {
				throw new Error(`Health check failed: ${response.status}`);
			}

			const data = (await response.json()) as HealthCheckResult;
			setHealth(data);
			setLastChecked(new Date().toISOString());

			const tier = computeHealthTier(data);
			onHealthChangeRef.current?.(data, tier);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Health check failed';
			setError(message);

			// Set a degraded state on error
			setHealth((prev) => {
				if (!prev) {
					return {
						storage: 'error' as const,
						opencode: 'error' as const,
						crawlerStatus: 'never-run' as const,
						documentIndexer: 'error' as const,
						storageError: message,
					};
				}
				return prev;
			});
		} finally {
			setIsLoading(false);
		}
	});

	const fetchHealth = useCallback(async (): Promise<void> => {
		await fetchHealthRef.current();
	}, []);

	// Initial fetch and polling setup
	useEffect(() => {
		if (!enabled) return;

		// Initial fetch
		void fetchHealthRef.current();

		// Set up polling interval
		intervalRef.current = setInterval(() => {
			void fetchHealthRef.current();
		}, intervalMs);

		return () => {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [enabled, intervalMs]);

	return {
		health,
		isLoading,
		healthTier,
		isOpencodeBlocked: opencodeBlocked,
		isStorageOk: storageOk,
		isCrawlerStale: crawlerStale,
		lastChecked,
		refresh: fetchHealth,
		error,
	};
}

/**
 * useHealthCheckSimple hook
 *
 * Simplified version that just provides the health result and refresh function.
 * Does not include automatic polling.
 */
export function useHealthCheckSimple(): {
	health: HealthCheckResult | null;
	refresh: () => Promise<void>;
	isLoading: boolean;
} {
	const [health, setHealth] = useState<HealthCheckResult | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const fetchHealthRef = useRef(async (): Promise<void> => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/health');
			if (response.ok) {
				const data = (await response.json()) as HealthCheckResult;
				setHealth(data);
			}
		} finally {
			setIsLoading(false);
		}
	});

	const fetchHealth = useCallback(async (): Promise<void> => {
		await fetchHealthRef.current();
	}, []);

	useEffect(() => {
		void fetchHealthRef.current();
	}, []);

	return { health, refresh: fetchHealth, isLoading };
}
