'use client';

import React, { useState } from 'react';
import type { FunderProfile } from '../../../shared/types';

interface FunderDetailProps {
  funder: FunderProfile;
  onClose: () => void;
  onDetectPatterns?: (funderId: string) => Promise<void>;
}

export function FunderDetail({ funder, onClose, onDetectPatterns }: FunderDetailProps) {
  const [analyzing, setAnalyzing] = useState(false);

  const handleDetectPatterns = async () => {
    if (!onDetectPatterns) return;
    setAnalyzing(true);
    try {
      await onDetectPatterns(funder.id);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="funder-detail" data-testid="funder-detail" role="dialog" aria-label={`Funder details for ${funder.name}`}>
      <div className="funder-detail-header">
        <h2>{funder.name}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="funder-detail-body">
        <div className="funder-detail-section">
          <div className="funder-detail-label">Type</div>
          <div className="funder-detail-value">{funder.type}</div>
        </div>
        {funder.ein && (
          <div className="funder-detail-section">
            <div className="funder-detail-label">EIN</div>
            <div className="funder-detail-value mono">{funder.ein}</div>
          </div>
        )}
        <div className="funder-detail-section">
          <div className="funder-detail-label">Focus Areas</div>
          <div className="funder-detail-tags">
            {funder.focusAreas.map((area) => (
              <span key={area} className="tag">{area}</span>
            ))}
          </div>
        </div>
        <div className="funder-detail-section">
          <div className="funder-detail-label">Geographic Focus</div>
          <div className="funder-detail-value">{funder.geographicFocus.join(', ')}</div>
        </div>
        <div className="funder-detail-section">
          <div className="funder-detail-label">Typical Award Range</div>
          <div className="funder-detail-value">
            ${funder.typicalAwardRange.min.toLocaleString()} — ${funder.typicalAwardRange.max.toLocaleString()}
          </div>
        </div>

        <div className="funder-detail-section">
          <div className="funder-detail-label">Giving History</div>
          <div className="funder-detail-table">
            <div className="funder-detail-table-header">
              <span>Year</span>
              <span>Total Giving</span>
              <span>Grants</span>
              <span>Avg Size</span>
            </div>
            {funder.givingHistory.map((entry) => (
              <div key={entry.year} className="funder-detail-table-row">
                <span>{entry.year}</span>
                <span>${(entry.totalGiving / 1000000).toFixed(1)}M</span>
                <span>{entry.grantsCount}</span>
                <span>${(entry.averageGrantSize / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </div>

        <div className="funder-detail-section">
          <div className="funder-detail-label">Application Process</div>
          <div className="funder-detail-value">{funder.applicationProcess}</div>
        </div>

        <div className="funder-detail-section">
          <div className="funder-detail-label">Deadlines</div>
          <div className="funder-detail-value">{funder.deadlines}</div>
        </div>

        {funder.sourceUrls.length > 0 && (
          <div className="funder-detail-section">
            <div className="funder-detail-label">Sources</div>
            {funder.sourceUrls.map((url) => (
              <div key={url} className="funder-detail-value mono">
                {url}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="funder-detail-actions">
        {onDetectPatterns && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDetectPatterns}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Detect Hidden Patterns'}
          </button>
        )}
      </div>
    </div>
  );
}

