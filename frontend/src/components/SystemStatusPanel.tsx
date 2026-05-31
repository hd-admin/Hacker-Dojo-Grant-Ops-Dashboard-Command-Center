'use client';

import React, { useEffect, useState } from 'react';

interface HealthStatus {
  storage: string;
  opencode: string;
  crawlerStatus: string;
}

export default function SystemStatusPanel() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ storage: 'error', opencode: 'error', crawlerStatus: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return <div className="system-status-panel" data-testid="system-status-loading">Checking system status...</div>;
  }

  const allOnline = status?.storage === 'ok' && status?.opencode === 'ok' && status?.crawlerStatus === 'ok';
  const allOffline = status?.storage === 'error' && status?.opencode === 'error' && status?.crawlerStatus === 'error';
  const state = allOnline ? 'fully-online' : allOffline ? 'fully-offline' : 'partially-degraded';

  return (
    <div className={`system-status-panel ${state}`} data-testid="system-status-panel">
      <div className="status-header">
        <span className={`status-dot ${state}`} aria-hidden="true" />
        <span className="status-title">
          {allOnline ? 'Fully Online' : allOffline ? 'Fully Offline' : 'Partially Degraded'}
        </span>
      </div>
      <div className="status-grid">
        <div className="status-item" data-testid="status-storage">
          <span className={`status-dot ${status?.storage === 'ok' ? 'ok' : 'error'}`} />
          Storage: {status?.storage}
        </div>
        <div className="status-item" data-testid="status-opencode">
          <span className={`status-dot ${status?.opencode === 'ok' ? 'ok' : 'error'}`} />
          Opencode: {status?.opencode}
        </div>
        <div className="status-item" data-testid="status-crawler">
          <span className={`status-dot ${status?.crawlerStatus === 'ok' ? 'ok' : 'error'}`} />
          Crawler: {status?.crawlerStatus}
        </div>
      </div>
    </div>
  );
}
