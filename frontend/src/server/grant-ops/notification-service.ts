/**
 * Notification Service
 *
 * Handles notification generation, management, and delivery.
 * Implements event-driven notification generation from crawl, draft,
 * submission, and follow-up events. Provides urgency classification
 * and deadline-aware intelligence.
 *
 * Step 13: Implement Notification System and Activity Feed
 */

import type {
	AuditEvent,
	CrawlRun,
	DraftArtifact,
	FollowUp,
	Grant,
	Notification,
	OrganizationProfile,
	SubmissionRecord,
	Task,
} from '../../../../shared/types';
import type { Dependencies } from './dependencies';

// ============ Notification Types ============

export type NotificationEventType =
	| 'crawl_complete'
	| 'crawl_failed'
	| 'draft_ready'
	| 'submission_approved'
	| 'submission_ready'
	| 'submission_recorded'
	| 'follow_up_deadline'
	| 'follow_up_overdue'
	| 'deadline_proximity'
	| 'source_approved'
	| 'source_rejected'
	| 'task_blocked'
	| 'task_completed';

export type NotificationUrgency = 'informational' | 'warning' | 'urgent';

export interface NotificationRule {
	eventType: NotificationEventType;
	enabled: boolean;
	urgency: NotificationUrgency;
	template: string;
	desktopNotify: boolean;
}

export interface NotificationEvent {
	type: NotificationEventType;
	grantId?: string;
	grantTitle?: string;
	crawlRunId?: string;
	taskId?: string;
	followUpId?: string;
	submissionId?: string;
	deadline?: string;
	deadlineConfidence?: 'exact' | 'estimated' | 'rolling' | 'unknown';
	override?: string;
}

// ============ Default Notification Rules ============

export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
	{
		eventType: 'crawl_complete',
		enabled: true,
		urgency: 'informational',
		template: 'Crawl completed: {grantsFound} grants found, {grantsMatched} matched',
		desktopNotify: false,
	},
	{
		eventType: 'crawl_failed',
		enabled: true,
		urgency: 'warning',
		template: 'Crawl failed: {error}',
		desktopNotify: true,
	},
	{
		eventType: 'draft_ready',
		enabled: true,
		urgency: 'informational',
		template: 'Draft ready for "{grantTitle}"',
		desktopNotify: true,
	},
	{
		eventType: 'submission_approved',
		enabled: true,
		urgency: 'warning',
		template: 'Grant "{grantTitle}" approved - ready for submission',
		desktopNotify: true,
	},
	{
		eventType: 'submission_ready',
		enabled: true,
		urgency: 'urgent',
		template: 'Submission materials ready for "{grantTitle}"',
		desktopNotify: true,
	},
	{
		eventType: 'submission_recorded',
		enabled: true,
		urgency: 'informational',
		template: 'Grant "{grantTitle}" submitted',
		desktopNotify: false,
	},
	{
		eventType: 'follow_up_deadline',
		enabled: true,
		urgency: 'warning',
		template: 'Follow-up due for "{grantTitle}"',
		desktopNotify: true,
	},
	{
		eventType: 'follow_up_overdue',
		enabled: true,
		urgency: 'urgent',
		template: 'OVERDUE: Follow-up for "{grantTitle}" was due {date}',
		desktopNotify: true,
	},
	{
		eventType: 'deadline_proximity',
		enabled: true,
		urgency: 'warning',
		template:
			'Grant "{grantTitle}" deadline in {days} days ({deadlineConfidence})',
		desktopNotify: false,
	},
	{
		eventType: 'source_approved',
		enabled: true,
		urgency: 'informational',
		template: 'Source "{sourceName}" approved for crawling',
		desktopNotify: false,
	},
	{
		eventType: 'source_rejected',
		enabled: true,
		urgency: 'informational',
		template: 'Source "{sourceName}" was rejected',
		desktopNotify: false,
	},
	{
		eventType: 'task_blocked',
		enabled: true,
		urgency: 'warning',
		template: 'Task "{taskText}" is blocked',
		desktopNotify: false,
	},
	{
		eventType: 'task_completed',
		enabled: true,
		urgency: 'informational',
		template: 'Task "{taskText}" completed',
		desktopNotify: false,
	},
];

