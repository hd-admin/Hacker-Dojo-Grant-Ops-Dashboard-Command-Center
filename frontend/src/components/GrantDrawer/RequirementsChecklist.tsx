import React from 'react';
import type { ChecklistItem as ChecklistItemType } from '../../../../shared/types';

interface RequirementsChecklistProps {
  checklist: ChecklistItemType[];
}

export function RequirementsChecklist({ checklist }: RequirementsChecklistProps) {
  return (
    <div className="drawer-section">
      <h3>Requirements checklist</h3>
      <div className="checklist-list">
        {checklist.map((item) => (
          <div
            key={item.label}
            className={`checklist-item ${item.done ? 'done' : ''}`}
            role="checkbox"
            aria-checked={item.done}
            aria-label={item.label}
          >
            <span aria-hidden="true">{item.done ? '✓' : '○'}</span>
            <div>
              <div>{item.label}</div>
              <div className="drawer-note">{item.source}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
