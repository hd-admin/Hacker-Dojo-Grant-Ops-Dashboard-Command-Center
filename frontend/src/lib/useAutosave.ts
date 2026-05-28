"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AutosaveState {
  /** Whether the current value differs from the last saved state */
  isDirty: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** ISO timestamp of the last successful save, or null */
  lastSaved: string | null;
  /** Manually trigger an immediate save (bypasses debounce) */
  saveNow: () => Promise<void>;
  /** Reset dirty state to match the current value without saving */
  markClean: () => void;
}

export interface AutosaveOptions {
  /** Debounce delay in milliseconds before triggering save (default: 2000) */
  delayMs?: number;
  /** Called when a save fails */
  onError?: (error: unknown) => void;
}

/**
 * Reusable autosave hook that debounces save operations and tracks dirty state.
 *
 * @param value - The value to monitor for changes (JSON-serializable)
 * @param saveFn - Async function that persists the value
 * @param options - Configuration options
 */
export function useAutosave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  options: AutosaveOptions = {},
): AutosaveState {
  const { delayMs = 2000, onError } = options;

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const savedValueRef = useRef<string>(JSON.stringify(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  const onErrorRef = useRef(onError);

  saveFnRef.current = saveFn;
  onErrorRef.current = onError;

  // Detect dirty state by comparing serialized current vs saved
  useEffect(() => {
    const currentSerialized = JSON.stringify(value);
    if (currentSerialized !== savedValueRef.current) {
      setIsDirty(true);
    }
  }, [value]);

  const performSave = useCallback(async (): Promise<void> => {
    const currentValue = value;
    setIsSaving(true);
    try {
      await saveFnRef.current(currentValue);
      savedValueRef.current = JSON.stringify(currentValue);
      setIsDirty(false);
      setLastSaved(new Date().toISOString());
    } catch (error) {
      onErrorRef.current?.(error);
      // Keep dirty state so retry can happen
    } finally {
      setIsSaving(false);
    }
  }, [value]);

  // Debounce: whenever value changes while dirty, schedule a save
  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void performSave();
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDirty, delayMs, performSave]);

  // Save on beforeunload if dirty
  useEffect(() => {
    const handler = (_event: BeforeUnloadEvent) => {
      if (isDirty) {
        // Attempt synchronous-ish save via sendBeacon style
        // For most cases, the beforeunload event just warns the user
        void performSave();
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, performSave]);

  const saveNow = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  const markClean = useCallback(() => {
    savedValueRef.current = JSON.stringify(value);
    setIsDirty(false);
  }, [value]);

  return {
    isDirty,
    isSaving,
    lastSaved,
    saveNow,
    markClean,
  };
}