// ============ Notification Service ============

export interface NotificationService {
	/**
	 * Generate notifications from a crawl run event
	 */
	generateCrawlNotifications(
		crawlRun: CrawlRun,
		grantsFound: number,
		grantsMatched: number,
	): Notification[];

	/**
	 * Generate notification from a draft ready event
	 */
	generateDraftReadyNotification(
		grant: Grant,
		draft: DraftArtifact,
	): Notification | null;

	/**
	 * Generate notification from submission events
	 */
	generateSubmissionNotifications(
		grant: Grant,
		submission: SubmissionRecord,
	): Notification[];

	/**
	 * Generate deadline proximity notifications for grants with approaching deadlines
	 */
	generateDeadlineNotifications(
		grants: Grant[],
		profile: OrganizationProfile,
	): Notification[];

	/**
	 * Generate follow-up deadline notifications
	 */
	generateFollowUpNotifications(
		followUps: FollowUp[],
		grants: Grant[],
	): Notification[];

	/**
	 * Generate notifications from audit events
	 */
	generateFromAuditEvents(events: AuditEvent[]): Notification[];

	/**
	 * Generate task notifications
	 */
	generateTaskNotifications(tasks: Task[]): Notification[];

	/**
	 * Classify urgency based on deadline confidence (event-based)
	 */
	classifyUrgency(
		event: NotificationEvent,
	): NotificationUrgency;

	/**
	 * Classify urgency for a grant based on deadline confidence and daysOut
	 */
	classifyGrantUrgency(grant: Grant): NotificationUrgency;

	/**
	 * Apply notification rules to generate a notification
	 */
	applyRule(
		rule: NotificationRule,
		event: NotificationEvent,
	): Notification | null;

	/**
	 * Request desktop notification permission
	 */
	requestDesktopPermission(): Promise<boolean>;

	/**
	 * Show a desktop notification
	 */
	showDesktopNotification(notification: Notification): void;
}

