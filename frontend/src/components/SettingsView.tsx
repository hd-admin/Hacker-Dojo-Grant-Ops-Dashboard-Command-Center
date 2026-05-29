'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BackupFreshnessStatus, DocumentMetadata, HealthCheckResult, OpencodeSettings, OrganizationProfile } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';

// Guidance messages keyed by opencode health status
const opencodeStatusGuidance: Record<string, { title: string; description: string; action: string }> = {
  'not-installed': {
    title: 'Opencode is not installed',
    description: 'The opencode binary was not found on PATH or at the configured path. Grant generation and AI-powered features cannot run without it.',
    action: 'Install opencode from https://opencode.ai or verify the binary path below and test the connection.',
  },
  'not-reachable': {
    title: 'Opencode cannot be reached',
    description: 'The opencode binary was found but is not responding. It may be installed incorrectly or the binary may not be executable.',
    action: 'Verify the binary path points to a working opencode installation. Check that the file is executable (chmod +x on macOS/Linux).',
  },
  'incompatible': {
    title: 'Opencode version is incompatible',
    description: 'The installed opencode version does not meet the minimum version requirements for this application.',
    action: 'Update opencode to the latest version. Run \'opencode --version\' to check your current version, then upgrade.',
  },
  'ok': {
    title: 'Opencode is connected and healthy',
    description: 'Opencode is properly installed, reachable, and compatible. All AI-powered features are available.',
    action: '',
  },
  'error': {
    title: 'Opencode encountered an error',
    description: 'An unexpected error occurred while checking opencode health. This may indicate a configuration issue or a problem with the opencode installation.',
    action: 'Check the error details below. Verify your binary path and working directory, then test the connection again.',
  },
};

interface SettingsViewProps {
  onRefreshAppState?: () => Promise<void> | void;
  initiallyEditing?: boolean;
  initiallyDirty?: boolean;
}

