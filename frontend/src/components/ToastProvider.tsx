'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  useEffect(() => {
    const timers = toasts.map((toast) => {
      if (toast.type === 'error') return null;
      return setTimeout(() => removeToast(toast.id), 5000);
    });
    return () => {
      timers.forEach((timer) => { if (timer) clearTimeout(timer); });
    };
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="toast-container"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-item--${toast.type}`}
            data-testid={`toast-${toast.type}`}
          >
            <div className="toast-content">
              <span className="toast-message">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="toast-dismiss"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

