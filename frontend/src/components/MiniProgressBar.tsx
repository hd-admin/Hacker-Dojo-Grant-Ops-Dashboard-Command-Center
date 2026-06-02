'use client';

import React from 'react';
import styles from './MiniProgressBar.module.css';

interface MiniProgressBarProps {
  jobType: string;
  stage: string;
  progress: number;
  status: 'queued' | 'running' | 'verifying' | 'retrying' | 'completed' | 'failed' | 'cancelled';
  onCancel?: () => void;
  onViewLog?: () => void;
  errorMessage?: string;
}

const JOB_TYPE_ICONS: Record<string, string> = {
  research: '\uD83D\uDD0D',
  draft: '\u270F\uFE0F',
  crawl: '\uD83D\uDD77\uFE0F',
  match: '\uD83C\uDFAF',
  extract: '\uD83D\uDCC4',
  'peer-discovery': '\uD83D\uDD17',
  'funder-insights': '\uD83D\uDCA1',
  'eligibility-vetting': '\u2705',
  'budget-import': '\uD83D\uDCB0',
};

export function MiniProgressBar({
  jobType,
  stage,
  progress,
  status,
  onCancel,
  onViewLog,
  errorMessage,
}: MiniProgressBarProps) {
  const icon = JOB_TYPE_ICONS[jobType] ?? '\u2699\uFE0F';
  const isActive =
    status === 'running' || status === 'queued' || status === 'verifying' || status === 'retrying';
  const isFailed = status === 'failed';
  const isComplete = status === 'completed';

  const fillColor = isFailed ? 'var(--danger)' : isComplete ? 'var(--success)' : 'var(--accent)';

  const fillStyle: React.CSSProperties = {
    background: fillColor,
    transform: isActive ? `scaleX(${Math.max(progress, 5) / 100})` : 'scaleX(1)',
  };

  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${jobType} progress: ${stage}`}
      aria-live="polite"
      data-testid="mini-progress-bar"
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>
        {isFailed ? `Failed: ${errorMessage ?? 'Unknown error'}` : stage}
      </span>
      <div className={styles.track}>
        <div className={styles.fill} style={fillStyle} />
      </div>
      {isActive && onCancel && (
        <button className={styles.btn} onClick={onCancel} aria-label={`Cancel ${jobType} job`}>
          ✕
        </button>
      )}
      {isFailed && onViewLog && (
        <button
          className={styles.btn}
          onClick={onViewLog}
          aria-label={`View log for ${jobType} job`}
        >
          Log
        </button>
      )}
    </div>
  );
}
