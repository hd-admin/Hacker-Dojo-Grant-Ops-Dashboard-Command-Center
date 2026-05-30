import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { invalidateCache, resetPersistentStateForTests, withTempDataDir } from './grant-ops-persistence';
import {
	deleteCrawlSchedule,
	getSqliteState,
	readAuditEvents,
	readConflictRecords,
	readCrawlSchedules,
	readDuplicateCandidates,
	readJobQueue,
	readJobQueueItem,
	saveAuditEvent,
	saveConflictRecord,
	saveDuplicateCandidate,
	saveJobQueueItem,
	updateConflictRecord,
	updateDuplicateCandidate,
	updateJobQueueItem,
	upsertCrawlSchedule,
} from './grant-ops-sqlite';

describe('shared/grant-ops-sqlite workflow primitives', () => {
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

	beforeEach(async () => {
		tempDataDir = await withTempDataDir();
		invalidateCache();
		await resetPersistentStateForTests();
	});

	afterEach(async () => {
		await tempDataDir.cleanup();
		invalidateCache();
	});

	it('persists and updates job queue items with retry metadata and failure taxonomy', async () => {
		const createdAt = '2026-05-26T11:45:00.000Z';
		const state = getSqliteState(tempDataDir.dataDir);
		await saveJobQueueItem(state, {
			id: 'job-1',
			jobType: 'research',
			status: 'failed',
			stage: 'crawl',
			lastUpdate: '2026-05-26T11:50:00.000Z',
			createdAt,
			startedAt: '2026-05-26T11:46:00.000Z',
			completedAt: '2026-05-26T11:50:00.000Z',
			entityId: 'grant-1',
			retryCount: 2,
			errorMessage: 'Timed out',
			resultSummary: 'Crawl failed after retry',
			failureCategory: 'timeout',
		});

		const failedQueue = await readJobQueue(state, 'failed');
		expect(failedQueue).toHaveLength(1);
		expect(failedQueue[0]?.failureCategory).toBe('timeout');

		await updateJobQueueItem(state, 'job-1', {
			status: 'queued',
			stage: 'retrying',
			retryCount: 3,
			lastUpdate: '2026-05-26T11:55:00.000Z',
		});

		const queuedQueue = await readJobQueue(state, 'queued');
		expect(queuedQueue).toHaveLength(1);
		expect(queuedQueue[0]?.stage).toBe('retrying');
		expect(queuedQueue[0]?.retryCount).toBe(3);

		const item = await readJobQueueItem(state, 'job-1');
		expect(item?.status).toBe('queued');
		expect(item?.failureCategory).toBe('timeout');
		expect(item?.entityId).toBe('grant-1');
	});

	it('persists audit events in newest-first order for operator auditing', async () => {
		const state = getSqliteState(tempDataDir.dataDir);
		await saveAuditEvent(state, {
			id: 'audit-1',
			eventType: 'grant_status_changed',
			entityId: 'grant-1',
			entityType: 'grant',
			actorLabel: 'system',
			timestamp: '2026-05-26T12:00:00.000Z',
			metadata: { from: 'matched', to: 'review' },
		});
		await saveAuditEvent(state, {
			id: 'audit-2',
			eventType: 'grant_submitted',
			entityId: 'grant-1',
			entityType: 'grant',
			actorLabel: 'human',
			timestamp: '2026-05-26T12:05:00.000Z',
		});

		const events = await readAuditEvents(state);
		expect(events).toHaveLength(2);
		expect(events[0]?.id).toBe('audit-2');
		expect(events[1]?.id).toBe('audit-1');
		expect(events[0]?.actorLabel).toBe('human');
	});

	it('persists crawl schedules and supports updates plus deletion', async () => {
		const state = getSqliteState(tempDataDir.dataDir);
		await upsertCrawlSchedule(state, {
			id: 'schedule-1',
			sourceId: 'source-1',
			intervalHours: 24,
			lastScheduledAt: '2026-05-26T12:00:00.000Z',
			nextScheduledAt: '2026-05-27T12:00:00.000Z',
			isEnabled: true,
			createdAt: '2026-05-26T12:00:00.000Z',
		});

		let schedules = await readCrawlSchedules(state);
		// 8 seed schedules + 1 test schedule = 9
		expect(schedules).toHaveLength(9);
		expect(schedules.some(s => s.sourceId === 'source-1')).toBe(true);

		await upsertCrawlSchedule(state, {
			id: 'schedule-1',
			sourceId: 'source-1',
			intervalHours: 12,
			lastScheduledAt: '2026-05-26T18:00:00.000Z',
			nextScheduledAt: '2026-05-27T06:00:00.000Z',
			isEnabled: false,
			createdAt: '2026-05-26T12:00:00.000Z',
		});

		schedules = await readCrawlSchedules(state);
		// 8 seed schedules + 1 test schedule = 9
		expect(schedules).toHaveLength(9);
		expect(schedules.find(s => s.id === 'schedule-1')?.intervalHours).toBe(12);
		expect(schedules.find(s => s.id === 'schedule-1')?.isEnabled).toBe(false);

		await deleteCrawlSchedule(state, 'schedule-1');
		expect(await readCrawlSchedules(state)).toHaveLength(8);
	});

	it('persists duplicate and conflict records for review flows', async () => {
		const state = getSqliteState(tempDataDir.dataDir);
		await saveDuplicateCandidate(state, {
			id: 'duplicate-1',
			grantId1: 'grant-a',
			grantId2: 'grant-b',
			confidenceScore: 0.91,
			status: 'pending',
			detectedAt: '2026-05-26T12:10:00.000Z',
			conflictingFields: ['deadline', 'award'],
			resolvedAt: '2026-05-26T12:15:00.000Z',
			resolvedBy: 'human',
		});
		await updateDuplicateCandidate(state, 'duplicate-1', {
			status: 'merged',
			resolvedAt: '2026-05-26T12:15:00.000Z',
			resolvedBy: 'human',
		});

		await saveConflictRecord(state, {
			id: 'conflict-1',
			grantId: 'grant-a',
			fieldName: 'deadline',
			values: [
				{ value: '2026-06-01', sourceId: 'source-1', crawledAt: '2026-05-26T10:00:00.000Z' },
				{ value: '2026-06-15', sourceId: 'source-2', crawledAt: '2026-05-26T10:05:00.000Z' },
			],
			canonicalValue: null,
			resolvedAt: null,
			resolvedBy: null,
		});
		await updateConflictRecord(state, 'conflict-1', {
			canonicalValue: '2026-06-01',
			resolvedAt: '2026-05-26T12:20:00.000Z',
			resolvedBy: 'human',
		});

		const duplicates = await readDuplicateCandidates(state, 'merged');
		expect(duplicates).toHaveLength(1);
		expect(duplicates[0]?.resolvedBy).toBe('human');

		const conflicts = await readConflictRecords(state, 'grant-a');
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.canonicalValue).toBe('2026-06-01');
		expect(conflicts[0]?.resolvedBy).toBe('human');
	});
});
