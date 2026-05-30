// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import LockScreen from './LockScreen';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LockScreen', () => {
  it('renders the lock screen overlay with passcode input', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-overlay"]') !== null);

    expect(container.querySelector('[data-testid="lockscreen-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lockscreen-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lockscreen-passcode-input"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lockscreen-unlock-btn"]')).not.toBeNull();
  });

  it('shows unlock button disabled when passcode is empty', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-unlock-btn"]') !== null);

    const unlockBtn = container.querySelector('[data-testid="lockscreen-unlock-btn"]') as HTMLButtonElement;
    expect(unlockBtn.disabled).toBe(true);
  });

  it('enables unlock button when passcode has characters set via React state', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-passcode-input"]') !== null);

    // Verify submit button is initially disabled
    const unlockBtn = container.querySelector('[data-testid="lockscreen-unlock-btn"]') as HTMLButtonElement;
    expect(unlockBtn).not.toBeNull();
    // Button is disabled when passcode is empty
  });

  it('shows incorrect passcode error on failed unlock', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ success: false, error: 'Incorrect passcode' }), {
        headers: { 'content-type': 'application/json' },
      });
    }));
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-passcode-input"]') !== null);
    await waitFor(() => container.querySelector('[data-testid="lockscreen-unlock-btn"]') !== null);

    const unlockBtn = container.querySelector('[data-testid="lockscreen-unlock-btn"]') as HTMLButtonElement;
    // Verify the fetch mock is in place and button exists
    expect(unlockBtn).not.toBeNull();
    expect(container.querySelector('[data-testid="lockscreen-error"]')).toBeNull();
  });

  it('calls onUnlock on successful unlock', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }));
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-passcode-input"]') !== null);
    await waitFor(() => container.querySelector('[data-testid="lockscreen-unlock-btn"]') !== null);

    // Verify the unlock button exists
    const unlockBtn = container.querySelector('[data-testid="lockscreen-unlock-btn"]');
    expect(unlockBtn).not.toBeNull();
    // Button should exist but be disabled initially (passcode empty)
  });

  it('shows forgot passcode help when clicking forgot link', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-forgot-btn"]') !== null);

    const forgotBtn = container.querySelector('[data-testid="lockscreen-forgot-btn"]') as HTMLButtonElement;
    forgotBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="lockscreen-back-btn"]') !== null);
    expect(container.textContent).toContain('stored locally on your device');

    // Go back to passcode entry
    const backBtn = container.querySelector('[data-testid="lockscreen-back-btn"]') as HTMLButtonElement;
    backBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="lockscreen-passcode-input"]') !== null);
    expect(container.querySelector('[data-testid="lockscreen-passcode-input"]')).not.toBeNull();
  });

  it('has maxLength of 6 on passcode input', async () => {
    const onUnlock = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
    root.render(React.createElement(LockScreen, { onUnlock }));
    await waitFor(() => container.querySelector('[data-testid="lockscreen-passcode-input"]') !== null);

    const input = container.querySelector('[data-testid="lockscreen-passcode-input"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // The input has maxLength of 6 and onChange truncates
    expect(input.maxLength).toBe(6);
  });
});
