'use client';

import React, { useCallback, useState } from 'react';

interface LockScreenProps {
  onUnlock: () => void;
  lockOnIdleMs?: number;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (passcode.length < 1) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/safety/unlock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (data.success) {
        onUnlock();
      } else {
        setError(data.error || 'Incorrect passcode');
      }
    } catch {
      setError('Unable to verify passcode. Check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  }, [passcode, onUnlock]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleUnlock();
    }
  };

  return (
    <div className="lockscreen-overlay" data-testid="lockscreen-overlay" role="dialog" aria-label="App lock screen" aria-modal="true">
      <div className="lockscreen-backdrop" />
      <div className="lockscreen-panel" data-testid="lockscreen-panel">
        <div className="lockscreen-icon" aria-hidden="true">{String.fromCodePoint(0x1F512)}</div>
        <h2 className="lockscreen-title">App Locked</h2>
        <div className="lockscreen-content">
          {!showForgotHelp ? (
            <>
              <p className="lockscreen-description">
                Enter your 6-character passcode to continue.
              </p>
              <input
                type="password"
                className="lockscreen-input"
                data-testid="lockscreen-passcode-input"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value.slice(0, 6));
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
                maxLength={6}
                disabled={isSubmitting}
                autoFocus
                aria-label="Enter passcode"
              />
              {error && (
                <div className="lockscreen-error" data-testid="lockscreen-error" role="alert">
                  {error}
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary lockscreen-submit"
                data-testid="lockscreen-unlock-btn"
                onClick={() => void handleUnlock()}
                disabled={isSubmitting || passcode.length < 1}
              >
                {isSubmitting ? 'Verifying...' : 'Unlock'}
              </button>
              <button
                type="button"
                className="btn btn-ghost lockscreen-forgot"
                data-testid="lockscreen-forgot-btn"
                onClick={() => setShowForgotHelp(true)}
              >
                Forgot passcode?
              </button>
            </>
          ) : (
            <>
              <p className="lockscreen-description">
                Your passcode is stored locally on your device.
                If you&apos;ve forgotten it, the only recovery option is to reset the app lock.
              </p>
              <p className="lockscreen-description">
                To reset, you will need to manually edit the app&apos;s data directory
                or run a recovery command. This data is not remotely recoverable.
              </p>
              <button
                type="button"
                className="btn btn-ghost lockscreen-back"
                data-testid="lockscreen-back-btn"
                onClick={() => setShowForgotHelp(false)}
              >
                Back to passcode entry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
