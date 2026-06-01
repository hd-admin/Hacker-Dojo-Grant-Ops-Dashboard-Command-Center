"use client";

import React from "react";
import type { GrantDetailResponse } from "../../../../shared/types";
import { previewText } from "./utilities";
import styles from "./GrantDrawer.module.css";
import { GroundingReview } from "../GroundingReview";
import type { GrantDrawerViewModel } from "./utilities";

interface DraftEditorProps {
	viewModel: GrantDrawerViewModel;
	detail: GrantDetailResponse;
	draftEditMode: boolean;
	draftEditContent: string;
	setDraftEditContent: (content: string) => void;
	draftIsDirty: boolean;
	draftIsSaving: boolean;
	draftLastSaved: string | null;
	draftSaveNow: () => Promise<void>;
	draftMarkClean: () => void;
	setDraftEditMode: (mode: boolean) => void;
}

export function DraftEditor({
	viewModel,
	detail,
	draftEditMode,
	draftEditContent,
	setDraftEditContent,
	draftIsDirty,
	draftIsSaving,
	draftLastSaved,
	draftSaveNow,
	draftMarkClean,
	setDraftEditMode,
}: DraftEditorProps) {
	return (
		<>
			<div className="drawer-section">
				<h3 className={styles.sectionHeaderFlex}>
					Drafted Letter of Intent — preview
					{draftIsDirty && (
						<span data-testid="draft-dirty-indicator" className={styles.draftDirtyIndicator}>Unsaved</span>
					)}
					{draftIsSaving && (
						<span data-testid="draft-saving-indicator" className={styles.draftSavingIndicator}>Saving...</span>
					)}
					{draftLastSaved && !draftIsDirty && (
						<span data-testid="draft-saved-timestamp" className={styles.draftSavedTimestamp}>
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
							className={`form-input ${styles.draftEditTextarea}`}
							rows={10}
							value={draftEditContent}
							onChange={(e) => setDraftEditContent(e.target.value)}
							aria-label="Edit draft content"
							data-testid="draft-edit-textarea"
						/>
						<div className={styles.actionRowWithMarginBottom}>
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
		</>
	);
}
