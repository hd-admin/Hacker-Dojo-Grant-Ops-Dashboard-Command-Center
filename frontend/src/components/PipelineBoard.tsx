'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Grant, GrantStatus } from '../../../shared/types';

const PIPELINE_COLUMNS: { status: GrantStatus; label: string }[] = [
  { status: 'matched', label: 'Matched' },
  { status: 'draft', label: 'Draft' },
  { status: 'review', label: 'Review' },
  { status: 'approved', label: 'Approved' },
  { status: 'submission-ready', label: 'Ready' },
  { status: 'submitted', label: 'Submitted' },
  { status: 'follow-up', label: 'Follow-Up' },
  { status: 'awarded', label: 'Awarded' },
  { status: 'declined', label: 'Declined' },
  { status: 'closed', label: 'Closed' },
];

interface PipelineBoardProps {
  grants: Grant[];
  onSelectGrant: (grantId: string) => void;
  onStatusChange: (grantId: string, newStatus: GrantStatus) => Promise<void>;
}

export default function PipelineBoard({ grants, onSelectGrant, onStatusChange: _onStatusChange }: PipelineBoardProps) {
  const [activeColumn, setActiveColumn] = useState(0);
  const [activeCard, setActiveCard] = useState<number[]>(Array.from({ length: PIPELINE_COLUMNS.length }, () => 0));
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const getColumnGrants = useCallback(
    (status: GrantStatus) => grants.filter((g) => g.status === status),
    [grants],
  );

  const getActiveCardIndex = useCallback(
    (col: number) => activeCard[col] ?? 0,
    [activeCard],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentCol = activeColumn;
      const colEntry = PIPELINE_COLUMNS[currentCol];
      if (!colEntry) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setActiveColumn((prev) => Math.min(prev + 1, PIPELINE_COLUMNS.length - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setActiveColumn((prev) => Math.max(prev - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveCard((prev) => {
            const next = [...prev];
            const colGrants = getColumnGrants(colEntry.status);
            next[currentCol] = Math.min((next[currentCol] ?? 0) + 1, colGrants.length - 1);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveCard((prev) => {
            const next = [...prev];
            next[currentCol] = Math.max((next[currentCol] ?? 0) - 1, 0);
            return next;
          });
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const colGrants = getColumnGrants(colEntry.status);
          const idx = activeCard[currentCol] ?? 0;
          const grant = colGrants[idx];
          if (grant) onSelectGrant(grant.id);
          break;
        }
      }
    },
    [activeColumn, activeCard, getColumnGrants, onSelectGrant],
  );

  useEffect(() => {
    columnRefs.current[activeColumn]?.focus();
  }, [activeColumn]);

  return (
    <div
      className="pipeline-board"
      role="grid"
      aria-label="Pipeline Kanban Board"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="pipeline-board"
    >
      <div className="pipeline-board-scroll">
        {PIPELINE_COLUMNS.map((col, colIndex) => {
          const colGrants = getColumnGrants(col.status);
          return (
            <div
              key={col.status}
              className={`pipeline-column ${activeColumn === colIndex ? 'pipeline-column-active' : ''}`}
              role="gridcell"
              aria-label={`${col.label} column, ${colGrants.length} grants`}
              ref={(el) => { columnRefs.current[colIndex] = el; }}
              tabIndex={activeColumn === colIndex ? 0 : -1}
              data-testid={`pipeline-column-${col.status}`}
            >
              <div className="pipeline-column-header">
                <span className="pipeline-column-label">{col.label}</span>
                <span className="pipeline-column-count">{colGrants.length}</span>
              </div>
              <div className="pipeline-column-cards">
                {colGrants.map((grant, cardIndex) => (
                  <div
                    key={grant.id}
                    className={`pipeline-card ${activeColumn === colIndex && getActiveCardIndex(colIndex) === cardIndex ? 'pipeline-card-active' : ''}`}
                    role="button"
                    tabIndex={-1}
                    onClick={() => onSelectGrant(grant.id)}
                    onMouseEnter={() =>
                      setActiveCard((prev) => {
                        const next = [...prev];
                        next[colIndex] = cardIndex;
                        return next;
                      })
                    }
                    data-testid={`pipeline-card-${grant.id}`}
                  >
                    <div className="pipeline-card-funder">{grant.funderShort || grant.funder}</div>
                    <div className="pipeline-card-title">{grant.title}</div>
                    <div className="pipeline-card-meta">
                      {grant.award && <span className="pipeline-card-award">{grant.award}</span>}
                      {grant.deadline && (
                        <span className="pipeline-card-deadline">{grant.deadline}</span>
                      )}
                    </div>
                    {grant.fit > 0 && (
                      <div className="pipeline-card-fit" title={`Fit: ${grant.fit}%`}>
                        <div
                          className="pipeline-card-fit-bar"
                          style={{ transform: `scaleX(${grant.fit / 100})`, transformOrigin: 'left' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {colGrants.length === 0 && (
                  <div className="pipeline-column-empty">No grants</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PIPELINE_COLUMNS };
