"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import type { DraftArtifact } from "../../../../shared/types";
import styles from "./GrantDrawer.module.css";

interface UngroundedClaimsWarningProps {
	showGroundingWarning: boolean;
	groundingOverrideConfirmed: boolean;
	setGroundingOverrideConfirmed: (confirmed: boolean) => void;
	doApproveAndLock: () => Promise<void>;
	setShowGroundingWarning: (show: boolean) => void;
	latestDraft: DraftArtifact | null;
}

export function UngroundedClaimsWarning({
	showGroundingWarning,
	groundingOverrideConfirmed,
	setGroundingOverrideConfirmed,
	doApproveAndLock,
	setShowGroundingWarning,
	latestDraft,
}: UngroundedClaimsWarningProps) {
	if (!showGroundingWarning || !latestDraft) return null;

	return (
		<div className="drawer-section" data-testid="grounding-warning-dialog" role="alert">
			<h3 className={styles.groundedWarningTitle}><AlertTriangle size={18} /> Ungrounded Claims Detected</h3>
			<p>
				This draft contains sections with unsupported claims that lack evidence from your sources.
				Approving a draft with ungrounded claims may result in a weaker submission.
			</p>
			<div className={styles.groundedWarningSection}>
				<strong>Ungrounded sections:</strong>
				<ul className={styles.groundedWarningList}>
					{latestDraft.groundingSections
						?.filter((s) => !s.isGrounded)
						.map((s) => (
							<li key={s.sectionTitle}>
								<strong>{s.sectionTitle}</strong>{' — no evidence found'}
							</li>
						))}
				</ul>
			</div>
			<div className={styles.actionRowEnd}>
				<label className={styles.groundedCheckboxLabel}>
					<input
						type="checkbox"
						checked={groundingOverrideConfirmed}
						onChange={(e) => setGroundingOverrideConfirmed(e.target.checked)}
						data-testid="grounding-override-checkbox"
					/>
					I understand. Approve anyway
				</label>
				<button
					type="button"
					className="btn btn-primary"
					onClick={doApproveAndLock}
					disabled={!groundingOverrideConfirmed}
					data-testid="grounding-approve-anyway-btn"
				>
					Approve Anyway
				</button>
				<button type="button" onClick={() => setShowGroundingWarning(false)}>
					Cancel
				</button>
			</div>
		</div>
	);
}
