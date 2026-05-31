"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
	AuditEvent,
	DocumentMetadata,
	FollowUp,
	GrantDetailResponse,
	GrantStatus,
	SubmissionManifest,
	SubmissionMethod,
} from "../../../shared/types";
import { client } from "../lib/grant-ops-client";
import { useAutosave } from "../lib/useAutosave";
import { AlertTriangle } from "lucide-react";
import GroundingReview from "./GroundingReview";
import SubmissionReadiness from "./SubmissionReadiness";

interface GrantDrawerProps {
	grantId: string | null;
	onClose: () => void;
	onRefreshAppState?: () => Promise<void> | void;
}

export interface GrantDrawerViewModel {
	grant: GrantDetailResponse["grant"] | null;
	latestDraftVersionLabel: string;
	latestDraftPreview: string;
	showGenerateDraft: boolean;
	showRequestRevision: boolean;
	showApprove: boolean;
	showSubmit: boolean;
	submitDisabledReason: string | null;
}

export function buildGrantDrawerViewModel(
	detail: GrantDetailResponse | null,
): GrantDrawerViewModel {
	if (!detail) {
		return {
			grant: null,
			latestDraftVersionLabel: "No draft yet",
			latestDraftPreview: "",
			showGenerateDraft: false,
			showRequestRevision: false,
			showApprove: false,
			showSubmit: false,
			submitDisabledReason: null,
		};
	}

	const latestDraftVersionLabel = detail.latestDraft
		? `Version ${detail.latestDraft.version}`
		: detail.grant.latestDraftVersion
			? `Version ${detail.grant.latestDraftVersion}`
			: "No draft yet";

	const latestDraftPreview =
		detail.latestDraft?.content || detail.grant.draftContent || "";

	return {
		grant: detail.grant,
		latestDraftVersionLabel,
		latestDraftPreview,
		showGenerateDraft:
			detail.workflow.canGenerateDraft &&
			!detail.latestDraft &&
			!detail.grant.draftContent,
		showRequestRevision: detail.workflow.canRequestRevision,
		showApprove: detail.workflow.canApprove,
		showSubmit: detail.workflow.canSubmit,
		submitDisabledReason: detail.workflow.canSubmit
			? null
			: detail.workflow.blockingReason,
	};
}

