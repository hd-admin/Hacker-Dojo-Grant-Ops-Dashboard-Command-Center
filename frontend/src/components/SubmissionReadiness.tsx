"use client";

import React, { useMemo, useState } from "react";
import type {
	ApprovalRecord,
	DocumentMetadata,
	DraftArtifact,
	Grant,
	SubmissionManifest,
} from "../../../shared/types";

export interface SubmissionReadinessProps {
	grant: Grant;
	latestDraft: DraftArtifact | null;
	approvalRecord: ApprovalRecord | null;
	documents: DocumentMetadata[];
	manifest: SubmissionManifest | null;
	onSubmitComplete: (data: {
		confirmationNumber: string;
		submittedAt: string;
	}) => void;
}

type ReadinessStatus = "green" | "yellow" | "red";

interface ReadinessItem {
	id: string;
	label: string;
	status: ReadinessStatus;
	detail: string;
}

function computeReadiness(
	grant: Grant,
	latestDraft: DraftArtifact | null,
	approvalRecord: ApprovalRecord | null,
	documents: DocumentMetadata[],
	manifest: SubmissionManifest | null,
): ReadinessItem[] {
	const items: ReadinessItem[] = [];

	// 1. Draft check
	if (!latestDraft) {
		items.push({
			id: "draft",
			label: "Completed draft",
			status: "red",
			detail: "No draft exists. Generate a draft first.",
		});
	} else {
		const ungroundedCount = latestDraft.groundingSections?.filter((s) => !s.isGrounded).length ?? 0;
		const totalSections = latestDraft.groundingSections?.length ?? 0;
		items.push({
			id: "draft",
			label: "Completed draft",
			status: ungroundedCount > 0 ? "yellow" : "green",
			detail: ungroundedCount > 0
				? `Draft version ${latestDraft.version} ready, but ${ungroundedCount}/${totalSections} sections are ungrounded.`
				: `Draft version ${latestDraft.version} ready.`,
		});
	}

	// 2. Approval check
	if (!approvalRecord) {
		items.push({
			id: "approval",
			label: "Approved draft",
			status: "red",
			detail: "Draft must be approved and locked before submission.",
		});
	} else if (approvalRecord.lockedUntil) {
		const lockedUntil = new Date(approvalRecord.lockedUntil);
		if (lockedUntil < new Date()) {
			items.push({
				id: "approval",
				label: "Approved draft",
				status: "yellow",
				detail: "Approval has expired. Re-approve before submission.",
			});
		} else {
			items.push({
				id: "approval",
				label: "Approved draft",
				status: "green",
				detail: `Approved and locked until ${lockedUntil.toLocaleDateString()}.`,
			});
		}
	} else {
		items.push({
			id: "approval",
			label: "Approved draft",
			status: "green",
			detail: "Approved (no lock expiration).",
		});
	}

	// 3. Grounding check
	if (latestDraft?.groundingSections) {
		const ungroundedSections = latestDraft.groundingSections.filter((s) => !s.isGrounded);
		if (ungroundedSections.length > 0) {
			items.push({
				id: "grounding",
				label: "Grounded claims",
				status: "yellow",
				detail: `${ungroundedSections.length} section(s) lack evidence: ${ungroundedSections.map((s) => s.sectionTitle).join(", ")}`,
			});
		} else {
			items.push({
				id: "grounding",
				label: "Grounded claims",
				status: "green",
				detail: "All draft sections are grounded in source evidence.",
			});
		}
	}

	// 4. Required org docs check
	const hasOrgDocs = documents.length > 0;
	items.push({
		id: "org-docs",
		label: "Required org documents",
		status: hasOrgDocs ? "green" : "yellow",
		detail: hasOrgDocs
			? `${documents.length} document(s) available.`
			: "No organization documents uploaded. May be needed for submission.",
	});

	// 5. Manifest check
	const manifestSection: ReadinessItem = manifest
		? {
				id: "manifest",
				label: "Submission manifest",
				status: manifest.materialRefs.length === 0 ? "yellow" : "green",
				detail: manifest.materialRefs.length === 0
					? `Manifest version ${manifest.version} exists, but has no materials listed.`
					: `Manifest version ${manifest.version} with ${manifest.materialRefs.length} material(s).`,
		  }
		: {
				id: "manifest",
				label: "Submission manifest",
				status: "red" as ReadinessStatus,
				detail: "Create a submission manifest to track materials and portal requirements.",
		  };
	items.push(manifestSection);

	// 6. Checklist items
	const checklist = grant.checklist || [];
	if (checklist.length === 0) {
		items.push({
			id: "checklist",
			label: "Requirements checklist",
			status: "yellow",
			detail: "No checklist items defined. Review the grant for required materials.",
		});
	}
	checklist.forEach((item, idx) => {
		const required = item.required === true;
		if (required && !item.done) {
			items.push({
				id: `checklist-${idx}`,
				label: item.label,
				status: "red",
				detail: item.source,
			});
		} else if (!required && !item.done) {
			items.push({
				id: `checklist-${idx}`,
				label: item.label,
				status: "yellow",
				detail: item.source,
			});
		} else {
			items.push({
				id: `checklist-${idx}`,
				label: item.label,
				status: "green",
				detail: item.source,
			});
		}
	});

	return items;
}

