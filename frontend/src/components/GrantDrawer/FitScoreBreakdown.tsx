"use client";

import React from "react";
import type { FitScoreBreakdown as FitScoreBreakdownType } from "../../../../shared/types";
import styles from "./FitScoreBreakdown.module.css";

interface FitScoreBreakdownProps {
	fitBreakdown: FitScoreBreakdownType;
}

export function FitScoreBreakdown({ fitBreakdown }: FitScoreBreakdownProps) {
	return (
		<div className="drawer-section">
			<h3>Why it fits</h3>
			<div className="fit-breakdown">
				{(
					[
						["Mission alignment", fitBreakdown.missionAlignment],
						["Geographic focus", fitBreakdown.geographicFocus],
						["Program track record", fitBreakdown.programTrackrecord],
						["Budget capacity", fitBreakdown.budgetCapacity],
						["Partnership readiness", fitBreakdown.partnershipReadiness],
					] as const
				).map(([label, score]) => (
					<div className="fit-row" key={label}>
						<div className="fit-row-label">{label}</div>
						<div className="fit-row-bar">
							<div className={styles.fitRowBar} style={{ transform: `scaleX(${score / 100})` }} />
						</div>
						<div className="fit-row-val">{score}</div>
					</div>
				))}
			</div>
		</div>
	);
}