export function createNotificationService(
	deps: Dependencies,
	rules: NotificationRule[] = DEFAULT_NOTIFICATION_RULES,
): NotificationService {
	const clock = deps.clock;
	const idGenerator = deps.idGenerator;

	function getRule(
		eventType: NotificationEventType,
	): NotificationRule | undefined {
		return rules.find((r) => r.eventType === eventType && r.enabled);
	}

	function interpolate(
		template: string,
		context: Record<string, string>,
	): string {
		return template.replace(/\{(\w+)\}/gu, (match, key) => context[key] ?? match);
	}

	function createNotification(
		text: string,
		urgency: NotificationUrgency,
		_grantId?: string,
	): Notification {
		const dotMap: Record<NotificationUrgency, string> = {
			informational: 'info',
			warning: 'warning',
			urgent: 'urgent',
		};
		const urgencyMap: Record<NotificationUrgency, 'info' | 'warning' | 'urgent'> = {
			informational: 'info',
			warning: 'warning',
			urgent: 'urgent',
		};
		return {
			id: idGenerator.generateId('notif'),
			text,
			time: clock.now().toISOString(),
			dot: dotMap[urgency],
			urgency: urgencyMap[urgency],
		};
	}

	function classifyUrgency(grant: Grant): NotificationUrgency {
		const confidence = grant.deadlineConfidence;
		const daysOut = grant.daysOut;

		if (confidence === 'rolling') return 'informational';
		if (confidence === 'unknown') return 'informational';
		if (daysOut === undefined || daysOut === null || Number.isNaN(daysOut)) return 'informational';

		if (confidence === 'exact' || confidence === 'estimated') {
			if (daysOut < 3) return 'urgent';
			if (daysOut >= 3 && daysOut <= 14) return 'warning';
		}

		return 'informational';
	}

	return {
		generateCrawlNotifications(
			crawlRun: CrawlRun,
			grantsFound: number,
			grantsMatched: number,
		): Notification[] {
			const notifications: Notification[] = [];

			if (crawlRun.status === 'failed') {
				const rule = getRule('crawl_failed');
				if (rule) {
					notifications.push(
						createNotification(
							interpolate(rule.template, {
								error: crawlRun.errorMessage ?? 'Unknown error',
							}),
							rule.urgency,
						),
					);
				}
			} else if (crawlRun.status === 'completed') {
				const rule = getRule('crawl_complete');
				if (rule) {
					notifications.push(
						createNotification(
							interpolate(rule.template, {
								grantsFound: String(grantsFound),
								grantsMatched: String(grantsMatched),
							}),
							rule.urgency,
						),
					);
				}
			}

			return notifications;
		},

		generateDraftReadyNotification(
			grant: Grant,
			_draft: DraftArtifact,
		): Notification | null {
			const rule = getRule('draft_ready');
			if (!rule) return null;
			return createNotification(
				interpolate(rule.template, { grantTitle: grant.title }),
				rule.urgency,
				grant.id,
			);
		},

		generateSubmissionNotifications(
			grant: Grant,
			_submission: SubmissionRecord,
		): Notification[] {
			const notifications: Notification[] = [];

			const recordedRule = getRule('submission_recorded');
			if (recordedRule) {
				notifications.push(
					createNotification(
						interpolate(recordedRule.template, { grantTitle: grant.title }),
						recordedRule.urgency,
						grant.id,
					),
				);
			}

			return notifications;
		},

		generateDeadlineNotifications(
			grants: Grant[],
			_profile: OrganizationProfile,
		): Notification[] {
			const notifications: Notification[] = [];
			const now = clock.now().getTime();
			const proximityDays = [30, 14, 7];

			for (const grant of grants) {
				if (!grant.deadline || grant.status === 'submitted' || grant.status === 'awarded') {
					continue;
				}

				const deadlineDate = new Date(grant.deadline);
				const daysUntil = Math.floor(
					(deadlineDate.getTime() - now) / (1000 * 60 * 60 * 24),
				);

				if (proximityDays.includes(daysUntil)) {
					const rule = getRule('deadline_proximity');
					if (rule) {
						const confidence = grant.deadlineConfidence ?? 'unknown';
						const urgency = classifyUrgency(grant);

						notifications.push(
							createNotification(
								interpolate(rule.template, {
									grantTitle: grant.title,
									days: String(daysUntil),
									deadlineConfidence: confidence,
								}),
								urgency === 'urgent' ? 'urgent' : urgency === 'warning' ? 'warning' : 'informational',
								grant.id,
							),
						);
					}
				}
			}

			return notifications;
		},

		generateFollowUpNotifications(
			followUps: FollowUp[],
			_grants: Grant[],
		): Notification[] {
			const notifications: Notification[] = [];
			const now = clock.now();

			for (const followUp of followUps) {
				if (followUp.status === 'completed') continue;

				if (followUp.status === 'overdue' || followUp.dueDate) {
					const isOverdue =
						followUp.status === 'overdue' ||
						(followUp.dueDate && new Date(followUp.dueDate) < now);

					const eventType: NotificationEventType = isOverdue
						? 'follow_up_overdue'
						: 'follow_up_deadline';

					const rule = getRule(eventType);
					if (rule) {
						const context: Record<string, string> = {
							grantTitle: followUp.title,
							date: followUp.dueDate
								? new Date(followUp.dueDate).toLocaleDateString()
								: 'now',
						};
						notifications.push(
							createNotification(
								interpolate(rule.template, context),
								isOverdue ? 'urgent' : rule.urgency,
								followUp.grantId,
							),
						);
					}
				}
			}

			return notifications;
		},

		generateFromAuditEvents(events: AuditEvent[]): Notification[] {
			const notifications: Notification[] = [];

			// Map audit events to notifications based on event type
			for (const event of events.slice(-10)) {
				// Only recent events
				const eventTypeMap: Partial<
					Record<string, NotificationEventType>
				> = {
					source_approved: 'source_approved',
					source_rejected: 'source_rejected',
					task_blocked: 'task_blocked',
					task_completed: 'task_completed',
				};

				const mappedType = eventTypeMap[event.eventType];
				if (mappedType) {
					const rule = getRule(mappedType);
					if (rule) {
						const metadata = (event.metadata ?? {}) as Record<
							string,
							string
						>;
						notifications.push(
							createNotification(
								interpolate(rule.template, metadata),
								rule.urgency,
							),
						);
					}
				}
			}

			return notifications;
		},

		generateTaskNotifications(tasks: Task[]): Notification[] {
			const notifications: Notification[] = [];

			for (const task of tasks) {
				if (task.completed) {
					const rule = getRule('task_completed');
					if (rule) {
						notifications.push(
							createNotification(
								interpolate(rule.template, { taskText: task.text }),
								rule.urgency,
								task.grantId,
							),
						);
					}
				} else if (task.taskStatus === 'blocked') {
					const rule = getRule('task_blocked');
					if (rule) {
						notifications.push(
							createNotification(
								interpolate(rule.template, { taskText: task.text }),
								rule.urgency,
								task.grantId,
							),
						);
					}
				}
			}

			return notifications;
		},

		classifyUrgency(event: NotificationEvent): NotificationUrgency {
			const rule = getRule(event.type);
			if (!rule) return 'informational';

			// Adjust urgency based on deadline confidence
			if (
				event.type === 'deadline_proximity' &&
				event.deadlineConfidence
			) {
				switch (event.deadlineConfidence) {
					case 'exact':
						return rule.urgency;
					case 'estimated':
						return 'informational';
					case 'rolling':
						return 'informational';
					case 'unknown':
						return 'informational';
				}
			}

			return rule.urgency;
		},

		classifyGrantUrgency(grant: Grant): NotificationUrgency {
			return classifyUrgency(grant);
		},

		applyRule(
			rule: NotificationRule,
			event: NotificationEvent,
		): Notification | null {
			if (!rule.enabled) return null;

			const context: Record<string, string> = {
				grantTitle: event.grantTitle ?? '',
				error: event.override ?? '',
				grantsFound: event.override ?? '',
				date: event.deadline
					? new Date(event.deadline).toLocaleDateString()
					: '',
				days: event.deadline
					? String(
							Math.ceil(
								(new Date(event.deadline).getTime() -
									clock.now().getTime()) /
									(1000 * 60 * 60 * 24),
							),
						)
					: '',
				deadlineConfidence: event.deadlineConfidence ?? 'unknown',
				sourceName: '',
			};

			// Use the rule's urgency, adjusted for deadline confidence if applicable
			const urgency = event.type === 'deadline_proximity' && event.deadlineConfidence
				? this.classifyUrgency(event)
				: rule.urgency;
			return createNotification(
				interpolate(rule.template, context),
				urgency,
				event.grantId,
			);
		},

		requestDesktopPermission(): Promise<boolean> {
			if (
				typeof window === 'undefined' ||
				!('Notification' in window)
			) {
				return Promise.resolve(false);
			}

			if (Notification.permission === 'granted') {
				return Promise.resolve(true);
			}

			if (Notification.permission === 'denied') {
				return Promise.resolve(false);
			}

			return Notification.requestPermission().then((p) => p === 'granted');
		},

		showDesktopNotification(notification: Notification): void {
			if (
				typeof window === 'undefined' ||
				!('Notification' in window)
			) {
				return;
			}

			if (Notification.permission !== 'granted') {
				return;
			}

			try {
				const n = new Notification('Grant Ops', {
					body: notification.text,
					icon: '/favicon.ico',
					tag: notification.id,
				});
				// Auto-close after 5 seconds
				setTimeout(() => n.close(), 5000);
			} catch {
				// Notification failed, ignore
			}
		},
	};
}
