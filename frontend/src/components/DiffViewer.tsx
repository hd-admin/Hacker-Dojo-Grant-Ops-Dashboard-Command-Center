'use client';

import React from 'react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
}

export default function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  return (
    <div className="diff-viewer" data-testid="diff-viewer">
      <div className="diff-panel">
        <div className="diff-header">Previous Version</div>
        <div className="diff-content">
          {oldLines.map((line, i) => (
            <div key={`old-${i}`} className="diff-line diff-line-old">
              <span className="diff-line-num">{i + 1}</span>
              <span className="diff-line-text">{line || ' '}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="diff-panel">
        <div className="diff-header">Current Version</div>
        <div className="diff-content">
          {newLines.map((line, i) => (
            <div key={`new-${i}`} className="diff-line diff-line-new">
              <span className="diff-line-num">{i + 1}</span>
              <span className="diff-line-text">{line || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
