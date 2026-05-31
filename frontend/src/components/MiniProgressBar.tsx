'use client';

import React from 'react';

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

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  background: 'var(--surface, #25221d)',
  borderTop: '1px solid var(--border, #36322c)',
  fontFamily: 'var(--sans), sans-serif',
  fontSize: 12,
  color: 'var(--text-dim, #b3ac9e)',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 100,
};

const trackStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: 'var(--border, #36322c)',
  borderRadius: 2,
  overflow: 'hidden',
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border, #36322c)',
  color: 'var(--text-dim, #b3ac9e)',
  padding: '2px 8px',
  borderRadius: 'var(--radius, 6px)',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--sans), sans-serif',
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
  const isActive = status === 'running' || status === 'queued' || status === 'verifying' || status === 'retrying';
  const isFailed = status === 'failed';
  const isComplete = status === 'completed';

  const fillColor = isFailed
    ? 'var(--danger, #c66b5a)'
    : isComplete
      ? 'var(--success, #8aab6f)'
      : 'var(--accent, #d4a943)';

  const fillStyle: React.CSSProperties = {
    height: '100%',
    background: fillColor,
    borderRadius: 2,
    width: isActive ? `${Math.max(progress, 5)}%` : '100%',
    transition: 'width 300ms ease-out',
  };

  return (
    <div
      style={barStyle}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${jobType} progress: ${stage}`}
      aria-live="polite"
      data-testid="mini-progress-bar"
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: '0 0 auto', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isFailed ? `Failed: ${errorMessage ?? 'Unknown error'}` : stage}
      </span>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
      {isActive && onCancel && (
        <button
          style={btnStyle}
          onClick={onCancel}
          aria-label={`Cancel ${jobType} job`}
        >
          ✕
        </button>
      )}
      {isFailed && onViewLog && (
        <button
          style={btnStyle}
          onClick={onViewLog}
          aria-label={`View log for ${jobType} job`}
        >
          Log
        </button>
      )}
    </div>
  );
}
