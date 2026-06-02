'use client';

import React, { useCallback, useEffect, useState } from 'react';
import styles from './OperatorNamePrompt.module.css';

interface OperatorNamePromptProps {
  onComplete?: (name: string) => void;
}

const OPERATOR_NAME_KEY = 'grantops.operatorName';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

async function fetchOperatorName(): Promise<string> {
  try {
    const response = await fetch('/api/operator');
    const data = (await response.json()) as { name: string };
    return data.name || '';
  } catch {
    return '';
  }
}

async function saveOperatorName(name: string): Promise<void> {
  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(OPERATOR_NAME_KEY, name);
  }
  await fetch('/api/operator', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function OperatorNamePrompt({ onComplete }: OperatorNamePromptProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      const storage = getLocalStorage();
      const localName = storage?.getItem(OPERATOR_NAME_KEY);
      if (localName) {
        if (!cancelled) {
          setExistingName(localName);
          setInitialized(true);
          onComplete?.(localName);
        }
        return;
      }
      const serverName = await fetchOperatorName();
      if (!cancelled) {
        if (serverName) {
          setExistingName(serverName);
          if (storage) storage.setItem(OPERATOR_NAME_KEY, serverName);
          onComplete?.(serverName);
        }
        setInitialized(true);
      }
    }
    void checkExisting();
    return () => { cancelled = true; };
  }, [onComplete]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      await saveOperatorName(trimmed);
      onComplete?.(trimmed);
    } catch {
      setError('Failed to save name. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!initialized) {
    return null;
  }

  if (existingName) {
    return null;
  }

  const disabled = saving || !name.trim();

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-prompt-title"
      data-testid="operator-name-prompt"
    >
      <div className={styles.card}>
        <h1 id="operator-prompt-title" className={styles.heading}>
          Hacker Dojo Grant Ops is ready.
        </h1>
        <p className={styles.subtitle}>What is your name?</p>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your name"
            autoFocus
            disabled={saving}
            aria-label="Your name"
            aria-describedby={error ? 'prompt-error' : undefined}
          />
          {error && (
            <p id="prompt-error" className={styles.errorText} role="alert">
              {error}
            </p>
          )}
          <button
            className={styles.button}
            style={{
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={disabled}
            aria-label="Get started"
          >
            {saving ? 'Saving...' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
