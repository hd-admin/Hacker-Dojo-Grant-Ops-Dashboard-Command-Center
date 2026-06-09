'use client';

import type { JSX } from 'react';

import React, { useCallback, useEffect, useRef } from 'react';
import styles from './GrantDrawerShell.module.css';

interface GrantDrawerShellProps {
  grantId: string | null;
  loading: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export function GrantDrawerShell({ grantId, loading, onClose, children }: GrantDrawerShellProps): JSX.Element | null {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!drawerRef.current) return;
      const focusables = getFocusableElements(drawerRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!grantId || !drawerRef.current) return;
    previousActiveElementRef.current = document.activeElement as HTMLElement;
    const focusables = getFocusableElements(drawerRef.current);
    if (focusables.length > 0) {
      focusables[0]!.focus();
    }
    return () => {
      previousActiveElementRef.current?.focus();
      previousActiveElementRef.current = null;
    };
  }, [grantId]);

  if (!grantId) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Grant details"
      ref={drawerRef}
      onKeyDown={handleDialogKeyDown}
    >
      <button
        type="button"
        className="drawer-overlay open"
        onClick={onClose}
        aria-label="Close grant drawer"
      />
      <aside className="drawer open">
        {loading ? (
          <div className="drawer-header">
            <div
              className={`spinner-overlay ${styles.spinnerOverlay}`}
              role="status"
              aria-busy="true"
              aria-label="Loading grant details"
            >
              <div className="spinner" />
            </div>
          </div>
        ) : (
          children
        )}
      </aside>
    </div>
  );
}
