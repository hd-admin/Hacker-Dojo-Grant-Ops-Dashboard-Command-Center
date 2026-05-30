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
  getState: () => AutosaveState;
  setValue: (value: string) => void;
  advanceTimersAndFlush: (ms: number) => Promise<void>;
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
  let setRenderValue: ((v: string) => void) | null = null;

  function TestComponent() {
    const [value, setValueInner] = React.useState(initialValue);
    setRenderValue = setValueInner;
    const state = useAutosave(value, saveFn, options);
    currentState = state;
    return React.createElement('div', null);
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    getState: () => currentState,
    setValue: (value: string) => {
      act(() => {
        setRenderValue?.(value);
      });
    },
    advanceTimersAndFlush: async (ms: number) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
      // Flush microtasks so React effects run
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
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

    setValue('world');

    expect(getState().isDirty).toBe(true);
    unmount();
  });

  it('saves after debounce delay and clears dirty state', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, advanceTimersAndFlush, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 2000 });

    setValue('world');
    expect(getState().isDirty).toBe(true);

    await advanceTimersAndFlush(2000);

    expect(saveFn).toHaveBeenCalledWith('world');
    expect(getState().isDirty).toBe(false);
    expect(getState().lastSaved).not.toBeNull();
    unmount();
  });

  it('saveNow triggers immediate save bypassing debounce', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 2000 });

    setValue('world');
    expect(getState().isDirty).toBe(true);

    await act(async () => {
      await getState().saveNow();
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(saveFn).toHaveBeenCalledWith('world');
    expect(getState().isDirty).toBe(false);
    expect(getState().lastSaved).not.toBeNull();
    unmount();
  });

  it('markClean resets dirty state without saving', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, unmount } = renderAutosaveHook('hello', saveFn);

    setValue('world');
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

    const { getState, setValue, advanceTimersAndFlush, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 100, onError });

    setValue('world');

    await advanceTimersAndFlush(100);

    expect(onError).toHaveBeenCalledWith(error);
    expect(getState().isDirty).toBe(true);
    unmount();
  });

  it('lastSaved is an ISO timestamp string after successful save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { getState, setValue, advanceTimersAndFlush, unmount } = renderAutosaveHook('hello', saveFn, { delayMs: 10 });

    setValue('world');

    await advanceTimersAndFlush(10);

    const lastSaved = getState().lastSaved;
    expect(lastSaved).toBeTruthy();
    expect(Date.parse(lastSaved!)).not.toBeNaN();
    unmount();
  });
});
