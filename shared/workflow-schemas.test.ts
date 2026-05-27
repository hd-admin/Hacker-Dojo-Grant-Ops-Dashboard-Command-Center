import { describe, expect, it } from 'vitest';
import {
	AuditEventSchema,
	BackupFreshnessStatusSchema,
	BackupManifestSchema,
	BackupVerificationRecordSchema,
	CrawlScheduleSchema,
	HealthCheckResultSchema,
	JobQueueItemSchema,
	SourceReviewStatusSchema,
	WorkingContextSchema,
} from './schemas';

describe('shared/workflow schemas', () => {
	it('accepts the health bootstrap shape used by the startup gate', () => {
		expect(
			HealthCheckResultSchema.safeParse({
				storage: 'ok',
				opencode: 'ok',
				opencodeVersion: '0.1.5',
				crawlerStatus: 'never-run',
				documentIndexer: 'ok',
			}).success,
		).toBe(true);
	});

	it('accepts the working-context payload used for restoring the shell', () => {
		expect(
			WorkingContextSchema.safeParse({
				activeView: 'pipeline',
				selectedGrantId: 'grant-1',
				recentGrantIds: ['grant-1', 'grant-2'],
				discoverySearch: 'STEM',
				discoverySort: 'fit',
				discoveryCategory: 'Community',
				pipelineViewMode: 'list',
				pipelineStatusFilter: 'review',
				pipelineResponsibilityFilter: 'review',
				pipelineUrgencyFilter: 'urgent',
				pipelineFunderTypeFilter: 'foundation',
				recentDraftId: 'draft-1',
			}).success,
		).toBe(true);
	});

	it('accepts the source review status values used by the source workflow', () => {
		expect(SourceReviewStatusSchema.safeParse('pending-review').success).toBe(true);
		expect(SourceReviewStatusSchema.safeParse('approved').success).toBe(true);
		expect(SourceReviewStatusSchema.safeParse('rejected').success).toBe(true);
		expect(SourceReviewStatusSchema.safeParse('draft').success).toBe(false);
	});

	it('accepts the crawl schedule payload used by scheduled crawls', () => {
		expect(
			CrawlScheduleSchema.safeParse({
				id: 'schedule-1',
				sourceId: 'source-1',
				intervalHours: 24,
				lastScheduledAt: '2026-05-26T12:00:00.000Z',
				nextScheduledAt: '2026-05-27T12:00:00.000Z',
				isEnabled: true,
				createdAt: '2026-05-26T12:00:00.000Z',
			}).success,
		).toBe(true);
	});

	it('accepts the job queue payload used by retry and failure taxonomy flows', () => {
		expect(
			JobQueueItemSchema.safeParse({
				id: 'job-1',
				jobType: 'research',
				status: 'failed',
				stage: 'crawl',
				lastUpdate: '2026-05-26T12:00:00.000Z',
				createdAt: '2026-05-26T11:45:00.000Z',
				startedAt: '2026-05-26T11:46:00.000Z',
				completedAt: '2026-05-26T11:50:00.000Z',
				entityId: 'grant-1',
				retryCount: 2,
				errorMessage: 'Timed out',
				resultSummary: 'Crawl failed after retry',
				failureCategory: 'timeout',
			}).success,
		).toBe(true);
	});

	it('accepts the audit event payload used by diagnostics and audit views', () => {
		expect(
			AuditEventSchema.safeParse({
				id: 'audit-1',
				eventType: 'grant_status_changed',
				entityId: 'grant-1',
				entityType: 'grant',
				actorLabel: 'system',
				timestamp: '2026-05-26T12:00:00.000Z',
				metadata: { from: 'matched', to: 'draft' },
			}).success,
		).toBe(true);
	});

	it('accepts the backup and restore freshness payloads used for operator verification', () => {
		expect(
			BackupManifestSchema.safeParse({
				version: '1.0.0',
				createdAt: '2026-05-26T12:00:00.000Z',
				grantCount: 5,
				sourceCount: 3,
				documentCount: 7,
				hasDocumentFiles: true,
			}).success,
		).toBe(true);

		expect(
			BackupVerificationRecordSchema.safeParse({
				checkedAt: '2026-05-26T12:05:00.000Z',
				outcome: 'verified',
				grantCount: 5,
				documentCount: 7,
				type: 'backup',
			}).success,
		).toBe(true);

		expect(
			BackupFreshnessStatusSchema.safeParse({
				lastBackupAt: '2026-05-26T12:00:00.000Z',
				isStale: false,
				lastBackupVerification: {
					checkedAt: '2026-05-26T12:05:00.000Z',
					outcome: 'verified',
					grantCount: 5,
					documentCount: 7,
					type: 'backup',
				},
				lastRestoreVerification: null,
			}).success,
		).toBe(true);
	});
});
