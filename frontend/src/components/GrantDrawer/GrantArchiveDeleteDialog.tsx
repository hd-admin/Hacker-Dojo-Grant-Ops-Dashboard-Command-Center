'use client';

import type { JSX } from 'react';
import React, { useEffect, useRef } from 'react';

export type GrantArchiveDeleteAction = 'archive' | 'delete';

export interface GrantArchiveDeleteDialogProps {
  open: boolean;
  action: GrantArchiveDeleteAction;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function GrantArchiveDeleteDialog({
  open,
  action,
  onCancel,
  onConfirm,
}: GrantArchiveDeleteDialogProps): JSX.Element | null {
  const destructiveRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    // Move focus to the destructive button so Enter immediately confirms.
    destructiveRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const title = action === 'archive' ? 'Archive grant?' : 'Delete grant?';
  const description =
    action === 'archive'
      ? 'The grant will be hidden from discovery and ignored by future crawls. You can unarchive later.'
      : 'This permanently removes the grant. Audit history is preserved.';
  const confirmLabel = action === 'archive' ? 'Archive' : 'Delete';

  return (
    <div
      className="safe-quit-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="grant-archive-delete-dialog"
    >
      <div className="safe-quit-dialog">
        <h3 data-testid="grant-archive-delete-title">{title}</h3>
        <p data-testid="grant-archive-delete-description">{description}</p>
        <div className="quit-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} data-testid="grant-archive-delete-cancel">
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void onConfirm();
            }}
            ref={destructiveRef}
            data-testid="grant-archive-delete-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
