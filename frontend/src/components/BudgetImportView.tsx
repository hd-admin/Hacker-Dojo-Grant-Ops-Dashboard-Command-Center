'use client';

import React, { useState, useRef, useCallback } from 'react';

interface ParsedBudgetRow {
  raw: Record<string, unknown>;
  detectedColumns: string[];
  mappedCategory?: string;
  mappedAmount?: number;
  errors: string[];
}

interface BudgetImportPreview {
  detectedColumns: string[];
  rows: ParsedBudgetRow[];
  validRowCount: number;
  invalidRowCount: number;
  totalAmount: number;
}

interface BudgetImportViewProps {
  awardId: string;
  onUpload?: (awardId: string, file: File) => void;
  onConfirm?: (categories: Array<{ category: string; amount: number }>) => void;
}

export function BudgetImportView({ awardId, onUpload, onConfirm }: BudgetImportViewProps) {
  const [preview, setPreview] = useState<BudgetImportPreview | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError('');
    setPreview(null);
    setFileName(file.name);

    if (onUpload) {
      onUpload(awardId, file);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('awardId', awardId);

      const res = await fetch('/api/budget-import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to parse budget file');
        setLoading(false);
        return;
      }

      setPreview(json.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse budget file');
    } finally {
      setLoading(false);
    }
  }, [awardId, onUpload]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirm = () => {
    if (!preview || !onConfirm) return;
    const validCategories = preview.rows
      .filter(r => r.errors.length === 0 && r.mappedCategory && r.mappedAmount !== undefined)
      .map(r => ({
        category: r.mappedCategory!,
        amount: r.mappedAmount!,
      }));
    onConfirm(validCategories);
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
        aria-label="Drop budget file here or click to browse"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <p>Drag and drop budget file here (CSV, XLSX) or click to browse</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          style={{ display: 'none' }}
          aria-label="Select budget file"
        />
      </div>

      {loading && <p className="loading-text" aria-live="polite">Parsing budget file...</p>}

      {error && (
        <div className="error-banner" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {preview && (
        <div className="budget-preview">
          <h3>Budget Preview: {fileName}</h3>

          <div className="preview-stats" aria-live="polite">
            <span>Valid rows: {preview.validRowCount}</span>
            <span>Invalid rows: {preview.invalidRowCount}</span>
            <span>Total amount: ${preview.totalAmount.toLocaleString()}</span>
          </div>

          <div className="column-mapping">
            <h4>Detected Columns</h4>
            <ul>
              {preview.detectedColumns.map(col => (
                <li key={col}>{col}</li>
              ))}
            </ul>
          </div>

          <div className="budget-rows">
            <h4>Rows</h4>
            <table role="table" aria-label="Budget import preview">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, idx) => (
                  <tr key={idx} className={row.errors.length > 0 ? 'invalid-row' : ''}>
                    <td>{row.mappedCategory || '—'}</td>
                    <td>{row.mappedAmount !== undefined ? `$${row.mappedAmount.toLocaleString()}` : '—'}</td>
                    <td>
                      {row.errors.length > 0 ? (
                        <span className="row-errors" role="alert">
                          {row.errors.join('; ')}
                        </span>
                      ) : (
                        <span className="row-valid">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {onConfirm && preview.validRowCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              aria-label="Confirm import of valid budget rows"
            >
              Confirm Import ({preview.validRowCount} rows)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