function statusDot(status: ReadinessStatus): string {
	switch (status) {
		case "green":
			return "🟢";
		case "yellow":
			return "🟡";
		case "red":
			return "🔴";
	}
}

export default function SubmissionReadiness({
	grant,
	latestDraft,
	approvalRecord,
	documents,
	manifest,
	onSubmitComplete,
}: SubmissionReadinessProps) {
	const [confirmationNumber, setConfirmationNumber] = useState("");
	const [submissionNotes, setSubmissionNotes] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const readinessItems = useMemo(
		() => computeReadiness(grant, latestDraft, approvalRecord, documents, manifest),
		[grant, latestDraft, approvalRecord, documents, manifest],
	);

	const allGreen = readinessItems.every((item) => item.status === "green");

	const handleSubmit = () => {
		const now = new Date().toISOString();
		onSubmitComplete({
			confirmationNumber,
			submittedAt: now,
		});
		setSubmitted(true);
	};

	return (
		<div className="submission-readiness" role="region" aria-label="Submission readiness">
			{/* Readiness Checklist */}
			<div className="drawer-section">
				<h3>Submission Readiness</h3>
				<div className="readiness-summary">
					{allGreen ? (
						<span className="readiness-all-green">✓ All checks passed — ready to submit</span>
					) : (
						<span className="readiness-has-issues">
							⚠ {readinessItems.filter((i) => i.status !== "green").length} issue(s) to resolve
						</span>
					)}
				</div>
				<div className="checklist-list">
					{readinessItems.map((item) => (
						<div
							key={item.id}
							data-testid={`readiness-${item.id}`}
							className={`checklist-item readiness-${item.status}`}
						>
							<span>{statusDot(item.status)}</span>
							<div>
								<div>{item.label}</div>
								<div className="drawer-note">{item.detail}</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Submission Manifest */}
			<div className="drawer-section">
				<h3>Submission Package</h3>
				{manifest ? (
					<>
						<div className="drawer-note">
							Version {manifest.version} · Updated{" "}
							{new Date(manifest.updatedAt).toLocaleString()}
						</div>
						{manifest.materialRefs.length > 0 ? (
							<div className="checklist-list">
								{manifest.materialRefs.map((ref) => (
									<div key={ref.documentId} className="checklist-item">
										<span>📄</span>
										<div>
											<div>{ref.documentName}</div>
											<div className="drawer-note">
												{ref.role}
												{ref.version ? ` · ${ref.version}` : ""}
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="drawer-note">No materials in manifest.</div>
						)}
						{manifest.instructions && (
							<div className="drawer-note" style={{ marginTop: "8px" }}>
								<strong>Instructions:</strong> {manifest.instructions}
							</div>
						)}
					</>
				) : (
					<div className="drawer-note">No submission manifest yet. Generate a manifest first.</div>
				)}
			</div>

			{/* External Action Notice */}
			<div className="drawer-section">
				<h3>Complete on Funder Portal</h3>
				<div className="drawer-note external-action-notice" role="alert">
					Complete the following on the funder portal after readiness checks pass:
				</div>
				{manifest?.portalUrl && (
					<div className="drawer-note">
						<strong>Portal URL:</strong>{" "}
						<a href={manifest.portalUrl} target="_blank" rel="noopener noreferrer">
							{manifest.portalUrl}
						</a>
					</div>
				)}
				{manifest?.instructions && (
					<div className="drawer-note">
						<strong>Instructions:</strong> {manifest.instructions}
					</div>
				)}
			</div>

			{/* Confirmation Recording */}
			{!submitted && (
				<div className="drawer-section">
					<h3>Record Submission</h3>
					<div className="drawer-note">
						After completing submission on the funder portal, record the confirmation
						details here.
					</div>
					<input
						type="text"
						className="form-input"
						placeholder="Confirmation number (e.g., GRANTS-12345)"
						value={confirmationNumber}
						onChange={(e) => setConfirmationNumber(e.target.value)}
						aria-label="Confirmation number"
					/>
					<textarea
						className="form-input"
						rows={3}
						placeholder="Submission notes (optional)"
						value={submissionNotes}
						onChange={(e) => setSubmissionNotes(e.target.value)}
						aria-label="Submission notes"
					/>
					<button
						type="button"
						className="btn btn-primary"
						onClick={handleSubmit}
						disabled={!allGreen || !confirmationNumber.trim()}
						aria-label="Record submission"
					>
						Record submission
					</button>
				</div>
			)}

			{submitted && (
				<div className="drawer-section">
					<h3>Submission Recorded</h3>
					<div className="drawer-note">
						✓ Submission recorded at {new Date().toLocaleString()}
					</div>
					{confirmationNumber && (
						<div className="drawer-note">
							Confirmation: {confirmationNumber}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
