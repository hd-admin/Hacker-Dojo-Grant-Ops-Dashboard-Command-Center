'use client';

import React, { useState } from 'react';

interface BudgetCategory {
  id: string;
  category: string;
  amount: number;
}

interface BudgetImportViewProps {
  awardId: string;
  onUpload?: (awardId: string, file: File) => void;
  onConfirm?: (categories: BudgetCategory[]) => void;
}

export default function BudgetImportView({ awardId, onUpload, onConfirm }: BudgetImportViewProps) {
  const [categories, _setCategories] = useState<BudgetCategory[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && onUpload) {
      onUpload(awardId, file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="budget-import-view" data-testid="budget-import-view">
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Drop budget file here"
      >
        <p>Drag and drop budget file here (PDF, XLSX, CSV)</p>
      </div>
      {categories.length > 0 && (
        <div className="budget-categories">
          {categories.map((cat) => (
            <div key={cat.id} className="budget-row">
              <span>{cat.category}</span>
              <span>${cat.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {onConfirm && categories.length > 0 && (
        <button type="button" className="btn btn-primary" onClick={() => onConfirm(categories)}>
          Confirm Import
        </button>
      )}
    </div>
  );
}
