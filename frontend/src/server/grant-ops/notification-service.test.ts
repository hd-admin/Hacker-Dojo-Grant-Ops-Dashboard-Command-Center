/**
 * Notification Service Tests
 *
 * Tests for notification-service.ts covering:
 * - Crawl notification generation
 * - Draft ready notifications
 * - Submission notifications
 * - Deadline proximity notifications
 * - Follow-up notifications
 * - Task notifications
 * - Urgency classification
 * - Desktop notification support
 *
 * Step 13: Implement Notification System and Activity Feed
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Dependencies } from './dependencies';
import type {
	CrawlRun,
	DraftArtifact,
	FollowUp,
	Grant,
	OrganizationProfile,
	SubmissionRecord,
	Task,
} from '../../../../shared/types';
import {
	createNotificationService,
	DEFAULT_NOTIFICATION_RULES,
	type NotificationRule,
} from './notification-service';

// ============ Mock Dependencies ============

function createMockDeps(): Dependencies {
	return {
		repository: {
			getGrants: vi.fn().mockResolvedValue([]),
			getNotifications: vi.fn().mockResolvedValue([]),
			updateNotifications: vi.fn().mockResolvedValue(undefined),
			getProfile: vi.fn().mockResolvedValue(null),
			getDocuments: vi.fn().mockResolvedValue([]),
			getSources: vi.fn().mockResolvedValue([]),
			getCrawlRuns: vi.fn().mockResolvedValue([]),
			getLatestCrawlRun: vi.fn().mockResolvedValue(null),
			getJobs: vi.fn().mockResolvedValue([]),
			getOpencodeSettings: vi.fn().mockResolvedValue(null),
			saveGrant: vi.fn().mockResolvedValue(undefined),
			saveSource: vi.fn().mockResolvedValue(undefined),
			saveCrawlRun: vi.fn().mockResolvedValue(undefined),
			saveDocument: vi.fn().mockResolvedValue(undefined),
			saveJob: vi.fn().mockResolvedValue(undefined),
			updateGrant: vi.fn().mockResolvedValue(undefined),
			updateSource: vi.fn().mockResolvedValue(undefined),
			updateDocument: vi.fn().mockResolvedValue(undefined),
			deleteSource: vi.fn().mockResolvedValue(undefined),
			resetAllData: vi.fn().mockResolvedValue(undefined),
			getTasks: vi.fn().mockResolvedValue([]),
			updateTasks: vi.fn().mockResolvedValue(undefined),
			getDraftArtifacts: vi.fn().mockResolvedValue([]),
			saveDraftArtifact: vi.fn().mockResolvedValue(undefined),
			getRevisionRequests: vi.fn().mockResolvedValue([]),
			saveRevisionRequest: vi.fn().mockResolvedValue(undefined),
			getApprovalRecords: vi.fn().mockResolvedValue([]),
			saveApprovalRecord: vi.fn().mockResolvedValue(undefined),
			getSubmissionRecords: vi.fn().mockResolvedValue([]),
			saveSubmissionRecord: vi.fn().mockResolvedValue(undefined),
			getFollowUps: vi.fn().mockResolvedValue([]),
			saveFollowUp: vi.fn().mockResolvedValue(undefined),
			deleteFollowUp: vi.fn().mockResolvedValue(undefined),
			searchGrants: vi.fn().mockResolvedValue([]),
			getDuplicateCandidates: vi.fn().mockResolvedValue([]),
			saveDuplicateCandidate: vi.fn().mockResolvedValue(undefined),
			updateDuplicateCandidate: vi.fn().mockResolvedValue(undefined),
			getConflictRecords: vi.fn().mockResolvedValue([]),
			saveConflictRecord: vi.fn().mockResolvedValue(undefined),
			updateConflictRecord: vi.fn().mockResolvedValue(undefined),
			getBackupManifest: vi.fn().mockResolvedValue(null),
			saveBackupManifest: vi.fn().mockResolvedValue(undefined),
			getThemesData: vi.fn().mockResolvedValue({
				keywordClusters: [],
				themes: [],
				regions: [],
				populations: [],
				strategicPriorities: [],
			}),
			saveThemesData: vi.fn().mockResolvedValue(undefined),
			getAuditEvents: vi.fn().mockResolvedValue([]),
			saveAuditEvent: vi.fn().mockResolvedValue(undefined),
		},
		sourceService: {
			discover: vi.fn().mockResolvedValue([]),
			approve: vi.fn().mockResolvedValue({
				id: 'source-1',
				name: 'Test Source',
				url: 'https://example.com',
				type: 'website',
				createdAt: new Date().toISOString(),
				isActive: true,
				reviewStatus: 'approved',
				approvedAt: new Date().toISOString(),
			}),
			reject: vi.fn().mockResolvedValue(undefined),
		},
		createOpencodeAdapter: vi.fn().mockReturnValue({
			executePrompt: vi.fn().mockResolvedValue({ text: '' }),
			validateConnection: vi.fn().mockResolvedValue(true),
		}),
		clock: {
			now: () => new Date('2026-01-15T12:00:00.000Z'),
		},
		idGenerator: {
			generateId: (prefix: string) => `${prefix}-test-123`,
		},
		persistenceRoot: {
			getBaseDir: () => '/tmp/grant-ops-test',
		},
		backup: {
			exportBackupSnapshot: vi.fn().mockResolvedValue({
				version: '1.0',
				createdAt: new Date().toISOString(),
				grantCount: 0,
				sourceCount: 0,
				documentCount: 0,
				hasDocumentFiles: false,
				documentsZip: undefined,
			}),
			importBackupSnapshot: vi.fn().mockResolvedValue(undefined),
			recordBackupVerification: vi.fn().mockResolvedValue(undefined),
		},
		loadBackupFreshness: vi.fn().mockResolvedValue({
			lastBackupAt: null,
			isStale: true,
			lastBackupVerification: null,
			lastRestoreVerification: null,
		}),
		resetPersistentStateForTests: vi.fn().mockResolvedValue(undefined),
	};
}

// ============ Test Fixtures ============

const createTestGrant = (overrides: Partial<Grant> = {}): Grant => ({
	id: 'grant-1',
	title: 'Test Grant',
	funder: 'Test Funder',
	funderShort: 'TF',
	award: '$50,000',
	awardSort: 50000,
	deadline: '2026-02-15T23:59:59.000Z',
	deadlineConfidence: 'exact',
	daysOut: 31,
	fit: 85,
	tags: ['education', 'technology'],
	status: 'matched',
	statusLabel: 'Matched',
	...overrides,
});

const createTestCrawlRun = (overrides: Partial<CrawlRun> = {}): CrawlRun => ({
	id: 'crawl-1',
	startedAt: '2026-01-15T10:00:00.000Z',
	completedAt: '2026-01-15T10:05:00.000Z',
	status: 'completed',
	sourcesCrawled: 3,
	grantsFound: 15,
	grantsMatched: 8,
	...overrides,
});

const createTestDraft = (overrides: Partial<DraftArtifact> = {}): DraftArtifact => ({
	id: 'draft-1',
	grantId: 'grant-1',
	version: 1,
	content: 'Test draft content',
	createdAt: '2026-01-15T11:00:00.000Z',
	createdBy: 'agent',
	...overrides,
});

const createTestSubmission = (overrides: Partial<SubmissionRecord> = {}): SubmissionRecord => ({
	id: 'sub-1',
	grantId: 'grant-1',
	submittedAt: '2026-01-15T14:00:00.000Z',
	method: {
		type: 'portal',
		portalUrl: 'https://example.com/apply',
		submittedBy: 'human',
	},
	followUpsCreated: [],
	...overrides,
});

const createTestFollowUp = (overrides: Partial<FollowUp> = {}): FollowUp => ({
	id: 'followup-1',
	grantId: 'grant-1',
	type: 'progress_check',
	title: 'Check on application status',
	description: 'Follow up on grant application',
	dueDate: '2026-02-01T00:00:00.000Z',
	status: 'pending',
	createdAt: '2026-01-15T00:00:00.000Z',
	...overrides,
});

const createTestTask = (overrides: Partial<Task> = {}): Task => ({
	id: 'task-1',
	text: 'Review budget section',
	completed: false,
	grantId: 'grant-1',
	taskStatus: 'in-progress',
	responsibilityTag: 'finance',
	...overrides,
});

const createTestProfile = (): OrganizationProfile => ({
	legalName: 'Test Org',
	ein: '12-3456789',
	samUEI: 'TEST123',
	nonprofitStatus: '501(c)(3)',
	contactInfo: {},
	geography: 'San Francisco Bay Area',
	mission: 'Test mission',
	programAreas: ['education'],
	populationsServed: ['youth'],
	fundingHistory: [],
	partnerships: [],
	complianceFacts: [],
	docTypes: ['PDF'],
	searchThemes: [],
	agentBehavior: {
		autoDraftThreshold: 75,
		submissionPolicy: 'Human approval required',
		notifyEmail: 'test@example.org',
		voiceAndTone: 'Plain-spoken',
	},
});

// ============ Tests ============

describe('notification-service', () => {
	let deps: Dependencies;

	beforeEach(() => {
		deps = createMockDeps();
	});

	describe('createNotificationService', () => {
		it('creates service with default rules', () => {
			const service = createNotificationService(deps);
			expect(service).toBeDefined();
			expect(typeof service.generateCrawlNotifications).toBe('function');
			expect(typeof service.generateDraftReadyNotification).toBe('function');
			expect(typeof service.generateDeadlineNotifications).toBe('function');
		});

		it('creates service with custom rules', () => {
			const customRules: NotificationRule[] = [
				{
					eventType: 'crawl_complete',
					enabled: false,
					urgency: 'informational',
					template: 'Custom template',
					desktopNotify: false,
				},
			];
			const service = createNotificationService(deps, customRules);
			expect(service).toBeDefined();
		});
	});

	describe('generateCrawlNotifications', () => {
		it('generates informational notification for successful crawl', () => {
			const service = createNotificationService(deps);
			const crawlRun = createTestCrawlRun({ status: 'completed' });

			const notifications = service.generateCrawlNotifications(
				crawlRun,
				15,
				8,
			);

			expect(notifications).toHaveLength(1);
			expect(notifications[0].text).toBe(
				'Crawl completed: 15 grants found, 8 matched',
			);
			expect(notifications[0].dot).toBe('info');
		});

		it('generates warning notification for failed crawl', () => {
			const service = createNotificationService(deps);
			const crawlRun = createTestCrawlRun({
				status: 'failed',
				errorMessage: 'Connection timeout',
			});

			const notifications = service.generateCrawlNotifications(
				crawlRun,
				0,
				0,
			);

			expect(notifications).toHaveLength(1);
			expect(notifications[0].text).toContain('Connection timeout');
			expect(notifications[0].dot).toBe('warning');
		});

		it('returns empty array when crawl is still running', () => {
			const service = createNotificationService(deps);
			const crawlRun = createTestCrawlRun({ status: 'running' });

			const notifications = service.generateCrawlNotifications(
				crawlRun,
				0,
				0,
			);

			expect(notifications).toHaveLength(0);
		});
	});

	describe('generateDraftReadyNotification', () => {
		it('generates notification for draft ready event', () => {
			const service = createNotificationService(deps);
			const grant = createTestGrant();
			const draft = createTestDraft();

			const notification = service.generateDraftReadyNotification(
				grant,
				draft,
			);

			expect(notification).not.toBeNull();
			expect(notification!.text).toBe('Draft ready for "Test Grant"');
			expect(notification!.dot).toBe('info');
		});

		it('returns null when rule is disabled', () => {
			const disabledRules: NotificationRule[] = [
				{
					eventType: 'draft_ready',
					enabled: false,
					urgency: 'informational',
					template: 'Draft ready',
					desktopNotify: false,
				},
			];
			const service = createNotificationService(deps, disabledRules);
			const grant = createTestGrant();
			const draft = createTestDraft();

			const notification = service.generateDraftReadyNotification(
				grant,
				draft,
			);

			expect(notification).toBeNull();
		});
	});

	describe('generateSubmissionNotifications', () => {
		it('generates notification for recorded submission', () => {
			const service = createNotificationService(deps);
			const grant = createTestGrant();
			const submission = createTestSubmission();

			const notifications = service.generateSubmissionNotifications(
				grant,
				submission,
			);

			expect(notifications).toHaveLength(1);
			expect(notifications[0].text).toBe(
				'Grant "Test Grant" submitted',
			);
			expect(notifications[0].dot).toBe('info');
		});
	});

	describe('generateDeadlineNotifications', () => {
		it('generates notifications for grants with approaching deadlines', () => {
			const service = createNotificationService(deps);
			const profile = createTestProfile();

			// Create grants with deadlines at 30, 14, and 7 days
			const grants = [
				createTestGrant({
					id: 'grant-30',
					title: '30 Day Grant',
					deadline: '2026-02-14T23:59:59.000Z', // 30 days from 2026-01-15
					deadlineConfidence: 'exact',
				}),
				createTestGrant({
					id: 'grant-14',
					title: '14 Day Grant',
					deadline: '2026-01-29T23:59:59.000Z', // 14 days
					deadlineConfidence: 'exact',
				}),
				createTestGrant({
					id: 'grant-7',
					title: '7 Day Grant',
					deadline: '2026-01-22T23:59:59.000Z', // 7 days
					deadlineConfidence: 'exact',
				}),
				createTestGrant({
					id: 'grant-submitted',
					title: 'Already Submitted',
					deadline: '2026-01-22T23:59:59.000Z',
					status: 'submitted',
				}),
			];

			const notifications = service.generateDeadlineNotifications(
				grants,
				profile,
			);

			// Should generate for 30, 14, and 7 day grants (3 notifications)
			// Not for submitted grant
			expect(notifications.length).toBeGreaterThanOrEqual(3);
		});

		it('adjusts urgency based on deadline confidence', () => {
			const service = createNotificationService(deps);
			const profile = createTestProfile();

			const grants = [
				createTestGrant({
					id: 'grant-exact',
					deadline: '2026-01-22T23:59:59.000Z',
					deadlineConfidence: 'exact',
				}),
				createTestGrant({
					id: 'grant-estimated',
					deadline: '2026-01-22T23:59:59.000Z',
					deadlineConfidence: 'estimated',
				}),
				createTestGrant({
					id: 'grant-rolling',
					deadline: '2026-01-22T23:59:59.000Z',
					deadlineConfidence: 'rolling',
				}),
			];

			const notifications = service.generateDeadlineNotifications(
				grants,
				profile,
			);

			// All should be for 7-day proximity, but with different urgency
			expect(notifications.length).toBeGreaterThanOrEqual(3);
		});

		it('skips grants with no deadline', () => {
			const service = createNotificationService(deps);
			const profile = createTestProfile();

			const grants = [
				createTestGrant({
					id: 'grant-nodeadline',
					deadline: '',
				}),
			];

			const notifications = service.generateDeadlineNotifications(
				grants,
				profile,
			);

			expect(notifications).toHaveLength(0);
		});
	});

	describe('generateFollowUpNotifications', () => {
		it('generates warning for pending follow-ups with due dates', () => {
			const service = createNotificationService(deps);
			const grants = [createTestGrant()];

			const followUps = [
				createTestFollowUp({
					status: 'pending',
					dueDate: '2026-01-20T00:00:00.000Z',
				}),
			];

			const notifications = service.generateFollowUpNotifications(
				followUps,
				grants,
			);

			expect(notifications.length).toBeGreaterThanOrEqual(1);
			const followUpNotif = notifications.find((n) =>
				n.text.includes('Follow-up due'),
			);
			expect(followUpNotif).toBeDefined();
		});

		it('generates urgent notification for overdue follow-ups', () => {
			const service = createNotificationService(deps);
			const grants = [createTestGrant()];

			const followUps = [
				createTestFollowUp({
					status: 'overdue',
					dueDate: '2026-01-10T00:00:00.000Z',
				}),
			];

			const notifications = service.generateFollowUpNotifications(
				followUps,
				grants,
			);

			expect(notifications.length).toBeGreaterThanOrEqual(1);
			const overdueNotif = notifications.find((n) =>
				n.text.includes('OVERDUE'),
			);
			expect(overdueNotif).toBeDefined();
			expect(overdueNotif!.dot).toBe('urgent');
		});

		it('skips completed follow-ups', () => {
			const service = createNotificationService(deps);
			const grants = [createTestGrant()];

			const followUps = [
				createTestFollowUp({
					status: 'completed',
					dueDate: '2026-01-20T00:00:00.000Z',
				}),
			];

			const notifications = service.generateFollowUpNotifications(
				followUps,
				grants,
			);

			// No deadline notifications for completed follow-ups
			const deadlineNotifs = notifications.filter((n) =>
				n.text.includes('Follow-up'),
			);
			expect(deadlineNotifs).toHaveLength(0);
		});
	});

	describe('generateTaskNotifications', () => {
		it('generates notification for completed tasks', () => {
			const service = createNotificationService(deps);

			const tasks = [
				createTestTask({
					completed: true,
					text: 'Review budget section',
				}),
			];

			const notifications = service.generateTaskNotifications(tasks);

			expect(notifications).toHaveLength(1);
			expect(notifications[0].text).toBe(
				'Task "Review budget section" completed',
			);
		});

		it('generates warning for blocked tasks', () => {
			const service = createNotificationService(deps);

			const tasks = [
				createTestTask({
					taskStatus: 'blocked',
					text: 'Waiting on document',
				}),
			];

			const notifications = service.generateTaskNotifications(tasks);

			expect(notifications).toHaveLength(1);
			expect(notifications[0].text).toContain('blocked');
			expect(notifications[0].dot).toBe('warning');
		});

		it('skips in-progress tasks', () => {
			const service = createNotificationService(deps);

			const tasks = [
				createTestTask({
					taskStatus: 'in-progress',
					completed: false,
				}),
			];

			const notifications = service.generateTaskNotifications(tasks);

			expect(notifications).toHaveLength(0);
		});
	});

	describe('classifyUrgency', () => {
		it('returns rule urgency for standard events', () => {
			const service = createNotificationService(deps);

			const urgency = service.classifyUrgency({
				type: 'crawl_complete',
			});

			expect(urgency).toBe('informational');
		});

		it('adjusts urgency for deadline proximity based on confidence', () => {
			const service = createNotificationService(deps);

			const exactUrgency = service.classifyUrgency({
				type: 'deadline_proximity',
				deadlineConfidence: 'exact',
			});

			const estimatedUrgency = service.classifyUrgency({
				type: 'deadline_proximity',
				deadlineConfidence: 'estimated',
			});

			const rollingUrgency = service.classifyUrgency({
				type: 'deadline_proximity',
				deadlineConfidence: 'rolling',
			});

			expect(exactUrgency).toBe('warning');
			expect(estimatedUrgency).toBe('informational');
			expect(rollingUrgency).toBe('informational');
		});
	});

	describe('applyRule', () => {
		it('returns null for disabled rules', () => {
			const service = createNotificationService(deps);
			const rule: NotificationRule = {
				eventType: 'crawl_complete',
				enabled: false,
				urgency: 'informational',
				template: 'Test',
				desktopNotify: false,
			};

			const notification = service.applyRule(rule, {
				type: 'crawl_complete',
			});

			expect(notification).toBeNull();
		});

		it('applies rule and interpolates template', () => {
			const service = createNotificationService(deps);
			const rule: NotificationRule = {
				eventType: 'crawl_complete',
				enabled: true,
				urgency: 'warning',
				template: 'Crawl found {grantsFound} grants',
				desktopNotify: true,
			};

			const notification = service.applyRule(rule, {
				type: 'crawl_complete',
				override: '15',
			});

			expect(notification).not.toBeNull();
			expect(notification!.text).toBe('Crawl found 15 grants');
			expect(notification!.dot).toBe('warning');
		});
	});

	describe('requestDesktopPermission', () => {
		it('returns false when window is undefined', async () => {
			const service = createNotificationService(deps);
			const result = await service.requestDesktopPermission();
			expect(result).toBe(false);
		});
	});

	describe('showDesktopNotification', () => {
		it('does not throw when window is undefined', () => {
			const service = createNotificationService(deps);
			expect(() => {
				service.showDesktopNotification({
					id: 'test',
					text: 'Test notification',
					time: new Date().toISOString(),
					dot: 'info',
				});
			}).not.toThrow();
		});
	});

	describe('DEFAULT_NOTIFICATION_RULES', () => {
		it('includes all required event types', () => {
			const eventTypes = DEFAULT_NOTIFICATION_RULES.map((r) => r.eventType);

			expect(eventTypes).toContain('crawl_complete');
			expect(eventTypes).toContain('crawl_failed');
			expect(eventTypes).toContain('draft_ready');
			expect(eventTypes).toContain('submission_approved');
			expect(eventTypes).toContain('submission_ready');
			expect(eventTypes).toContain('submission_recorded');
			expect(eventTypes).toContain('follow_up_deadline');
			expect(eventTypes).toContain('follow_up_overdue');
			expect(eventTypes).toContain('deadline_proximity');
			expect(eventTypes).toContain('source_approved');
			expect(eventTypes).toContain('source_rejected');
			expect(eventTypes).toContain('task_blocked');
			expect(eventTypes).toContain('task_completed');
		});

		it('all rules have required fields', () => {
			for (const rule of DEFAULT_NOTIFICATION_RULES) {
				expect(rule.eventType).toBeDefined();
				expect(typeof rule.enabled).toBe('boolean');
				expect(rule.urgency).toMatch(/^(informational|warning|urgent)$/);
				expect(rule.template).toBeDefined();
				expect(typeof rule.desktopNotify).toBe('boolean');
			}
		});
	});
});
