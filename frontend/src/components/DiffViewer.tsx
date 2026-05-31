'use client';

import React from 'react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
}

interface DiffLine {
  type: 'same' | 'insert' | 'delete';
  oldLine: string;
  newLine: string;
  oldNum: number;
  newNum: number;
}

function getLine(lines: string[], index: number): string {
  return lines[index] ?? '';
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (getLine(oldLines, i - 1) === getLine(newLines, j - 1)) {
        dp[i]![j] = (dp[i - 1]![j - 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j] ?? 0, dp[i]![j - 1] ?? 0);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    const oldLine = getLine(oldLines, i - 1);
    const newLine = getLine(newLines, j - 1);

    if (i > 0 && j > 0 && oldLine === newLine) {
      result.unshift({
        type: 'same',
        oldLine,
        newLine,
        oldNum: i,
        newNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || (dp[i]?.[j - 1] ?? 0) >= (dp[i - 1]?.[j] ?? 0))) {
      result.unshift({
        type: 'insert',
        oldLine: '',
        newLine,
        oldNum: 0,
        newNum: j,
      });
      j--;
    } else {
      result.unshift({
        type: 'delete',
        oldLine,
        newLine: '',
        oldNum: i,
        newNum: 0,
      });
      i--;
    }
  }

  return result;
}

export default function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = computeDiff(oldLines, newLines);

  return (
    <div className="diff-viewer" data-testid="diff-viewer">
      <div className="diff-panel">
        <div className="diff-header">Previous Version</div>
        <div className="diff-content">
          {diff.map((line, idx) => (
            <div
              key={`old-${idx}`}
              className={`diff-line ${line.type === 'delete' ? 'diff-line-delete' : line.type === 'same' ? 'diff-line-old' : 'diff-line-empty'}`}
            >
              <span className="diff-line-num">{line.oldNum > 0 ? line.oldNum : ''}</span>
              <span className="diff-line-text">{line.oldLine}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="diff-panel">
        <div className="diff-header">Current Version</div>
        <div className="diff-content">
          {diff.map((line, idx) => (
            <div
              key={`new-${idx}`}
              className={`diff-line ${line.type === 'insert' ? 'diff-line-insert' : line.type === 'same' ? 'diff-line-new' : 'diff-line-empty'}`}
            >
              <span className="diff-line-num">{line.newNum > 0 ? line.newNum : ''}</span>
              <span className="diff-line-text">{line.newLine}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