export default function SettingsView({ onRefreshAppState, initiallyEditing = false, initiallyDirty = false }: SettingsViewProps) {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [editForm, setEditForm] = useState<Partial<OrganizationProfile>>({});
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [freshness, setFreshness] = useState<BackupFreshnessStatus | null>(null);
  const [diagnosticsText, setDiagnosticsText] = useState('');
  const [isDirty, setIsDirty] = useState(initiallyDirty);
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [opencodeForm, setOpencodeForm] = useState<Partial<OpencodeSettings>>({});
  const [lastHandshakeAt, setLastHandshakeAt] = useState<string | null>(null);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<'success' | 'failed' | null>(null);
  const [opencodeSaveSuccess, setOpencodeSaveSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [profileData, docsData, opencodeData, healthData, freshnessData] = await Promise.all([
          client.profile.get().catch(() => null),
          client.documents.getAll().catch(() => []),
          client.opencodeSettings.get().catch(() => null),
          fetch('/api/health').then((response) => response.json()).catch(() => null),
          fetch('/api/backup/freshness').then((response) => response.json()).catch(() => null),
        ]);
        setProfile(profileData);
        setEditForm(profileData ?? {});
        setDocuments(docsData);
        setOpencodeForm(opencodeData ?? { binaryPath: '', workingDirectory: '', timeoutMs: 60000, isConfigured: false });
        setHealth(healthData);
        if (healthData?.handshakeSuccess) {
          setLastHandshakeAt(new Date().toISOString());
        }
        setFreshness(freshnessData);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    const dirty = initiallyDirty || JSON.stringify(editForm) !== JSON.stringify(profile ?? {});
    setIsDirty(dirty);
  }, [editForm, profile, initiallyDirty]);

  const handleSave = useCallback(async () => {
    if (!editForm) return;
    try {
      await client.profile.update(editForm as OrganizationProfile);
      const updated = await client.profile.get();
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
      setIsDirty(false);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  }, [editForm, onRefreshAppState]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => {
      void handleSave();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [isDirty, handleSave]);

  useEffect(() => {
    window.onbeforeunload = isDirty ? () => 'You have unsaved settings changes.' : null;
    return () => {
      window.onbeforeunload = null;
    };
  }, [isDirty]);


  const refreshHealth = async () => {
    const data = await fetch('/api/health').then((response) => response.json()).catch(() => null);
    setHealth(data);
    if (data?.handshakeSuccess) {
      setLastHandshakeAt(new Date().toISOString());
    }
  };

  const handleTestConnection = async () => {
    setTestConnectionLoading(true);
    setTestConnectionResult(null);
    try {
      const data = await fetch('/api/health').then((r) => r.json()).catch(() => null);
      setHealth(data);
      if (data?.handshakeSuccess) {
        setLastHandshakeAt(new Date().toISOString());
        setTestConnectionResult('success');
      } else {
        setTestConnectionResult('failed');
      }
    } catch {
      setTestConnectionResult('failed');
    } finally {
      setTestConnectionLoading(false);
    }
  };

  const loadDiagnostics = async () => {
    const response = await fetch('/api/diagnostics');
    const report = await response.json();
    setDiagnosticsText(JSON.stringify(report, null, 2));
    return report;
  };

  const handleCopyDiagnostics = async () => {
    const report = await loadDiagnostics();
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setDiagnosticsText('');
    } catch {
      setDiagnosticsText(JSON.stringify(report, null, 2));
    }
  };

  const handleExportDiagnostics = async () => {
    const report = await loadDiagnostics();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `grant-ops-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async (file: File | null) => {
    if (!file) return;
    const payload = JSON.parse(await file.text());
    await fetch('/api/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setFreshness(await fetch('/api/backup/freshness').then((response) => response.json()));
    await onRefreshAppState?.();
  };

  const handleRequestRestore = (file: File | null) => {
    if (!file) return;
    setPendingRestoreFile(file);
    setShowRestoreWarning(true);
  };

  const handleConfirmRestore = async () => {
    await handleRestoreBackup(pendingRestoreFile);
    setPendingRestoreFile(null);
    setShowRestoreWarning(false);
  };

  const handleCancelRestore = () => {
    setPendingRestoreFile(null);
    setShowRestoreWarning(false);
  };

  const handleSaveOpencode = async () => {
    const nextSettings: OpencodeSettings = {
      binaryPath: opencodeForm.binaryPath ?? '',
      workingDirectory: opencodeForm.workingDirectory ?? '',
      timeoutMs: opencodeForm.timeoutMs ?? 60000,
      profile: opencodeForm.profile,
      isConfigured: true,
    };
    await client.opencodeSettings.update(nextSettings);
    const updated = await client.opencodeSettings.get();
    setOpencodeForm(updated);
    setOpencodeSaveSuccess(true);
    setTimeout(() => setOpencodeSaveSuccess(false), 3000);
    await onRefreshAppState?.();
  };

  const handleUploadDocument = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.xls,.xlsx,.doc,.docx';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const doc = await client.documents.create(file, { name: file.name, type: file.name.split('.').pop()?.toUpperCase() || 'FILE' });
      setDocuments((current) => [...current, doc]);
      await onRefreshAppState?.();
    };
    input.click();
  };

  const lastBackupVerification = freshness?.lastBackupVerification?.outcome ?? 'No backup verification result yet.';
  const lastRestoreVerification = freshness?.lastRestoreVerification?.outcome ?? 'No restore verification result yet.';

  if (loading) {
    return <div className="header-title">Loading...</div>;
  }

  if (!profile) {
    return <div className="header-title">Error loading profile</div>;
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Org <span className="accent">Profile</span>
          </h1>
          <div className="header-sub">Context the agent uses for matching &amp; drafting</div>
        </div>
        <div className="header-actions">
          {!isEditing && <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>Edit profile</button>}
          <button type="button" data-testid="refresh-health-btn" onClick={() => { void refreshHealth(); }}>Refresh</button>
          <button type="button" data-testid="rerun-health-check-btn" onClick={() => { void refreshHealth(); }}>Re-run Health Check</button>
          {isDirty && <span id="settings-unsaved-badge" data-testid="settings-unsaved-badge">Unsaved changes</span>}
        </div>
      </div>

      <div className="settings-grid">
        <section className="setting-card" data-testid="system-health-card">
          <div className="setting-card-header"><div className="setting-card-title">System Health</div></div>
          <div className="setting-card-body">
            <div>Storage: {health?.storage === 'ok' ? 'OK' : `Error: ${health?.storageError ?? 'unknown'}`}</div>
            <div>Opencode: {health?.opencode === 'ok' ? `Connected (v${health.opencodeVersion ?? 'unknown'})` : health?.opencode === 'not-installed' ? 'Not Installed' : health?.opencode === 'not-reachable' ? 'Not Reachable' : health?.opencode === 'incompatible' ? `Incompatible version — found v${health.opencodeVersion ?? 'unknown'}` : `Error: ${health?.opencodeError ?? 'unknown'}`}</div>
            <div>Crawler: {health?.crawlerStatus}</div>
            <div>Document indexer: {health?.documentIndexer === 'ok' ? 'OK' : health?.documentIndexer === 'degraded' ? `Degraded: ${health.documentIndexerFailedCount ?? 0} failed` : `Error: ${health?.documentIndexerError ?? 'unknown'}`}</div>
            <div className="settings-diagnostics-actions">
              <button type="button" data-testid="copy-diagnostics-btn" onClick={() => { void handleCopyDiagnostics(); }}>Copy Diagnostics</button>
              <button type="button" data-testid="export-diagnostics-btn" onClick={() => { void handleExportDiagnostics(); }}>Export Diagnostics</button>
              {diagnosticsText && <pre data-testid="diagnostics-export-text">{diagnosticsText}</pre>}
            </div>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Organization</div></div>
          <div className="setting-card-body">
            {isEditing ? (
              <>
                <input value={editForm.legalName ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, legalName: e.target.value }))} />
                <input value={editForm.ein ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, ein: e.target.value }))} />
                <input value={editForm.samUEI ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, samUEI: e.target.value }))} />
                <textarea value={editForm.mission ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, mission: e.target.value }))} />
                <button type="button" onClick={() => void handleSave()}>Save</button>
                <button type="button" onClick={() => { setEditForm(profile); setIsEditing(false); }}>Cancel</button>
              </>
            ) : (
              <>
                <div>{profile.legalName}</div>
                <div>{profile.ein}</div>
                <div>{profile.samUEI}</div>
                <div>{profile.mission}</div>
              </>
            )}
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Reference Documents</div></div>
          <div className="setting-card-body">
            <button type="button" className="upload-item" onClick={handleUploadDocument}>Upload document</button>
            {documents.map((doc) => (
              <div key={doc.id} className="doc-item">{doc.name}</div>
            ))}
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Backup & Restore</div></div>
          <div className="setting-card-body">
            <div data-testid="backup-verification-result">Last backup verification: {lastBackupVerification}</div>
            <div data-testid="restore-verification-result">Last restore verification: {lastRestoreVerification}</div>
            <button type="button" onClick={() => { void fetch('/api/backup'); }}>Export backup</button>
            <label>
              Restore from backup
              <input type="file" accept="application/json,.json" onChange={(e) => { handleRequestRestore(e.target.files?.[0] ?? null); }} />
            </label>
            {showRestoreWarning && (
              <div data-testid="restore-warning-banner">
                <div>Restoring will overwrite local state. Continue only if you have a verified backup.</div>
                <button type="button" onClick={() => { void handleConfirmRestore(); }}>Confirm restore</button>
                <button type="button" onClick={handleCancelRestore}>Cancel</button>
              </div>
            )}
          </div>
        </section>


        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Safety &amp; Lock</div></div>
          <div className="setting-card-body">
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Configure application lock to protect sensitive grant data with a passcode.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { void fetch('/api/safety/lock', { method: 'POST' }); }}>Lock app now</button>
          </div>
        </section>

        <section className="setting-card" data-testid="opencode-status-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Opencode Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="status-dot"
                style={{
                  background: health?.opencode === 'ok' ? 'var(--success)' : health?.opencode === 'incompatible' ? 'var(--warning)' : 'var(--danger)',
                  boxShadow: health?.opencode === 'ok' ? '0 0 8px var(--success)' : health?.opencode === 'incompatible' ? '0 0 8px var(--warning)' : '0 0 8px var(--danger)',
                }}
              />
              <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
                {health?.opencode === 'ok' ? 'Connected' : health?.opencode === 'incompatible' ? 'Incompatible' : health?.opencode === 'not-installed' ? 'Not Installed' : health?.opencode === 'not-reachable' ? 'Not Reachable' : health?.opencode === 'error' ? 'Error' : 'Unknown'}
              </span>
            </div>
          </div>
          <div className="setting-card-body">
            {/* Status guidance */}
            {health?.opencode && opencodeStatusGuidance[health.opencode] && (
              <div style={{
                background: health.opencode === 'ok' ? 'rgba(138, 171, 111, 0.08)' : health.opencode === 'incompatible' ? 'rgba(224, 137, 74, 0.08)' : 'rgba(198, 107, 90, 0.08)',
                border: `1px solid ${health.opencode === 'ok' ? 'rgba(138, 171, 111, 0.2)' : health.opencode === 'incompatible' ? 'rgba(224, 137, 74, 0.2)' : 'rgba(198, 107, 90, 0.2)'}`,
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: 'var(--text)' }}>
                  {opencodeStatusGuidance[health.opencode].title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: health.opencode !== 'ok' ? '10px' : 0 }}>
                  {opencodeStatusGuidance[health.opencode].description}
                </div>
                {health.opencode !== 'ok' && opencodeStatusGuidance[health.opencode].action && (
                  <div style={{ fontSize: '12px', color: 'var(--accent)', lineHeight: 1.5 }}>
                    <strong>What to do:</strong> {opencodeStatusGuidance[health.opencode].action}
                  </div>
                )}
              </div>
            )}

            {/* Diagnostics grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div>
                <div className="setting-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Version</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {health?.opencodeVersion ? `v${health.opencodeVersion}` : (health?.opencode === 'not-installed' ? '—' : 'Unknown')}
                </div>
              </div>
              <div>
                <div className="setting-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Response Time</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {health?.handshakeResponseTimeMs != null ? `${health.handshakeResponseTimeMs}ms` : '—'}
                </div>
              </div>
              <div>
                <div className="setting-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Handshake</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {health?.handshakeSuccess === true ? (
                    <span style={{ color: 'var(--success)' }}>✓ Success</span>
                  ) : health?.handshakeSuccess === false ? (
                    <span style={{ color: 'var(--danger)' }}>✗ Failed</span>
                  ) : '—'}
                </div>
              </div>
              <div>
                <div className="setting-label" style={{ fontSize: '9px', marginBottom: '2px' }}>Last Handshake</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {lastHandshakeAt ? new Date(lastHandshakeAt).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {health?.capabilities && health.capabilities.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div className="setting-label" style={{ fontSize: '9px', marginBottom: '6px' }}>Detected Capabilities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {health.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '10px',
                        padding: '2px 8px',
                        background: 'rgba(123, 163, 184, 0.12)',
                        color: 'var(--info)',
                        borderRadius: '10px',
                        border: '1px solid rgba(123, 163, 184, 0.2)',
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Error details */}
            {health?.opencodeError && (
              <div style={{
                background: 'rgba(198, 107, 90, 0.06)',
                border: '1px solid rgba(198, 107, 90, 0.15)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                marginBottom: '16px',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--danger)', marginBottom: '4px' }}>
                  Opencode Error
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                  {health.opencodeError}
                </div>
              </div>
            )}

            {health?.handshakeError && !health?.handshakeSuccess && (
              <div style={{
                background: 'rgba(224, 137, 74, 0.06)',
                border: '1px solid rgba(224, 137, 74, 0.15)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                marginBottom: '16px',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warning)', marginBottom: '4px' }}>
                  Handshake Error
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                  {health.handshakeError}
                </div>
              </div>
            )}

            {/* Configuration section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
              <div className="setting-label" style={{ fontSize: '9px', marginBottom: '12px' }}>Connection Configuration</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label htmlFor="opencode-binary-path" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Binary Path
                  </label>
                  <input
                    id="opencode-binary-path"
                    value={opencodeForm.binaryPath ?? ''}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, binaryPath: e.target.value })); setOpencodeSaveSuccess(false); }}
                    placeholder="/usr/local/bin/opencode"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label htmlFor="opencode-working-directory" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Working Directory
                  </label>
                  <input
                    id="opencode-working-directory"
                    value={opencodeForm.workingDirectory ?? ''}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, workingDirectory: e.target.value })); setOpencodeSaveSuccess(false); }}
                    placeholder="/home/user/projects"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label htmlFor="opencode-timeout" style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Timeout (ms)
                  </label>
                  <input
                    id="opencode-timeout"
                    type="number"
                    value={opencodeForm.timeoutMs ?? 60000}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, timeoutMs: Number(e.target.value) })); setOpencodeSaveSuccess(false); }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSaveOpencode()}>
                  Save Configuration
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => { void handleTestConnection(); }}
                  disabled={testConnectionLoading}
                  data-testid="test-connection-btn"
                >
                  {testConnectionLoading ? 'Testing…' : 'Test Connection'}
                </button>
                {opencodeSaveSuccess && (
                  <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓ Saved</span>
                )}
              </div>

              {/* Test connection result */}
              {testConnectionResult && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  background: testConnectionResult === 'success' ? 'rgba(138, 171, 111, 0.06)' : 'rgba(198, 107, 90, 0.06)',
                  border: `1px solid ${testConnectionResult === 'success' ? 'rgba(138, 171, 111, 0.15)' : 'rgba(198, 107, 90, 0.15)'}`,
                  fontSize: '12px',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: testConnectionResult === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {testConnectionResult === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                  </div>
                  {testConnectionResult === 'success' && health?.handshakeResponseTimeMs != null && (
                    <div style={{ color: 'var(--text-dim)' }}>
                      Response time: {health.handshakeResponseTimeMs}ms
                      {health?.opencodeVersion && ` • Version: v${health.opencodeVersion}`}
                    </div>
                  )}
                  {testConnectionResult === 'failed' && health?.opencodeError && (
                    <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: '11px' }}>
                      {health.opencodeError}
                    </div>
                  )}
                  {testConnectionResult === 'failed' && health?.handshakeError && (
                    <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: '11px', marginTop: '4px' }}>
                      {health.handshakeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Theme Configuration</div></div>
          <div className="setting-card-body">
            <p className="setting-card-description">
              Configure matching themes, keyword clusters, and scoring thresholds for grant discovery.
            </p>
            <div>
              <h4>Search Themes</h4>
              {profile.searchThemes?.length ? (
                <ul>
                  {profile.searchThemes.map((theme, i) => (
                    <li key={i}>{theme}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No search themes configured.</p>
              )}
            </div>
            <div>
              <h4>Auto-Draft Threshold</h4>
              <p>
                Current threshold: {profile.agentBehavior?.autoDraftThreshold ?? 75}
              </p>
              <p className="text-muted">
                Grants with a fit score above this threshold will be automatically drafted.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