function formatDate(dateStr: string): string {
	if (dateStr === "Rolling") return "Rolling";
	const parts = dateStr.split("-");
	const year = parts[0] ?? "";
	const month = parts[1] ?? "";
	const day = parts[2] ?? "";
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[parseInt(month, 10) - 1] ?? ""} ${parseInt(day, 10)}, ${year}`;
}

function previewText(text: string, limit = 280): string {
	if (!text) return "No draft has been generated yet.";
	if (text.length <= limit) return text;
	return `${text.slice(0, limit).trimEnd()}…`;
}

const WORKING_CONTEXT_KEY = "grantops.workingContext";

function getWorkingContextStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	return window.localStorage;
}

function readWorkingContext(): Record<string, unknown> {
	const storage = getWorkingContextStorage();
	if (!storage || typeof storage.getItem !== "function") return {};
	try {
		return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || "{}");
	} catch {
		return {};
	}
}

function saveWorkingContextField(field: string, value: unknown): void {
	const storage = getWorkingContextStorage();
	if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return;
	const next = { ...readWorkingContext(), [field]: value };
	storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(next));
}

async function waitForJobCompletion(jobId: string): Promise<void> {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const job = await client.jobs.get(jobId);
		if (job.status === 'completed') return;
		if (job.status === 'failed') {
			throw new Error(job.errorMessage || 'Draft job failed');
		}
		await new Promise<void>((resolve) => setTimeout(resolve, 100));
	}
	throw new Error('Timed out waiting for draft job');
}

export default function GrantDrawer({
	grantId,
	onClose,
	onRefreshAppState,
}: GrantDrawerProps) {
	const [detail, setDetail] = useState<GrantDetailResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [showRevision, setShowRevision] = useState(false);
	const [revisionNote, setRevisionNote] = useState("");
	const [showSubmitForm, setShowSubmitForm] = useState(false);
	const [submitMethod, setSubmitMethod] =
		useState<SubmissionMethod["type"]>("portal");
	const [confirmationId, setConfirmationId] = useState("");
	const [portalUrl, setPortalUrl] = useState("");
	const [submitNotes, setSubmitNotes] = useState("");
	const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
	const [manifest, setManifest] = useState<SubmissionManifest | null>(null);
	const [manifestLoading, setManifestLoading] = useState(false);
	const [closeWarningOpen, setCloseWarningOpen] = useState(false);
	const [showLockedDraftConfirm, setShowLockedDraftConfirm] = useState(false);
	const [overrideField, setOverrideField] = useState<'fit' | 'category' | 'status' | null>(null);
	const [overrideValue, setOverrideValue] = useState('');
	const [overrideRationale, setOverrideRationale] = useState('');

	// Follow-up state
	const [followUps, setFollowUps] = useState<FollowUp[]>([]);
	const [followUpsLoading, setFollowUpsLoading] = useState(false);
	const [showFollowUpForm, setShowFollowUpForm] = useState(false);
	const [newFollowUpType, setNewFollowUpType] = useState<FollowUp['type']>('other');
	const [newFollowUpTitle, setNewFollowUpTitle] = useState('');
	const [newFollowUpDescription, setNewFollowUpDescription] = useState('');
	const [newFollowUpDueDate, setNewFollowUpDueDate] = useState('');
	const [showOutcomeForm, setShowOutcomeForm] = useState(false);
	const [outcomeNotes, setOutcomeNotes] = useState('');

	// Submission documents for SubmissionReadiness
	const [submissionDocuments, setSubmissionDocuments] = useState<DocumentMetadata[]>([]);

	// Draft editing state
	const [draftEditContent, setDraftEditContent] = useState('');
	const [draftEditMode, setDraftEditMode] = useState(false);

	// Grounding approval state
	const [showGroundingWarning, setShowGroundingWarning] = useState(false);
	const [groundingOverrideConfirmed, setGroundingOverrideConfirmed] = useState(false);

	// Submission runbook state
	const [runbookExpanded, setRunbookExpanded] = useState(false);
	const [runbookConfirmationNumber, setRunbookConfirmationNumber] = useState('');
	const [runbookCompleted, setRunbookCompleted] = useState(false);
	const [runbookSaving, setRunbookSaving] = useState(false);
  const [_error, setError] = useState<string | null>(null);

	// Focus trap for dialog accessibility
	const drawerRef = useRef<HTMLDivElement>(null);
	const previousActiveElementRef = useRef<HTMLElement | null>(null);

	const viewModel = buildGrantDrawerViewModel(detail);
	const hasDirtyNotes = revisionNote.trim().length > 0 || submitNotes.trim().length > 0;

	// Initialize draft edit content from grant when detail loads
	const draftContentInitializedRef = useRef(false);
	useEffect(() => {
		if (detail && !draftContentInitializedRef.current) {
			setDraftEditContent(detail.grant.draftContent ?? '');
			draftContentInitializedRef.current = true;
		}
		if (!detail) {
			draftContentInitializedRef.current = false;
		}
	}, [detail]);

	// Autosave draft content
	const saveDraftContent = useCallback(async (content: string) => {
		if (!grantId) return;
		await client.grants.update(grantId, { draftContent: content });
		setDetail((prev) =>
			prev
				? {
						...prev,
						grant: { ...prev.grant, draftContent: content },
					}
				: prev,
		);
	}, [grantId]);

	const {
		isDirty: draftIsDirty,
		isSaving: draftIsSaving,
		lastSaved: draftLastSaved,
		saveNow: draftSaveNow,
		markClean: draftMarkClean,
	} = useAutosave(draftEditContent, saveDraftContent);

	// beforeunload handler for unsaved notes and draft protection
	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (hasDirtyNotes || draftIsDirty) {
				e.preventDefault();
				e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
			}
		};
		if (hasDirtyNotes || draftIsDirty) {
			window.addEventListener('beforeunload', handler);
		}
		return () => {
			window.removeEventListener('beforeunload', handler);
		};
	}, [hasDirtyNotes, draftIsDirty]);

	const loadDetail = useCallback(async () => {
		if (!grantId) {
			setDetail(null);
			return;
		}

		setLoading(true);
		try {
			const data = await client.grants.getById(grantId);
			setDetail(data);
		} catch (_error) {
			setError('Error loading grant detail');
			setDetail(null);
		} finally {
			setLoading(false);
		}
	}, [grantId]);

	// Load submission documents independently of detail loading
	useEffect(() => {
		if (!grantId) {
			setSubmissionDocuments([]);
			return;
		}
		void Promise.resolve()
			.then(() => client.documents?.getAll() ?? Promise.resolve([]))
			.then((docs) => setSubmissionDocuments(docs))
			.catch(() => setSubmissionDocuments([]));
	}, [grantId]);

	const loadManifest = useCallback(async () => {
		if (!grantId) {
			setManifest(null);
			return;
		}

		setManifestLoading(true);
		try {
			const data = await client.manifest.get(grantId);
			setManifest(data);
		} catch (_error) {
			setError('Error loading submission manifest');
			setManifest(null);
		} finally {
			setManifestLoading(false);
		}
	}, [grantId]);

	useEffect(() => {
		void loadDetail();
		void loadManifest();
		setShowRevision(false);
		setRevisionNote("");
		setShowSubmitForm(false);
		setSubmitMethod("portal");
		setConfirmationId("");
		setPortalUrl("");
		setSubmitNotes("");
	}, [loadDetail, loadManifest]);

	useEffect(() => {
		async function loadAuditTrail() {
			if (!grantId) {
				setAuditEvents([]);
				return;
			}
			try {
				const response = await fetch(`/api/audit?entityId=${encodeURIComponent(grantId)}`);
				const data = (await response.json()) as AuditEvent[];
				setAuditEvents(Array.isArray(data) ? data : []);
			} catch (_error) {
				setError('Error loading audit trail');
				setAuditEvents([]);
			}
		}
		void loadAuditTrail();
	}, [grantId]);

	useEffect(() => {
		if (detail?.latestDraft?.id) {
			saveWorkingContextField('recentDraftId', detail.latestDraft.id);
		}
	}, [detail?.latestDraft?.id]);

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!hasDirtyNotes) return;
			event.preventDefault();
			event.returnValue = '';
			return '';
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [hasDirtyNotes]);

	// Load follow-ups for this grant
	useEffect(() => {
		async function loadFollowUps() {
			if (!grantId) {
				setFollowUps([]);
				return;
			}
			setFollowUpsLoading(true);
			try {
				const data = await client.followUps.getFiltered({ grantId });
				setFollowUps(Array.isArray(data) ? data : []);
			} catch (_error) {
				setError('Error loading follow-ups');
				setFollowUps([]);
			} finally {
				setFollowUpsLoading(false);
			}
		}
		void loadFollowUps();
	}, [grantId]);

	// Show outcome form when grant transitions to a terminal status
	useEffect(() => {
		if (detail?.grant.status) {
			const terminalStatuses: GrantStatus[] = ['awarded', 'declined', 'closed', 'archived'];
			if (terminalStatuses.includes(detail.grant.status)) {
				setShowOutcomeForm(true);
			}
		}
	}, [detail?.grant.status]);

	const refreshAfterMutation = async () => {
		await loadDetail();
		await loadManifest();
		await onRefreshAppState?.();
	};

	const handleGenerateDraft = async () => {
		if (!detail) return;
		// Check for existing approval record (locked draft)
		if (detail.approvalRecord) {
			setShowLockedDraftConfirm(true);
			return;
		}
		await doGenerateDraft();
	};

	const doGenerateDraft = async () => {
		if (!detail) return;
		try {
			const response = await client.drafts.create(detail.grant.id, { revisionNotes: "" });
			if (response && typeof response === 'object' && 'queued' in response) {
				await waitForJobCompletion(response.job.id);
			}
			await refreshAfterMutation();
		} catch (_error) {
			setError('Error generating draft');
		}
	};

	const handleConfirmLockedDraftOverwrite = async () => {
		setShowLockedDraftConfirm(false);
		await doGenerateDraft();
	};

	const handleApproveAndLock = async () => {
		if (!detail) return;

		// Check grounding: block approval if any section has isGrounded: false
		const hasUngroundedSections = detail.latestDraft?.groundingSections?.some(
			(section) => !section.isGrounded,
		);

		if (hasUngroundedSections) {
			setShowGroundingWarning(true);
			return;
		}

		await doApproveAndLock();
	};

	const doApproveAndLock = async () => {
		if (!detail) return;
		try {
			await client.approvals.create(detail.grant.id, { approvedBy: "human" });
			setShowGroundingWarning(false);
			setGroundingOverrideConfirmed(false);
			await refreshAfterMutation();
		} catch (_error) {
			setError('Error approving grant');
		}
	};

	const handleSubmit = async () => {
		if (!detail) return;
		try {
			const method: SubmissionMethod = {
				type: submitMethod,
				submittedBy: "human",
			};
			if (submitMethod === "portal" && portalUrl) {
				method.portalUrl = portalUrl;
			}
			if (confirmationId) {
				method.confirmationId = confirmationId;
			}
			await client.submit.create(detail.grant.id, { method, notes: submitNotes });
			setShowSubmitForm(false);
			await refreshAfterMutation();
			onClose();
		} catch (_error) {
			setError('Error submitting grant');
		}
	};

	const handleRequestRevision = () => {
		setShowRevision(true);
	};

	const handleRequestClose = () => {
		if (hasDirtyNotes || draftIsDirty) {
			setCloseWarningOpen(true);
			return;
		}
		onClose();
	};

	const handleDiscardUnsavedNotes = () => {
		setRevisionNote('');
		setSubmitNotes('');
		setShowRevision(false);
		setShowSubmitForm(false);
		setCloseWarningOpen(false);
		onClose();
	};

	function getFocusableElements(container: HTMLElement): HTMLElement[] {
		const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
		return Array.from(container.querySelectorAll<HTMLElement>(selector));
	}

	const handleDialogKeyDown = (e: React.KeyboardEvent) => {
		if (!drawerRef.current) return;
		const focusables = getFocusableElements(drawerRef.current);
		if (focusables.length === 0) return;
		const first = focusables[0]!;
		const last = focusables[focusables.length - 1]!;

		if (e.key === 'Tab') {
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		if (e.key === 'Escape') {
			e.stopPropagation();
			handleRequestClose();
		}
	};

	useEffect(() => {
		if (!grantId || !drawerRef.current) return;
		previousActiveElementRef.current = document.activeElement as HTMLElement;
		const focusables = getFocusableElements(drawerRef.current);
		if (focusables.length > 0) {
			focusables[0]!.focus();
		}
		return () => {
			previousActiveElementRef.current?.focus();
			previousActiveElementRef.current = null;
		};
	}, [grantId]);

	const handleConfirmRevision = async () => {
		if (!detail || !revisionNote.trim()) return;
		try {
			await client.revisions.create(detail.grant.id, revisionNote, "human");
			await refreshAfterMutation();
			setShowRevision(false);
			setRevisionNote("");
		} catch (_error) {
			setError('Error creating revision request');
		}
	};

	const handleCreateManifest = async () => {
		if (!detail) return;
		try {
			await client.manifest.create(detail.grant.id, {});
			await refreshAfterMutation();
		} catch (_error) {
			setError('Error creating submission manifest');
		}
	};

	const handleSaveRunbook = async () => {
		if (!grantId) return;
		setRunbookSaving(true);
		try {
			await fetch(`/api/grants/${encodeURIComponent(grantId)}/manifest`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					confirmationNumber: runbookConfirmationNumber || undefined,
					runbookCompleted,
				}),
			});
			await loadManifest();
		} catch (_error) {
			setError('Error saving runbook');
		} finally {
			setRunbookSaving(false);
		}
	};

	// Sync runbook state from manifest when it loads
	useEffect(() => {
		if (manifest) {
			setRunbookConfirmationNumber(manifest.confirmationNumber ?? '');
			setRunbookCompleted(manifest.runbookCompleted ?? false);
		}
	}, [manifest]);

	const handleCancelRevision = () => {
		setShowRevision(false);
		setRevisionNote("");
	};

	const handleSubmitOverride = async () => {
		if (!detail || !overrideField || !overrideRationale.trim()) return;
		const newValue =
			overrideField === 'fit'
				? Number(overrideValue)
				: overrideValue.trim();
		if (overrideField === 'fit' && Number.isNaN(newValue)) {
			return;
		}
		try {
			const response = await fetch(`/api/grants/${encodeURIComponent(detail.grant.id)}/override`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					field: overrideField,
					newValue,
					rationale: overrideRationale.trim(),
					overrideType: overrideField === 'fit' ? 'score' : overrideField === 'category' ? 'category' : 'status',
				}),
			});
			if (!response.ok) {
				throw new Error('Failed to apply override');
			}
			setOverrideField(null);
			setOverrideValue('');
			setOverrideRationale('');
			await refreshAfterMutation();
		} catch (_error) {
			setError('Error applying override');
		}
	};

	const handleSubmitComplete = async (_data: { confirmationNumber: string; submittedAt: string }) => {
		await refreshAfterMutation();
		onClose();
	};

	const handleOpenInEditor = () => {
		if (detail?.grant.externalUrl) {
			window.open(detail.grant.externalUrl);
		}
	};

	const handleViewOnGrantsGov = () => {
		if (detail) {
			window.open(
				`https://www.grants.gov/search?keyword=${encodeURIComponent(detail.grant.title)}`,
			);
		}
	};

	// Follow-up handlers
	const handleCreateFollowUp = async () => {
		if (!detail || !newFollowUpTitle.trim()) return;
		try {
			const id = `followup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const descVal = newFollowUpDescription.trim();
			const dueVal = newFollowUpDueDate;
			const followUp: Omit<FollowUp, 'id' | 'createdAt'> = {
				grantId: detail.grant.id,
				type: newFollowUpType,
				title: newFollowUpTitle.trim(),
				...(descVal ? { description: descVal } : {}),
				...(dueVal ? { dueDate: dueVal } : {}),
				status: 'pending',
			};
			await client.followUps.create({ ...followUp, id, createdAt: new Date().toISOString() } as FollowUp);
			setShowFollowUpForm(false);
			setNewFollowUpType('other');
			setNewFollowUpTitle('');
			setNewFollowUpDescription('');
			setNewFollowUpDueDate('');
			// Reload follow-ups
			const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
			setFollowUps(Array.isArray(data) ? data : []);
		} catch (_error) {
			setError('Error creating follow-up');
		}
	};

	const handleMarkComplete = async (followUp: FollowUp) => {
		try {
			const now = new Date().toISOString();
			await client.followUps.update({
				...followUp,
				status: 'completed',
				completedAt: now,
			});
			// Reload
			const data = await client.followUps.getFiltered({ grantId: detail!.grant.id });
			setFollowUps(Array.isArray(data) ? data : []);
		} catch (_error) {
			setError('Error marking follow-up complete');
		}
	};

	const handleDeleteFollowUp = async (id: string) => {
		try {
			await client.followUps.delete(id);
			// Reload
			const data = await client.followUps.getFiltered({ grantId: detail!.grant.id });
			setFollowUps(Array.isArray(data) ? data : []);
		} catch (_error) {
			setError('Error deleting follow-up');
		}
	};

	const handleSaveOutcome = async () => {
		if (!detail || !outcomeNotes.trim()) return;
		try {
			const id = `followup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			await client.followUps.create({
				grantId: detail.grant.id,
				type: 'next_steps',
				title: `Outcome: ${detail.grant.statusLabel}`,
				description: outcomeNotes.trim(),
				status: 'completed',
				completedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
				id,
			} as FollowUp);
			setShowOutcomeForm(false);
			setOutcomeNotes('');
			const data = await client.followUps.getFiltered({ grantId: detail.grant.id });
			setFollowUps(Array.isArray(data) ? data : []);
		} catch (_error) {
			setError('Error saving outcome');
		}
	};

	function isOverdue(followUp: FollowUp): boolean {
		if (!followUp.dueDate) return false;
		if (followUp.status === 'completed') return false;
		return new Date(followUp.dueDate) < new Date();
	}

	if (!grantId) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Grant details"
			ref={drawerRef}
			onKeyDown={handleDialogKeyDown}
		>
			<button
				type="button"
				className="drawer-overlay open"
				onClick={handleRequestClose}
				aria-label="Close grant drawer"
			/>
			<aside className="drawer open">
				{loading ? (
					<div className="drawer-header">
						<div className="spinner-overlay" style={{ padding: '24px 0' }} role="status" aria-busy="true" aria-label="Loading grant details">
							<div className="spinner" />
						</div>
					</div>
				) : detail ? (
					<>
						<div className="drawer-header">
							<button type="button" className="drawer-close" onClick={handleRequestClose} aria-label="Close">
								×
							</button>
							<div className="drawer-funder">{detail.grant.funder}</div>
							<h2 className="drawer-title">{detail.grant.title}</h2>
							<div className="drawer-meta">
								<div className="meta-item">
									<div className="meta-label">Award</div>
									<div className="meta-value">{detail.grant.award}</div>
								</div>
								<div className="meta-item">
									<div className="meta-label">LOI Due</div>
									<div className="meta-value">
										{detail.grant.deadline === "Rolling"
											? "Rolling"
											: formatDate(detail.grant.deadline)}
										{detail.grant.deadlineConfidence === 'estimated' && (
											<span data-testid="deadline-confidence-badge" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(estimated)</span>
										)}
										{detail.grant.deadlineConfidence === 'unknown' && (
											<span data-testid="deadline-confidence-badge" style={{ fontSize: '11px', color: 'var(--warning)', marginLeft: '4px' }}>(date uncertain)</span>
										)}
									</div>
								</div>
								<div className="meta-item">
									<div className="meta-label">Fit Score</div>
									<div
										className="meta-value"
										style={{
											color:
												detail.grant.fit >= 85
													? "var(--success)"
													: detail.grant.fit >= 70
														? "var(--accent)"
														: "var(--text)",
										}}
									>
										{detail.grant.fit}
										{detail.grant.humanOverrides?.some((override) => override.field === 'fit') && (
											<span data-testid="fit-human-confirmed-badge" className="ai-badge">Human-confirmed</span>
										)}
									</div>
								</div>
								<div className="meta-item">
									<div className="meta-label">Status</div>
									<div className="meta-value">{detail.grant.statusLabel}</div>
								</div>
								{detail.grant.category && (
									<div className="meta-item">
										<div className="meta-label">Category</div>
										<div className="meta-value">{detail.grant.category}</div>
									</div>
								)}
							</div>
						</div>

						<div className="drawer-body">
							{detail.grant.fitBreakdown && (
								<div className="drawer-section">
									<h3>Why it fits</h3>
									<div className="fit-breakdown">
										{(
											[
												[
													"Mission alignment",
													detail.grant.fitBreakdown.missionAlignment,
												],
												[
													"Geographic focus",
													detail.grant.fitBreakdown.geographicFocus,
												],
												[
													"Program track record",
													detail.grant.fitBreakdown.programTrackrecord,
												],
												[
													"Budget capacity",
													detail.grant.fitBreakdown.budgetCapacity,
												],
												[
													"Partnership readiness",
													detail.grant.fitBreakdown.partnershipReadiness,
												],
											] as const
										).map(([label, score]) => (
											<div className="fit-row" key={label}>
												<div className="fit-row-label">{label}</div>
												<div className="fit-row-bar">
													<div style={{ transform: `scaleX(${score / 100})`, transformOrigin: 'left' }} />
												</div>
												<div className="fit-row-val">{score}</div>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="drawer-section">
								<h3>Funder summary (agent-generated)</h3>
								<p>{detail.grant.funderSummary}</p>
								<div className="drawer-note">
									Sources: {detail.grant.sourceCount ?? 0} · Grounded docs:{" "}
									{detail.grant.groundedDocumentCount ?? 0}
								</div>
							</div>

							<div className="drawer-section">
								<h3>Requirements checklist</h3>
								<div className="checklist-list">
									{(detail.grant.checklist || []).map((item) => (
										<div
											key={item.label}
											className={`checklist-item ${item.done ? "done" : ""}`}
										>
											<span>{item.done ? "✓" : "○"}</span>
											<div>
												<div>{item.label}</div>
												<div className="drawer-note">{item.source}</div>
											</div>
										</div>
									))}
								</div>
							</div>

							<div className="drawer-section">
								<h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									Drafted Letter of Intent — preview
									{draftIsDirty && (
										<span data-testid="draft-dirty-indicator" style={{ color: 'var(--warning)', fontSize: '11px' }}>Unsaved</span>
									)}
									{draftIsSaving && (
										<span data-testid="draft-saving-indicator" style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Saving...</span>
									)}
									{draftLastSaved && !draftIsDirty && (
										<span data-testid="draft-saved-timestamp" style={{ color: 'var(--success)', fontSize: '11px' }}>
											Saved at {new Date(draftLastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</span>
									)}
								</h3>
								{viewModel.latestDraftPreview ? (
									<div className="draft-meta">
										<span className="ai-badge">
											{`Drafted by agent · grounded in ${detail.grant.groundedDocumentCount} org documents · ${detail.grant.sourceCount} funder sources`}
										</span>
										<span>
											{(() => {
												const words = viewModel.latestDraftPreview.split(/\s+/).filter(w => w.length > 0).length;
												const pages = Math.max(1, Math.ceil(words / 500));
												return `${words.toLocaleString()} words · ${pages} pages`;
											})()}
										</span>
									</div>
								) : (
									<div className="drawer-note">{viewModel.latestDraftVersionLabel}</div>
								)}
								{draftEditMode ? (
									<>
										<textarea
											className="form-input"
											rows={10}
											value={draftEditContent}
											onChange={(e) => setDraftEditContent(e.target.value)}
											aria-label="Edit draft content"
											data-testid="draft-edit-textarea"
											style={{ fontFamily: 'var(--mono)', fontSize: '12px', marginBottom: '8px' }}
										/>
										<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
											<button
												type="button"
												className="btn btn-primary btn-sm"
												onClick={async () => { await draftSaveNow(); }}
												disabled={draftIsSaving}
												data-testid="draft-save-now-btn"
											>
												{draftIsSaving ? 'Saving...' : 'Save Now'}
											</button>
											<button
												type="button"
												className="btn btn-sm"
												onClick={() => {
													setDraftEditMode(false);
													setDraftEditContent(detail.grant.draftContent ?? '');
													draftMarkClean();
												}}
											>
												Done Editing
											</button>
										</div>
									</>
								) : (
									<>
										<div className="draft-preview">
											{previewText(viewModel.latestDraftPreview)}
										</div>
										{viewModel.latestDraftPreview && (
											<button
												type="button"
												className="btn btn-sm"
												onClick={() => setDraftEditMode(true)}
												data-testid="draft-edit-btn"
											>
												Edit Draft
											</button>
										)}
									</>
								)}
								<div className="drawer-note">
									Revision requests:{" "}
									{detail.latestRevisionRequest
										? detail.latestRevisionRequest.status
										: "none"}
								</div>
								{detail.latestRevisionRequest && (
									<div className="drawer-note">
										Last revision note: {detail.latestRevisionRequest.notes}
									</div>
								)}
							</div>

							{detail.latestDraft && (
								<GroundingReview draftArtifact={detail.latestDraft} />
							)}

							<div className="drawer-section">
								<h3>Submission manifest</h3>
								{manifestLoading ? (
									<div className="drawer-note">Loading manifest...</div>
								) : manifest ? (
									<>
										<div className="drawer-note">Version {manifest.version} · Updated {new Date(manifest.updatedAt).toLocaleString()}</div>
										<div className="drawer-list">
											<div className="drawer-list-item">
												<div className="drawer-list-title">Instructions</div>
												<div className="drawer-note">{manifest.instructions ?? 'Not set'}</div>
											</div>
											<div className="drawer-list-item">
												<div className="drawer-list-title">Portal URL</div>
												<div className="drawer-note">{manifest.portalUrl ?? 'Not set'}</div>
											</div>
											<div className="drawer-list-item">
												<div className="drawer-list-title">File constraints</div>
												<div className="drawer-note">{manifest.fileConstraints ?? 'Not set'}</div>
											</div>
											<div className="drawer-list-item">
												<div className="drawer-list-title">Due date</div>
												<div className="drawer-note">{manifest.dueDate ? formatDate(manifest.dueDate) : 'Not set'}</div>
											</div>
											<div className="drawer-list-item">
												<div className="drawer-list-title">Materials</div>
												<div className="drawer-note">{manifest.materialRefs.length > 0 ? `${manifest.materialRefs.length} item${manifest.materialRefs.length === 1 ? '' : 's'}` : 'None yet'}</div>
											</div>
											{manifest.materialRefs.length > 0 && (
												<div className="drawer-list-item">
													<div className="drawer-list-title">Material refs</div>
													<div className="drawer-note">{manifest.materialRefs.map((item) => `${item.documentName}${item.version ? ` (${item.version})` : ''} · ${item.role}`).join(' | ')}</div>
												</div>
											)}
											<div className="drawer-list-item">
												<div className="drawer-list-title">Notes</div>
												<div className="drawer-note">{manifest.notes ?? 'Not set'}</div>
											</div>
										</div>
									</>
								) : (
									<>
										<div className="drawer-note">No submission manifest yet.</div>
										<button type="button" className="btn btn-primary" onClick={handleCreateManifest}>
											Create manifest
										</button>
									</>
								)}
							</div>

							{/* Submission Runbook */}
							{(detail.grant.status === 'submission-ready' || detail.grant.status === 'submitted') && (
								<div className="drawer-section" data-testid="submission-runbook-section">
									<button
										type="button"
										className="drawer-section-toggle"
										aria-expanded={runbookExpanded}
										aria-controls="submission-runbook-content"
										onClick={() => setRunbookExpanded(!runbookExpanded)}
										data-testid="runbook-toggle-btn"
										style={{
											width: '100%',
											textAlign: 'left',
											background: 'none',
											border: 'none',
											cursor: 'pointer',
											color: 'var(--text)',
											font: 'inherit',
										}}
									>
										<h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
											Submission Runbook
											{manifest?.runbookCompleted && (
												<span style={{ color: 'var(--success)', fontSize: '11px' }} data-testid="runbook-completed-badge">
													✓ Completed
												</span>
											)}
											<span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
												{runbookExpanded ? '▲' : '▼'}
											</span>
										</h3>
									</button>
									{runbookExpanded && (
										<div id="submission-runbook-content" data-testid="runbook-content">
											{/* Submission method badge */}
											{manifest?.submissionMethod && (
												<div style={{ marginBottom: '12px' }}>
													<span
														data-testid="runbook-method-badge"
														style={{
															display: 'inline-block',
															padding: '4px 8px',
															borderRadius: '4px',
															fontSize: '11px',
															fontWeight: 600,
															textTransform: 'uppercase',
															letterSpacing: '0.05em',
															background: 'var(--surface-2)',
															border: '1px solid var(--border)',
															color: 'var(--text)',
														}}
													>
														{manifest.submissionMethod === 'portal' && '🌐 Portal'}
														{manifest.submissionMethod === 'email' && '✉️ Email'}
														{manifest.submissionMethod === 'mail' && '📮 Mail'}
														{manifest.submissionMethod === 'other' && '❓ Other'}
													</span>
												</div>
											)}

											{/* Step-by-step guidance per method */}
											<div style={{ marginBottom: '16px' }}>
												<strong style={{ fontSize: '13px' }}>Step-by-step guidance:</strong>
												<ol style={{
													margin: '8px 0 0 0',
													paddingLeft: '20px',
													fontSize: '12px',
													color: 'var(--text-dim)',
													lineHeight: '1.7',
												}}
													data-testid="runbook-steps"
												>
													{(!manifest?.submissionMethod || manifest.submissionMethod === 'portal') && (
														<>
															<li>Log in at {manifest?.portalUrl || 'the submission portal'}</li>
															<li>Navigate to the submissions section</li>
															<li>Upload required files{manifest?.fileConstraints ? ` (${manifest.fileConstraints})` : ''}</li>
															<li>Review and confirm submission</li>
															<li>Save the confirmation number below</li>
														</>
													)}
													{manifest?.submissionMethod === 'email' && (
														<>
															<li>Compose email to the funder contact</li>
															<li>Attach required files{manifest.fileConstraints ? ` (${manifest.fileConstraints})` : ''}</li>
															<li>Include confirmation request in the email body</li>
															<li>Send and save the confirmation reply number below</li>
														</>
													)}
													{manifest?.submissionMethod === 'mail' && (
														<>
															<li>Print all required documents</li>
															<li>Package securely with tracking</li>
															<li>Mail to the funder address</li>
															<li>Record tracking number below</li>
														</>
													)}
													{manifest?.submissionMethod === 'other' && (
														<>
															<li>Follow the funder&apos;s specific submission instructions</li>
															<li>Record any confirmation details below</li>
														</>
													)}
												</ol>
											</div>

											{/* Confirmation number input */}
											<div style={{ marginBottom: '12px' }}>
												<label
													htmlFor="runbook-confirmation-number"
													style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-dim)' }}
												>
													Confirmation number / tracking info:
												</label>
												<input
													id="runbook-confirmation-number"
													type="text"
													className="form-input"
													placeholder="Enter confirmation number"
													value={runbookConfirmationNumber}
													onChange={(e) => setRunbookConfirmationNumber(e.target.value)}
													data-testid="runbook-confirmation-input"
													aria-describedby="runbook-confirmation-help"
												/>
											</div>

											{/* I have completed checkbox */}
											<div style={{ marginBottom: '12px' }}>
												<label
													style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}
												>
													<input
														type="checkbox"
														checked={runbookCompleted}
														onChange={(e) => setRunbookCompleted(e.target.checked)}
														data-testid="runbook-completed-checkbox"
													/>
													I have completed this step
												</label>
											</div>

											{/* Save button */}
											<button
												type="button"
												className="btn btn-primary"
												onClick={handleSaveRunbook}
												disabled={runbookSaving}
												data-testid="runbook-save-btn"
											>
												{runbookSaving ? 'Saving...' : 'Save runbook progress'}
											</button>
										</div>
									)}
								</div>
							)}

							{detail.workflow.canSubmit && (
								<SubmissionReadiness
									grant={detail.grant}
									latestDraft={detail.latestDraft}
									approvalRecord={detail.approvalRecord}
									documents={submissionDocuments}
									manifest={manifest}
									onSubmitComplete={handleSubmitComplete}
								/>
							)}

							<div className="drawer-section">
								<h3>Actions</h3>
								<div className="drawer-actions">
									{viewModel.showGenerateDraft && (
										<button
											type="button"
											className="btn btn-primary"
											title="Generate an AI-powered grant draft"
											onClick={handleGenerateDraft}
										>
											Generate draft
										</button>
									)}
									{viewModel.showApprove && (
										<button
											type="button"
											className="btn btn-primary"
											title="Approve the draft and lock it from further edits"
											onClick={handleApproveAndLock}
										>
											Approve &amp; lock
										</button>
									)}
									{viewModel.showRequestRevision && (
										<button
											type="button"
											className="btn"
											title="Send the draft back for revision"
											onClick={handleRequestRevision}
										>
											Request revision
										</button>
									)}
									{viewModel.showSubmit && (
										<button
											type="button"
											className="btn"
											title="Submit the approved grant application"
											onClick={() => setShowSubmitForm(true)}
										>
											Submit
										</button>
									)}
									<button
										type="button"
										className="btn btn-ghost"
										onClick={handleOpenInEditor}
									>
										Open in editor
									</button>
									<button
										type="button"
										className="btn btn-ghost"
										onClick={handleViewOnGrantsGov}
									>
										View on grants.gov
									</button>
								</div>
								{!detail.workflow.canSubmit &&
									viewModel.submitDisabledReason && (
										<div className="drawer-note">
											Submission blocked: {viewModel.submitDisabledReason}
										</div>
									)}
							</div>

							<div className="drawer-section">
								<h3>Human overrides</h3>
								<div className="drawer-actions">
									<button type="button" data-testid="override-fit-score-btn" onClick={() => {
										setOverrideField('fit');
										setOverrideValue(String(detail.grant.fit));
										setOverrideRationale('');
									}}>
										Override fit score
									</button>
									<button type="button" onClick={() => {
										setOverrideField('category');
										setOverrideValue(detail.grant.category ?? '');
										setOverrideRationale('');
									}}>
										Override category
									</button>
									<button type="button" onClick={() => {
										setOverrideField('status');
										setOverrideValue(detail.grant.status);
										setOverrideRationale('');
									}}>
										Override status
									</button>
								</div>
								{overrideField && (
									<div className="override-panel">
										<div className="drawer-note">Provide a rationale before saving.</div>
										{overrideField === 'fit' ? (
											<input type="number" min={0} max={100} className="form-input" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
										) : overrideField === 'status' ? (
											<select value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)}>
												{(['matched', 'draft', 'review', 'approved', 'submission-ready', 'submitted', 'follow-up', 'awarded', 'declined', 'closed', 'archived'] as GrantStatus[]).map((status) => (
													<option key={status} value={status}>{status}</option>
												))}
											</select>
										) : (
											<input type="text" className="form-input" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
										)}
										<textarea className="form-input" rows={3} placeholder="Rationale" value={overrideRationale} onChange={(e) => setOverrideRationale(e.target.value)} />
										<div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
											<button type="button" onClick={() => void handleSubmitOverride()}>Save override</button>
											<button type="button" onClick={() => { setOverrideField(null); setOverrideValue(''); setOverrideRationale(''); }}>Cancel</button>
										</div>
									</div>
								)}
							</div>

							<div className="drawer-section">
								<h3>Audit Trail</h3>
								<div className="activity-list">
									{auditEvents.slice(0, 10).map((event) => (
										<div key={event.id} className="activity-item">
											<div>
												<div className="activity-text"><strong>{event.eventType}</strong> · {event.actorLabel}</div>
												<div className="activity-time">{new Date(event.timestamp).toLocaleString()}</div>
											</div>
										</div>
									))}
								</div>
							</div>

							{showRevision && (
								<div className="drawer-section">
									<h3>Revision notes</h3>
									<textarea
										className="form-input"
										rows={4}
										value={revisionNote}
										onChange={(e) => setRevisionNote(e.target.value)}
									/>
									<div
										style={{ display: "flex", gap: "8px", marginTop: "12px" }}
									>
										<button
											type="button"
											className="btn btn-primary"
											onClick={handleConfirmRevision}
										>
											Save revision
										</button>
										<button
											type="button"
											className="btn"
											onClick={handleCancelRevision}
										>
											Cancel
										</button>
									</div>
								</div>
							)}

							{showSubmitForm && (
								<div className="drawer-section">
									<h3>Submit grant</h3>
									<select
										value={submitMethod}
										onChange={(e) =>
											setSubmitMethod(
												e.target.value as SubmissionMethod["type"],
											)
										}
									>
										<option value="portal">Portal</option>
										<option value="email">Email</option>
										<option value="mail">Mail</option>
										<option value="other">Other</option>
									</select>
									{submitMethod === "portal" && (
										<input
											type="url"
											className="form-input"
											placeholder="Portal URL"
											value={portalUrl}
											onChange={(e) => setPortalUrl(e.target.value)}
										/>
									)}
									<input
										type="text"
										className="form-input"
										placeholder="Confirmation ID"
										value={confirmationId}
										onChange={(e) => setConfirmationId(e.target.value)}
									/>
									<textarea
										className="form-input"
										rows={3}
										placeholder="Submission notes"
										value={submitNotes}
										onChange={(e) => setSubmitNotes(e.target.value)}
									/>
									<div
										style={{ display: "flex", gap: "8px", marginTop: "12px" }}
									>
										<button
											type="button"
											className="btn btn-primary"
											onClick={handleSubmit}
										>
											Submit
										</button>
										<button
											type="button"
											className="btn"
											onClick={() => setShowSubmitForm(false)}
										>
											Cancel
										</button>
									</div>
								</div>
							)}

							{/* Follow-ups Section */}
							<div className="drawer-section" data-testid="grant-drawer-follow-ups">
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
									<h3 style={{ marginBottom: 0 }}>Follow-ups</h3>
									<button
										type="button"
										className="btn btn-sm"
										onClick={() => setShowFollowUpForm(!showFollowUpForm)}
										data-testid="add-follow-up-btn"
										aria-label={showFollowUpForm ? 'Cancel new follow-up' : 'Add follow-up'}
									>
										{showFollowUpForm ? 'Cancel' : '+ Add follow-up'}
									</button>
								</div>

								{/* Create follow-up form */}
								{showFollowUpForm && (
									<div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '12px' }} data-testid="follow-up-create-form">
										<select
											className="form-input"
											value={newFollowUpType}
											onChange={(e) => setNewFollowUpType(e.target.value as FollowUp['type'])}
											style={{ marginBottom: '8px' }}
											aria-label="Follow-up type"
										>
											<option value="progress_check">Progress Check</option>
											<option value="report_due">Report Due</option>
											<option value="stipulation">Stipulation</option>
											<option value="next_steps">Next Steps</option>
											<option value="other">Other</option>
										</select>
										<input
											type="text"
											className="form-input"
											placeholder="Title"
											value={newFollowUpTitle}
											onChange={(e) => setNewFollowUpTitle(e.target.value)}
											style={{ marginBottom: '8px' }}
											aria-label="Follow-up title"
										/>
										<textarea
											className="form-input"
											rows={2}
											placeholder="Description (optional)"
											value={newFollowUpDescription}
											onChange={(e) => setNewFollowUpDescription(e.target.value)}
											style={{ marginBottom: '8px' }}
											aria-label="Follow-up description"
										/>
										<input
											type="date"
											className="form-input"
											value={newFollowUpDueDate}
											onChange={(e) => setNewFollowUpDueDate(e.target.value)}
											style={{ marginBottom: '8px' }}
											aria-label="Due date"
										/>
										<div style={{ display: 'flex', gap: '8px' }}>
											<button
												type="button"
												className="btn btn-primary btn-sm"
												onClick={handleCreateFollowUp}
												disabled={!newFollowUpTitle.trim()}
												data-testid="save-follow-up-btn"
											>
												Save
											</button>
										</div>
									</div>
								)}

								{/* Outcome tracking for terminal statuses */}
								{showOutcomeForm && (
									<div style={{ background: 'rgba(212, 169, 67, 0.06)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '12px' }} data-testid="outcome-tracking-form">
										<div className="drawer-note" style={{ marginBottom: '8px', color: 'var(--accent)' }}>
											Grant is now <strong>{detail.grant.statusLabel}</strong>. Record outcome notes:
										</div>
										<textarea
											className="form-input"
											rows={3}
											placeholder="What happened? Capture lessons learned, next steps, or closure notes..."
											value={outcomeNotes}
											onChange={(e) => setOutcomeNotes(e.target.value)}
											style={{ marginBottom: '8px' }}
											aria-label="Outcome notes"
										/>
										<div style={{ display: 'flex', gap: '8px' }}>
											<button
												type="button"
												className="btn btn-primary btn-sm"
												onClick={handleSaveOutcome}
												disabled={!outcomeNotes.trim()}
												data-testid="save-outcome-btn"
											>
												Save outcome
											</button>
											<button
												type="button"
												className="btn btn-sm"
												onClick={() => { setShowOutcomeForm(false); setOutcomeNotes(''); }}
											>
												Dismiss
											</button>
										</div>
									</div>
								)}

								{/* Follow-ups list */}
								{followUpsLoading ? (
									<div className="drawer-note">Loading follow-ups...</div>
								) : followUps.length === 0 ? (
									<div className="drawer-note">No follow-ups yet. Click "+ Add follow-up" to create one.</div>
								) : (
									<div className="drawer-list">
										{[...followUps].sort((a, b) => {
											// Sort: pending first, then overdue, then completed last
											const statusOrder: Record<string, number> = { overdue: 0, pending: 1, completed: 2 };
											const orderA = isOverdue(a) ? 0 : (statusOrder[a.status] ?? 1);
											const orderB = isOverdue(b) ? 0 : (statusOrder[b.status] ?? 1);
											if (orderA !== orderB) return orderA - orderB;
											// Then by due date (earliest first)
											if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
											return 0;
										}).map((followUp) => {
											const overdue = isOverdue(followUp);
											const statusColor =
												followUp.status === 'completed' ? 'var(--success)' :
												overdue ? 'var(--danger)' : 'var(--warning)';
											return (
												<div
													key={followUp.id}
													className="drawer-list-item"
													data-testid={`follow-up-item-${followUp.id}`}
													style={overdue ? { borderColor: 'var(--danger)', borderWidth: '1.5px' } : undefined}
												>
													<div style={{ flex: 1 }}>
														<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
															<span style={{
																fontFamily: 'var(--mono)',
																fontSize: '9px',
																textTransform: 'uppercase',
																letterSpacing: '0.1em',
																padding: '2px 6px',
																borderRadius: '3px',
																background: `${statusColor}22`,
																color: statusColor,
																fontWeight: 600,
															}}>
																{overdue ? 'OVERDUE' : followUp.status}
															</span>
															<span style={{
																fontFamily: 'var(--mono)',
																fontSize: '9px',
																textTransform: 'uppercase',
																color: 'var(--text-muted)',
															}}>
																{followUp.type.replace(/_/g, ' ')}
															</span>
														</div>
														<div className="drawer-list-title" style={{ color: overdue ? 'var(--danger)' : undefined }}>
															{overdue && <AlertTriangle size={16} aria-label="Warning" style={{ color: 'var(--warning)', marginRight: '4px', flexShrink: 0 }} />}
															{followUp.title}
														</div>
														{followUp.description && (
															<div className="drawer-note" style={{ marginTop: '4px' }}>{followUp.description}</div>
														)}
														<div className="drawer-note">
															{followUp.dueDate && (
																<span style={overdue ? { color: 'var(--danger)' } : undefined}>
																	Due {formatDate(followUp.dueDate.slice(0, 10))}
																</span>
															)}
															{followUp.completedAt && (
																<span style={{ color: 'var(--success)' }}>
																	{' '}· Completed {new Date(followUp.completedAt).toLocaleString()}
																</span>
															)}
															{!followUp.dueDate && !followUp.completedAt && (
																<span>No due date</span>
															)}
														</div>
													</div>
													<div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexShrink: 0 }}>
														{followUp.status !== 'completed' && (
															<button
																type="button"
																className="btn btn-sm"
																onClick={() => handleMarkComplete(followUp)}
																data-testid={`mark-complete-btn-${followUp.id}`}
																aria-label={`Mark \"${followUp.title}\" as complete`}
																title="Mark complete"
															>
																✓
															</button>
														)}
														<button
															type="button"
															className="btn btn-sm btn-ghost"
															onClick={() => handleDeleteFollowUp(followUp.id)}
															data-testid={`delete-follow-up-btn-${followUp.id}`}
															aria-label={`Delete \"${followUp.title}\"`}
															title="Delete"
															style={{ color: 'var(--text-muted)' }}
														>
															🗑
														</button>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>

						{closeWarningOpen && (
								<div className="drawer-section" data-testid="grant-drawer-unsaved-warning">
									<h3>Discard unsaved notes?</h3>
									<p>Your revision note or submission notes will be lost if you close the drawer now.</p>
									<div style={{ display: 'flex', gap: '8px' }}>
										<button type="button" onClick={handleDiscardUnsavedNotes}>Discard</button>
										<button type="button" onClick={() => setCloseWarningOpen(false)}>Keep editing</button>
									</div>
								</div>
							)}

							{/* Grounding warning dialog */}
							{showGroundingWarning && detail?.latestDraft && (
								<div className="drawer-section" data-testid="grounding-warning-dialog" role="alert">
									<h3 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={18} /> Ungrounded Claims Detected</h3>
									<p>
										This draft contains sections with unsupported claims that lack evidence from your sources.
										Approving a draft with ungrounded claims may result in a weaker submission.
									</p>
									<div style={{ marginBottom: '12px' }}>
										<strong>Ungrounded sections:</strong>
										<ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'var(--text-dim)' }}>
											{detail.latestDraft.groundingSections
												?.filter((s) => !s.isGrounded)
												.map((s) => (
													<li key={s.sectionTitle}>
														<strong>{s.sectionTitle}</strong>{' — no evidence found'}
													</li>
												))}
										</ul>
									</div>
									<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
										<label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
											<input
												type="checkbox"
												checked={groundingOverrideConfirmed}
												onChange={(e) => setGroundingOverrideConfirmed(e.target.checked)}
												data-testid="grounding-override-checkbox"
											/>
											I understand the risk and want to approve anyway
										</label>
									</div>
									<div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
										<button
											type="button"
											className="btn btn-primary"
											onClick={() => void doApproveAndLock()}
											disabled={!groundingOverrideConfirmed}
											data-testid="grounding-approve-anyway-btn"
										>
											Approve Anyway
										</button>
										<button
											type="button"
											className="btn"
											onClick={() => {
												setShowGroundingWarning(false);
												setGroundingOverrideConfirmed(false);
											}}
											data-testid="grounding-cancel-btn"
										>
											Cancel
										</button>
									</div>
								</div>
							)}

							{showLockedDraftConfirm && (
								<div className="drawer-section" data-testid="locked-draft-overwrite-confirm">
									<h3>Overwrite locked draft?</h3>
									<p>This grant has an approved, locked draft. Generating a new draft will unlock it and require re-approval. Continue?</p>
									<div style={{ display: 'flex', gap: '8px' }}>
										<button type="button" className="btn btn-primary" onClick={handleConfirmLockedDraftOverwrite}>Yes, generate new draft</button>
										<button type="button" onClick={() => setShowLockedDraftConfirm(false)}>Cancel</button>
									</div>
								</div>
							)}
						</div>
					</>
				) : null}
			</aside>
		</div>
	);
}
