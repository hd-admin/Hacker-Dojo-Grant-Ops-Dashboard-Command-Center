// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { useAutosave, AutosaveState } from './useAutosave';

function renderAutosaveHook(
  initialValue: string,
  saveFn: (value: string) => Promise<void>,
  options?: { delayMs?: number; onError?: (error: unknown) => void },
): {
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
  getState: () => AutosaveState;
  setValue: (value: string) => Promise<void>;
  unmount: () => void;
} {
  const container = document.createElement('div');
  const root = createRoot(container);
  let currentState: AutosaveState = {
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    saveNow: async () => {},
    markClean: () => {},
  };

  function TestComponent({ value }: { value: string }) {
    const state = useAutosave(value, saveFn, options);
    currentState = state;
    return null;
  }

  root.render(React.createElement(TestComponent, { value: initialValue }));

  return {
    container,
    root,
    getState: () => currentState,
    setValue: async (value: string) => {
      await act(async () => {
        root.render(React.createElement(TestComponent, { value }));
      });
    },
    unmount: () => {
      root.unmount();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('returns initial state with isDirty=false, isSaving=false, lastSaved=null', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, unmount } = renderAutosaveHook('hello', saveFn);

    expect(getState().isDirty).toBe(false);
    expect(getState().isSaving).toBe(false);
    expect(getState().lastSaved).toBeNull();
    unmount();
  });

  it('sets isDirty to true when value changes', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn);

    await setValue('world');

    expect(getState().isDirty).toBe(true);
    unmount();
  });

  it('saves after debounce delay and clears dirty state', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 2000 });

    await setValue('world');
    expect(getState().isDirty).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for the async save to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveFn).toHaveBeenCalledWith('world');
    expect(getState().isDirty).toBe(false);
    expect(getState().lastSaved).not.toBeNull();
    unmount();
  });

  it('saveNow triggers immediate save bypassing debounce', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 2000 });

    await setValue('world');
    expect(getState().isDirty).toBe(true);

    await act(async () => {
      await getState().saveNow();
    });

    expect(saveFn).toHaveBeenCalledWith('world');
    expect(getState().isDirty).toBe(false);
    expect(getState().lastSaved).not.toBeNull();
    unmount();
  });

  it('markClean resets dirty state without saving', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn);

    await setValue('world');
    expect(getState().isDirty).toBe(true);

    act(() => {
      getState().markClean();
    });

    expect(getState().isDirty).toBe(false);
    expect(saveFn).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps dirty state on save failure and calls onError', async () => {
    const error = new Error('Save failed');
    const saveFn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 100, onError });

    await setValue('world');

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(getState().isDirty).toBe(true);
    unmount();
  });

  it('lastSaved is an ISO timestamp string after successful save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 10 });

    await setValue('world');

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const lastSaved = getState().lastSaved;
    expect(lastSaved).toBeTruthy();
    expect(Date.parse(lastSaved!)).not.toBeNaN();
    unmount();
  });
});
