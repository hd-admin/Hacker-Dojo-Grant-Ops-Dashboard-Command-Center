'use client';

import React, { useState } from 'react';

interface OperatorNamePromptProps {
  onSubmit?: (name: string) => Promise<void>;
  onSave?: (name: string) => Promise<void>;
  isSubmitting?: boolean;
  saving?: boolean;
  error?: string;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: 420,
  padding: '48px 32px',
};

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--serif), Georgia, serif',
  fontSize: 38,
  fontWeight: 600,
  color: 'var(--text)',
  lineHeight: 1.2,
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--sans), sans-serif',
  fontSize: 17,
  color: 'var(--text-dim)',
  marginBottom: 32,
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontFamily: 'var(--sans), sans-serif',
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--sans), sans-serif',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--danger)',
  fontFamily: 'var(--sans), sans-serif',
  fontSize: 13,
};

export default function OperatorNamePrompt({
  onSubmit,
  onSave,
  isSubmitting = false,
  saving = false,
  error,
}: OperatorNamePromptProps) {
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const handler = onSave ?? onSubmit;
    if (handler) await handler(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const disabled = isSubmitting || saving || !name.trim();

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-prompt-title"
      data-testid="operator-name-prompt"
    >
      <div style={cardStyle}>
        <h1 id="operator-prompt-title" style={headingStyle}>
          Hacker Dojo Grant Ops is ready.
        </h1>
        <p style={subtitleStyle}>What is your name?</p>
        <div style={inputGroupStyle}>
          <input
            type="text"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your name"
            autoFocus
            disabled={isSubmitting || saving}
            aria-label="Your name"
            aria-describedby={error ? 'prompt-error' : undefined}
          />
          {error && (
            <p id="prompt-error" style={errorStyle} role="alert">
              {error}
            </p>
          )}
          <button
            style={{
              ...buttonStyle,
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={disabled}
            aria-label="Get started"
          >
            {isSubmitting || saving ? 'Saving...' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
