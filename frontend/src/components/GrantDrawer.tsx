"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
	AuditEvent,
	GrantDetailResponse,
	SubmissionManifest,
	SubmissionMethod,
} from "../../../shared/types";
import { client } from "../lib/grant-ops-client";

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

	const viewModel = buildGrantDrawerViewModel(detail);

	const loadDetail = useCallback(async () => {
		if (!grantId) {
			setDetail(null);
			return;
		}

		setLoading(true);
		try {
			const data = await client.grants.getById(grantId);
			setDetail(data);
		} catch (error) {
			console.error("Error loading grant detail:", error);
			setDetail(null);
		} finally {
			setLoading(false);
		}
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
		} catch (error) {
			console.error("Error loading submission manifest:", error);
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
			} catch (error) {
				console.error('Error loading audit trail:', error);
				setAuditEvents([]);
			}
		}
		void loadAuditTrail();
	}, [grantId]);

	const refreshAfterMutation = async () => {
		await loadDetail();
		await loadManifest();
		await onRefreshAppState?.();
	};

	const handleGenerateDraft = async () => {
		if (!detail) return;
		try {
			await client.drafts.create(detail.grant.id, { revisionNotes: "" });
			await refreshAfterMutation();
		} catch (error) {
			console.error("Error generating draft:", error);
		}
	};

	const handleApproveAndLock = async () => {
		if (!detail) return;
		try {
			await client.approvals.create(detail.grant.id, { approvedBy: "human" });
			await refreshAfterMutation();
		} catch (error) {
			console.error("Error approving grant:", error);
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
		} catch (error) {
			console.error("Error submitting grant:", error);
		}
	};

	const handleRequestRevision = () => {
		setShowRevision(true);
	};

	const handleConfirmRevision = async () => {
		if (!detail || !revisionNote.trim()) return;
		try {
			await client.revisions.create(detail.grant.id, revisionNote, "human");
			await refreshAfterMutation();
			setShowRevision(false);
			setRevisionNote("");
		} catch (error) {
			console.error("Error creating revision request:", error);
		}
	};

	const handleCreateManifest = async () => {
		if (!detail) return;
		try {
			await client.manifest.create(detail.grant.id, {});
			await refreshAfterMutation();
		} catch (error) {
			console.error("Error creating submission manifest:", error);
		}
	};

	const handleCancelRevision = () => {
		setShowRevision(false);
		setRevisionNote("");
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

	if (!grantId) {
		return null;
	}

	return (
		<React.Fragment>
			<button
				type="button"
				className="drawer-overlay open"
				onClick={onClose}
				aria-label="Close grant drawer"
			/>
			<aside className="drawer open">
				{loading ? (
					<div className="drawer-header">
						<div className="drawer-funder">Loading...</div>
					</div>
				) : detail ? (
					<>
						<div className="drawer-header">
							<button type="button" className="drawer-close" onClick={onClose}>
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
													<div style={{ width: `${score}%` }} />
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
								<h3>Drafted Letter of Intent — preview</h3>
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
								<div className="draft-preview">
									{previewText(viewModel.latestDraftPreview)}
								</div>
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

							{detail.latestDraft?.groundingSections && detail.latestDraft.groundingSections.length > 0 && (
								<div className="drawer-section">
									<h3>Grounding review</h3>
									{detail.grant.groundedDocumentCount === 0 && (
										<div className="drawer-note">⚠ No grounding documents</div>
									)}
									<div className="checklist-list">
										{detail.latestDraft.groundingSections.map((section) => (
											<div key={section.sectionTitle} className={`checklist-item ${section.isGrounded ? 'done' : ''}`}>
												<span>{section.isGrounded ? '✓' : '○'}</span>
												<div>
													<div>{section.sectionTitle}</div>
													<div className="drawer-note">{section.isGrounded ? 'Grounded' : 'No evidence'}</div>
												</div>
											</div>
										))}
									</div>
								</div>
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

							<div className="drawer-section">
								<h3>Actions</h3>
								<div className="drawer-actions">
									{viewModel.showGenerateDraft && (
										<button
											type="button"
											className="btn btn-primary"
											onClick={handleGenerateDraft}
										>
											Generate draft
										</button>
									)}
									{viewModel.showApprove && (
										<button
											type="button"
											className="btn btn-primary"
											onClick={handleApproveAndLock}
										>
											Approve &amp; lock
										</button>
									)}
									{viewModel.showRequestRevision && (
										<button
											type="button"
											className="btn"
											onClick={handleRequestRevision}
										>
											Request revision
										</button>
									)}
									{viewModel.showSubmit && (
										<button
											type="button"
											className="btn"
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

							{detail.followUps.length > 0 && (
								<div className="drawer-section">
									<h3>Follow-ups</h3>
									<div className="drawer-list">
										{detail.followUps.map((followUp) => (
											<div key={followUp.id} className="drawer-list-item">
												<div className="drawer-list-title">
													{followUp.title}
												</div>
												<div className="drawer-note">
													{followUp.type} · {followUp.status}
													{followUp.dueDate
														? ` · Due ${formatDate(followUp.dueDate.slice(0, 10))}`
														: ""}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</>
				) : null}
			</aside>
		</React.Fragment>
	);
}
