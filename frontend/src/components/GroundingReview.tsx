"use client";

import React, { useCallback, useState } from "react";
import type { DraftArtifact } from "../../../shared/types";

export interface GroundingReviewProps {
	draftArtifact: DraftArtifact;
	onReviewComplete?: (complete: boolean) => void;
}

export interface GroundingSectionState {
	sectionTitle: string;
	evidence: string[];
	isGrounded: boolean;
	reviewed: boolean;
}

function groundingQualityLabel(isGrounded: boolean): {
	label: string;
	className: string;
	indicator: string;
} {
	if (isGrounded) {
		return {
			label: "Well-grounded",
			className: "grounding-well",
			indicator: "●",
		};
	}
	return {
		label: "Unsupported",
		className: "grounding-unsupported",
		indicator: "▲",
	};
}

function parseEvidenceForDisplay(evidence: string[]): {
	sourceName: string;
	sourceType: "document" | "source" | "other";
}[] {
	return evidence.map((item) => {
		const isDoc = item.toLowerCase().includes("document:");
		return {
			sourceName: item,
			sourceType: isDoc ? "document" : "source",
		};
	});
}

export default function GroundingReview({
	draftArtifact,
	onReviewComplete,
}: GroundingReviewProps) {
	const sections: GroundingSectionState[] = (
		draftArtifact.groundingSections || []
	).map((section) => ({
		sectionTitle: section.sectionTitle,
		evidence: section.evidence,
		isGrounded: section.isGrounded,
		reviewed: false,
	}));

	const [sectionStates, setSectionStates] = useState<GroundingSectionState[]>(
		sections,
	);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(),
	);

	const toggleExpand = useCallback((sectionTitle: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(sectionTitle)) {
				next.delete(sectionTitle);
			} else {
				next.add(sectionTitle);
			}
			return next;
		});
	}, []);

	const toggleReview = useCallback(
		(sectionTitle: string) => {
			setSectionStates((prev) => {
				const next = prev.map((s) =>
					s.sectionTitle === sectionTitle
						? { ...s, reviewed: !s.reviewed }
						: s,
				);
				const allReviewed = next.every((s) => s.reviewed);
				onReviewComplete?.(allReviewed);
				return next;
			});
		},
		[onReviewComplete],
	);

	if (sections.length === 0) {
		return (
			<div className="drawer-section">
				<h3>Grounding review</h3>
				<p className="grounding-empty">
					No grounding sections available for this draft. Grounding data will
					appear when the draft generator provides section-level source
					metadata.
				</p>
			</div>
		);
	}

	const reviewedCount = sectionStates.filter((s) => s.reviewed).length;
	const allReviewed = reviewedCount === sectionStates.length;
	const unsupportedCount = sectionStates.filter((s) => !s.isGrounded).length;
	const unsupportedUnreviewed = sectionStates.filter(
		(s) => !s.isGrounded && !s.reviewed,
	).length;

	return (
		<div className="drawer-section">
			<h3>Grounding review</h3>

			{/* Overall status */}
			<div className="grounding-overall" role="status" aria-live="polite">
				<span className="grounding-overall-count">
					{reviewedCount}/{sectionStates.length} sections reviewed
				</span>
				{allReviewed && (
					<span className="grounding-overall-badge grounding-complete">
						✓ Review complete
					</span>
				)}
				{!allReviewed && unsupportedUnreviewed > 0 && (
					<span className="grounding-overall-badge grounding-warning">
						⚠ {unsupportedUnreviewed} unsupported section
						{unsupportedUnreviewed !== 1 ? "s" : ""} unreviewed
					</span>
				)}
			</div>

			{/* Section list */}
			<div className="grounding-section-list" role="list">
				{sectionStates.map((section) => {
					const quality = groundingQualityLabel(section.isGrounded);
					const isExpanded = expandedSections.has(section.sectionTitle);
					const evidenceItems = parseEvidenceForDisplay(section.evidence);

					return (
						<div
							key={section.sectionTitle}
							className={`grounding-section-card ${quality.className} ${section.reviewed ? "grounding-reviewed" : ""}`}
							role="listitem"
						>
							{/* Section header */}
							<div className="grounding-section-header">
								<label className="grounding-review-check">
									<input
										type="checkbox"
										checked={section.reviewed}
										onChange={() => toggleReview(section.sectionTitle)}
										aria-label={`Mark "${section.sectionTitle}" as reviewed`}
									/>
									<span className="grounding-check-label">
										{section.sectionTitle}
									</span>
								</label>

								<div className="grounding-quality-indicator">
									<span
										className={`grounding-quality-dot ${quality.className}`}
										aria-hidden="true"
									>
										{quality.indicator}
									</span>
									<span className="grounding-quality-label">
										{quality.label}
									</span>
								</div>

								{!section.isGrounded && (
									<span className="grounding-unsupported-warning" role="alert">
										⚠ Unsupported claim &mdash; no evidence found
									</span>
								)}
							</div>

							{/* Evidence sources */}
							{evidenceItems.length > 0 && (
								<div className="grounding-evidence-summary">
									<button
										type="button"
										className="grounding-expand-toggle"
										onClick={() => toggleExpand(section.sectionTitle)}
										aria-expanded={isExpanded}
										aria-controls={`grounding-evidence-${section.sectionTitle.replace(/\s+/g, "-")}`}
									>
										{isExpanded ? "▼" : "▶"} Evidence sources (
										{evidenceItems.length})
									</button>

									{isExpanded && (
										<ul
											id={`grounding-evidence-${section.sectionTitle.replace(/\s+/g, "-")}`}
											className="grounding-evidence-list"
											role="list"
										>
											{evidenceItems.map((item, idx) => (
												<li
													key={`${section.sectionTitle}-evidence-${idx}`}
													className={`grounding-evidence-item grounding-evidence-${item.sourceType}`}
												>
													<span className="grounding-evidence-type">
														{item.sourceType === "document"
															? "📄"
															: "🔗"}
													</span>
													<span className="grounding-evidence-text">
														{item.sourceName}
													</span>
												</li>
											))}
										</ul>
									)}
								</div>
							)}

							{/* No evidence warning */}
							{evidenceItems.length === 0 && (
								<div
									className="grounding-no-evidence"
									role="alert"
								>
									No linked evidence sources available for this
									section.
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Stale claims check */}
			{unsupportedCount > 0 && (
				<div className="grounding-stale-warning" role="alert">
					{unsupportedCount} section
					{unsupportedCount !== 1 ? "s contain" : " contains"} unsupported
					claims that should be reviewed before approval.
				</div>
			)}
		</div>
	);
}
