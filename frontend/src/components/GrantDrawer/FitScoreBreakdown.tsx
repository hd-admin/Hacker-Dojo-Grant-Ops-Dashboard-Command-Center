import type { JSX } from 'react';
import React from 'react';
import type {
  FitRubric,
  FitScoreBreakdown as FitScoreBreakdownType,
} from '../../../../shared/types';
import styles from './FitScoreBreakdown.module.css';

interface FitScoreBreakdownProps {
  fitBreakdown: FitScoreBreakdownType;
  rubric?: FitRubric | undefined;
}

type RubricDimension = keyof Omit<FitRubric, 'overallRationale' | 'rubricVersion'>;

interface RubricEntry {
  label: string;
  key: RubricDimension;
}

const RUBRIC_DIMENSIONS: RubricEntry[] = [
  { label: 'Mission alignment', key: 'missionAlignment' },
  { label: 'Geographic focus', key: 'geographicFocus' },
  { label: 'Program track record', key: 'programTrackrecord' },
  { label: 'Budget capacity', key: 'budgetCapacity' },
  { label: 'Partnership readiness', key: 'partnershipReadiness' },
];

export function FitScoreBreakdown({
  fitBreakdown,
  rubric,
}: FitScoreBreakdownProps): JSX.Element {
  return (
    <div className="drawer-section">
      <h3>Why it fits</h3>
      <div className="fit-breakdown" role="list">
        {(
          [
            ['Mission alignment', fitBreakdown.missionAlignment],
            ['Geographic focus', fitBreakdown.geographicFocus],
            ['Program track record', fitBreakdown.programTrackrecord],
            ['Budget capacity', fitBreakdown.budgetCapacity],
            ['Partnership readiness', fitBreakdown.partnershipReadiness],
          ] as const
        ).map(([label, score]) => {
          const rubricEntry = rubric?.[RUBRIC_DIMENSIONS.find((d) => d.label === label)!.key];
          return (
            <div
              className="fit-row"
              key={label}
              role="listitem"
              aria-label={`${label}: ${score} percent`}
            >
              <div className="fit-row-label">{label}</div>
              <div className="fit-row-bar">
                <div
                  className={styles.fitRowBar}
                  style={{ transform: `scaleX(${score / 100})` }}
                />
              </div>
              <div className="fit-row-val">{score}</div>
              {rubricEntry && (
                <p
                  className={styles.fitRowJustification}
                  data-testid="rubric-justification"
                  data-rubric-dimension={RUBRIC_DIMENSIONS.find((d) => d.label === label)?.key}
                >
                  {rubricEntry.justification}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {rubric?.overallRationale && (
        <p
          className={styles.overallRationale}
          data-testid="rubric-overall-rationale"
        >
          {rubric.overallRationale}
        </p>
      )}
    </div>
  );
}
