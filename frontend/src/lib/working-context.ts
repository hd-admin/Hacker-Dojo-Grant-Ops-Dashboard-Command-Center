'use client';

export const WORKING_CONTEXT_KEY = 'grantops.workingContext';

export interface WorkingContext {
  activeView?: string;
  selectedGrantId?: string | null;
  recentGrantIds?: string[];
  recentDraftId?: string | null;
}

export function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

export function readWorkingContext(): WorkingContext {
  const storage = getWorkingContextStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || '{}') as WorkingContext;
  } catch {
    return {};
  }
}

export function saveWorkingContext(next: WorkingContext): void {
  const storage = getWorkingContextStorage();
  if (!storage || typeof storage.setItem !== 'function') return;
  const current = readWorkingContext();
  const merged = { ...current, ...next };
  try {
    storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage write failures in non-persistent test environments.
  }
}
