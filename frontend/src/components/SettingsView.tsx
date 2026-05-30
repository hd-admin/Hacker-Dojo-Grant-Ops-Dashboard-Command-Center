'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BackupFreshnessStatus, DocumentMetadata, FailureHistoryEntry, HealthCheckResult, OrganizationProfile, Theme, ThemesData } from '../../../shared/types';
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

// Status class helper for guidance block
function getStatusGuidanceClass(status: string): string {
  if (status === 'ok') return 'settings-status-ok';
  if (status === 'incompatible') return 'settings-status-warn';
  return 'settings-status-error';
}

// Status class helper for dot color
function getStatusDotStyle(status: string): React.CSSProperties {
  return {
    background: status === 'ok' ? 'var(--success)' : status === 'incompatible' ? 'var(--warning)' : 'var(--danger)',
    boxShadow: status === 'ok' ? '0 0 8px var(--success)' : status === 'incompatible' ? '0 0 8px var(--warning)' : '0 0 8px var(--danger)',
  };
}

// Status label text
function getStatusLabelText(status: string): string {
  switch (status) {
    case 'ok': return 'Connected';
    case 'incompatible': return 'Incompatible';
    case 'not-installed': return 'Not Installed';
    case 'not-reachable': return 'Not Reachable';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
}

interface SettingsViewProps {
  onRefreshAppState?: () => Promise<void> | void;
  initiallyEditing?: boolean;
}

export default function SettingsView({ onRefreshAppState }: SettingsViewProps) {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [freshness, setFreshness] = useState<BackupFreshnessStatus | null>(null);
  const [diagnosticsText, setDiagnosticsText] = useState('');
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [lastHandshakeAt, setLastHandshakeAt] = useState<string | null>(null);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<'success' | 'failed' | null>(null);
  const [themesData, setThemesData] = useState<ThemesData | null>(null);
  const [matchThreshold, setMatchThreshold] = useState(70);
  const [autoDraftThreshold, setAutoDraftThreshold] = useState(85);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterKeywords, setNewClusterKeywords] = useState('');
  const [newClusterWeight, setNewClusterWeight] = useState(80);
  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [rescoreResult, setRescoreResult] = useState<string | null>(null);

  const [themesSaving, setThemesSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedDocVersions, setExpandedDocVersions] = useState<Record<string, boolean>>({});

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function getRelativeTime(isoString: string): string {
    const now = new Date();
    const date = new Date(isoString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  useEffect(() => {
    async function load() {
      try {
        const [profileData, docsData, healthData, freshnessData, themesResult] = await Promise.all([
          client.profile.get().catch(() => null),
          client.documents.getAll().catch(() => []),
          fetch('/api/health').then((response) => response.json()).catch(() => null),
          client.backup.getFreshness().catch(() => null),
          client.themes.get().catch(() => null),
        ]);
        setProfile(profileData);
        setDocuments(docsData);
        setHealth(healthData);
        if (healthData?.handshakeSuccess) {
          setLastHandshakeAt(new Date().toISOString());
        }
        setFreshness(freshnessData);
        if (themesResult) {
          setThemesData(themesResult);
          const activeTheme = themesResult.themes?.find((t: Theme) => t.isActive);
          if (activeTheme?.matchingPolicy) {
            setMatchThreshold(activeTheme.matchingPolicy.matchThreshold);
            setAutoDraftThreshold(activeTheme.matchingPolicy.autoDraftThreshold);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Profile is hardcoded — read-only, saveProfileToApi removed.
  const isDirty = false;
  const isSaving = false;
  const lastSaved: string | null = null;
  const saveNow = async () => {};
  const markClean = () => {};

  // Reset dirty state when profile initially loads
  const profileLoadRef = useRef(false);
  useEffect(() => {
    if (profile && !profileLoadRef.current) {
      profileLoadRef.current = true;
      markClean();
    }
  }, [profile, markClean]);


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
    await client.backup.restore(payload);
    const updatedFreshness = await client.backup.getFreshness();
    setFreshness(updatedFreshness);
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


  const handleSaveMatchingPolicy = async () => {
    setThemesSaving(true);
    try {
      const current = await client.themes.get();
      const activeTheme = current.themes.find((t) => t.isActive);
      const updatedData: ThemesData = activeTheme
        ? { ...current, themes: current.themes.map((t) => t.isActive ? { ...t, matchingPolicy: { ...t.matchingPolicy, matchThreshold, autoDraftThreshold } } : t) }
        : { ...current, themes: [{ id: 'theme-default', name: 'Default Theme', keywordClusters: [], regions: [], populations: [], strategicPriorities: [], matchingPolicy: { matchThreshold, autoDraftThreshold, includeRules: [], excludeRules: [] }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
      const saved = await client.themes.update(updatedData);
      setThemesData(saved);
    } catch (err) {
      console.error('Error saving matching policy:', err);
    } finally {
      setThemesSaving(false);
    }
  };

  const handleAddKeywordCluster = async () => {
    if (!newClusterName.trim() || !newClusterKeywords.trim()) return;
    const keywords = newClusterKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    const newCluster = { id: `kc-${Date.now()}`, name: newClusterName.trim(), keywords, weight: newClusterWeight, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const current: ThemesData = themesData ?? { keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] };
    const saved = await client.themes.update({ ...current, keywordClusters: [...current.keywordClusters, newCluster] });
    setThemesData(saved);
    setNewClusterName('');
    setNewClusterKeywords('');
    setNewClusterWeight(80);
  };

  const handleRemoveKeywordCluster = async (clusterId: string) => {
    const current: ThemesData = themesData ?? { keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] };
    const saved = await client.themes.update({ ...current, keywordClusters: current.keywordClusters.filter((c) => c.id !== clusterId) });
    setThemesData(saved);
  };

  const handleRescore = async () => {
    setRescoreLoading(true);
    setRescoreResult(null);
    try {
      const result = await client.themes.rescore();
      setRescoreResult(`Rescored ${result.rescored} grant(s).`);
    } catch {
      setRescoreResult('Rescore failed.');
    } finally {
      setRescoreLoading(false);
    }
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
    return (
      <div className="spinner-overlay" role="status" aria-busy="true" aria-label="Loading settings">
        <div className="spinner" />
      </div>
    );
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

      </div>

      {toast && (
        <div data-testid="settings-toast" role="status" aria-live="polite" className="settings-toast">
          {toast}
        </div>
      )}

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

        <section className="setting-card" data-testid="org-profile-card">
          <div className="setting-card-header"><div className="setting-card-title">Organization Profile</div></div>

          <div className="setting-card-header"><div className="setting-card-title">Search Themes &amp; Matching Policy</div></div>
          <div className="setting-card-body">
            <fieldset className="settings-fieldset">
              <legend className="settings-legend">Matching Thresholds</legend>
              <div className="settings-form-grid">
                <div>
                  <label className="setting-label" htmlFor="match-threshold">Match Threshold (0-100)</label>
                  <input id="match-threshold" type="number" min={0} max={100} className="form-input" value={matchThreshold} onChange={(e) => setMatchThreshold(Number(e.target.value))} />
                </div>
                <div>
                  <label className="setting-label" htmlFor="autodraft-threshold">Auto-Draft Threshold (0-100)</label>
                  <input id="autodraft-threshold" type="number" min={0} max={100} className="form-input" value={autoDraftThreshold} onChange={(e) => setAutoDraftThreshold(Number(e.target.value))} />
                </div>
              </div>
              <div className="settings-form-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await handleSaveMatchingPolicy(); showToast('Matching policy updated'); }} disabled={themesSaving}>{themesSaving ? 'Saving...' : 'Save thresholds'}</button>
              </div>
            </fieldset>
            <fieldset className="settings-fieldset">
              <legend className="settings-legend">Keyword Clusters</legend>
              {(themesData?.keywordClusters ?? []).length === 0 && <div className="empty-state">No keyword clusters. Add one to enable weighted tag scoring.</div>}
              {(themesData?.keywordClusters ?? []).map((cluster) => (
                <div key={cluster.id} className="setting-row">
                  <span className="setting-label">{cluster.name}</span>
                  <span className="setting-value">{cluster.keywords.join(', ')} &middot; weight {cluster.weight}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await handleRemoveKeywordCluster(cluster.id); showToast('Keyword cluster removed'); }} aria-label={`Remove cluster ${cluster.name}`}>Remove</button>
                </div>
              ))}
              <div className="settings-form-grid">
                <div><label className="setting-label" htmlFor="new-cluster-name">Cluster Name</label><input id="new-cluster-name" className="form-input" value={newClusterName} onChange={(e) => setNewClusterName(e.target.value)} placeholder="e.g., STEM Education" /></div>
                <div><label className="setting-label" htmlFor="new-cluster-keywords">Keywords (comma-separated)</label><input id="new-cluster-keywords" className="form-input" value={newClusterKeywords} onChange={(e) => setNewClusterKeywords(e.target.value)} placeholder="STEM, science, technology" /></div>
                <div><label className="setting-label" htmlFor="new-cluster-weight">Weight (0-100)</label><input id="new-cluster-weight" type="number" min={0} max={100} className="form-input" value={newClusterWeight} onChange={(e) => setNewClusterWeight(Number(e.target.value))} /></div>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await handleAddKeywordCluster(); showToast('Keyword cluster added'); }} disabled={!newClusterName.trim() || !newClusterKeywords.trim()}>Add cluster</button>
            </fieldset>
            <div className="settings-form-row">
              <button type="button" className="btn" onClick={() => void handleRescore()} disabled={rescoreLoading} aria-label="Recalculate fit scores for all grants">{rescoreLoading ? 'Rescoring...' : 'Recalculate scores'}</button>
              {rescoreResult && <span style={{ color: 'var(--success)', fontSize: '12px', marginLeft: '8px' }}>{rescoreResult}</span>}
            </div>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Reference Documents</div></div>
          <div className="setting-card-body">
            {/* Restricted document warning banner */}
            {documents.some((d) => d.classification === 'restricted') && (
              <div
                style={{
                  background: 'rgba(198,107,90,0.1)',
                  border: '1px solid rgba(198,107,90,0.3)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: 'var(--color-error, #c66b5a)',
                  fontSize: '13px',
                }}
                data-testid="restricted-docs-warning"
                role="alert"
              >
                <strong>⚠️ Restricted documents exist.</strong>{' '}
                Restricted documents are excluded from AI drafting, exports, and submission packages by default.
              </div>
            )}
            <button type="button" className="upload-item" onClick={handleUploadDocument}>Upload document</button>
            {documents.map((doc) => (
              <div key={doc.id} className="doc-item" data-testid={`doc-item-${doc.id}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{doc.name}</span>
                  {doc.type && (
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--mono)',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      padding: '1px 6px',
                      background: 'var(--surface-2)',
                      borderRadius: '3px',
                    }}>{doc.type}</span>
                  )}
                  {doc.classification && (
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--mono)',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '3px',
                      ...(doc.classification === 'canonical' ? { background: '#2e7d3222', color: '#4caf50' } : {}),
                      ...(doc.classification === 'draft-only' ? { background: 'var(--surface-2)', color: 'var(--text-muted)' } : {}),
                      ...(doc.classification === 'archived' ? { background: '#e6510022', color: '#ff9800' } : {}),
                      ...(doc.classification === 'restricted' ? { background: '#c6282822', color: '#ef5350' } : {}),
                    }} data-testid={`doc-classification-${doc.id}`}>
                      {doc.classification}
                    </span>
                  )}
                  {doc.lastUsed && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }} data-testid={`doc-lastused-${doc.id}`}>
                      Last used: {getRelativeTime(doc.lastUsed)}
                    </span>
                  )}
                </div>
                <select
                  value={doc.classification ?? ''}
                  onChange={async (e) => {
                    const newClass = e.target.value as DocumentMetadata['classification'] | '';
                    try {
                      await fetch('/api/documents', {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id: doc.id, classification: newClass || undefined }),
                      });
                      setDocuments((prev) =>
                        prev.map((d) => {
                          if (d.id !== doc.id) return d;
                          const updated = { ...d };
                          if (newClass) {
                            (updated as Record<string, unknown>).classification = newClass;
                          } else {
                            delete (updated as Record<string, unknown>).classification;
                          }
                          return updated;
                        }),
                      );
                      showToast(newClass ? `Marked as ${newClass}` : 'Classification cleared');
                    } catch (err) {
                      console.error('Error updating classification:', err);
                    }
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    color: 'var(--text)',
                  }}
                  data-testid={`doc-classification-select-${doc.id}`}
                  aria-label={`Classification for ${doc.name}`}
                >
                  <option value="">No classification</option>
                  <option value="canonical">Canonical</option>
                  <option value="draft-only">Draft Only</option>
                  <option value="archived">Archived</option>
                  <option value="restricted">Restricted</option>
                </select>
                {/* Version history toggle */}
                {doc.versions && doc.versions.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDocVersions((prev) => ({
                        ...prev,
                        [doc.id]: !prev[doc.id],
                      }))
                    }
                    style={{
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    aria-expanded={expandedDocVersions[doc.id] ?? false}
                    data-testid={`doc-versions-toggle-${doc.id}`}
                  >
                    {expandedDocVersions[doc.id] ? '▲' : '▼'} {doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''}
                  </button>
                )}
                {/* Version history panel */}
                {expandedDocVersions[doc.id] && doc.versions && doc.versions.length > 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'var(--surface-2)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: 'var(--text-dim)',
                    }}
                    data-testid={`doc-versions-panel-${doc.id}`}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Version History</div>
                    {doc.versions.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '2px 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                        data-testid={`doc-version-${v.id}`}
                      >
                        <span>v{v.versionNumber} — {new Date(v.uploadedAt).toLocaleDateString()}</span>
                        {v.notes && <span style={{ color: 'var(--text-muted)' }}>{v.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {(() => {
          const now = new Date().getTime();
          const msInDay = 24 * 60 * 60 * 1000;
          const lastBackupAt = freshness?.lastBackupAt;
          const backupStale = !lastBackupAt || (now - new Date(lastBackupAt).getTime() > msInDay);
          if (!backupStale) return null;
          return (
            <div className="settings-backup-warning" data-testid="backup-stale-warning" role="alert">
              No backup in the last 24 hours. Export a backup to protect your data.
            </div>
          );
        })()}

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Backup & Restore</div></div>
          <div className="setting-card-body">
            <div data-testid="backup-verification-result">Last backup verification: {lastBackupVerification}</div>
            <div data-testid="restore-verification-result">Last restore verification: {lastRestoreVerification}</div>
            <button type="button" onClick={async () => {
              try {
                const backup = await client.backup.exportBackup();
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grant-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Backup downloaded successfully');
              } catch (err) {
                console.error('Error exporting backup:', err);
              }
            }}>Export backup</button>
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
            <p className="settings-card-description">
              Configure application lock to protect sensitive grant data with a passcode.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { void fetch('/api/safety/lock', { method: 'POST' }); }}>Lock app now</button>
          </div>
        </section>

        <section className="setting-card" data-testid="opencode-status-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Opencode Agent</div>
            <div className="settings-status-header-row">
              <span
                className="status-dot"
                style={health?.opencode ? getStatusDotStyle(health.opencode) : undefined}
              />
              <span className="settings-status-label">
                {health?.opencode ? getStatusLabelText(health.opencode) : 'Unknown'}
              </span>

            </div>
          </div>
          <div className="setting-card-body">
            {/* Status guidance */}
            {(() => {
              const statusGuidance = health?.opencode ? opencodeStatusGuidance[health.opencode] : undefined;
              if (!statusGuidance || !health?.opencode) return null;
              return (
                <div className={`settings-status-guidance ${getStatusGuidanceClass(health.opencode)}`}>
                  <div className="settings-status-guidance-title">
                    {statusGuidance.title}
                  </div>
                  <div
                    className="settings-status-guidance-desc"
                    style={{ marginBottom: health.opencode !== 'ok' ? '10px' : 0 }}
                  >
                    {statusGuidance.description}
                  </div>
                  {health.opencode !== 'ok' && statusGuidance.action && (
                    <div className="settings-status-guidance-action">
                      <strong>What to do:</strong> {statusGuidance.action}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Diagnostics grid */}
            <div className="settings-diag-grid">
              <div>
                <div className="setting-label settings-diag-label">Version</div>
                <div className="settings-diag-value">
                  {health?.opencodeVersion ? `v${health.opencodeVersion}` : (health?.opencode === 'not-installed' ? '—' : 'Unknown')}
                </div>
              </div>
              <div>
                <div className="setting-label settings-diag-label">Response Time</div>
                <div className="settings-diag-value">
                  {health?.handshakeResponseTimeMs != null ? `${health.handshakeResponseTimeMs}ms` : '—'}
                </div>
              </div>
              <div>
                <div className="setting-label settings-diag-label">Handshake</div>
                <div className="settings-diag-value">
                  {health?.handshakeSuccess === true ? (
                    <span className="settings-diag-success">✓ Success</span>
                  ) : health?.handshakeSuccess === false ? (
                    <span className="settings-diag-danger">✗ Failed</span>
                  ) : '—'}
                </div>
              </div>
              <div>
                <div className="setting-label settings-diag-label">Last Handshake</div>
                <div className="settings-diag-value">
                  {lastHandshakeAt ? new Date(lastHandshakeAt).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {health?.capabilities && health.capabilities.length > 0 && (
              <div className="settings-cap-section">
                <div className="setting-label settings-cap-label">Detected Capabilities</div>
                <div className="settings-cap-list">
                  {health.capabilities.map((cap) => (
                    <span key={cap} className="settings-cap-tag">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Error details */}
            {health?.opencodeError && (
              <div className="settings-error-block">
                <div className="settings-error-header">
                  Opencode Error
                </div>
                <div className="settings-error-detail">
                  {health.opencodeError}
                </div>
              </div>
            )}

            {health?.handshakeError && !health?.handshakeSuccess && (
              <div className="settings-warning-block">
                <div className="settings-warning-header">
                  Handshake Error
                </div>
                <div className="settings-error-detail">
                  {health.handshakeError}
                </div>
              </div>
            )}

            {/* Test connection result */}
              {testConnectionResult && (
                <div className={`settings-test-result ${testConnectionResult === 'success' ? 'settings-test-result-success' : 'settings-test-result-failed'}`}>
                  <div className={`settings-test-result-title ${testConnectionResult === 'success' ? 'settings-test-result-title-success' : 'settings-test-result-title-failed'}`}>
                    {testConnectionResult === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                  </div>
                  {testConnectionResult === 'success' && health?.handshakeResponseTimeMs != null && (
                    <div className="settings-test-result-detail">
                      Response time: {health.handshakeResponseTimeMs}ms
                      {health?.opencodeVersion && ` • Version: v${health.opencodeVersion}`}
                    </div>
                  )}
                  {testConnectionResult === 'failed' && health?.opencodeError && (
                    <div className="settings-test-result-mono">
                      {health.opencodeError}
                    </div>
                  )}
                  {testConnectionResult === 'failed' && health?.handshakeError && (
                    <div className="settings-test-result-mono settings-test-result-mono-mt">
                      {health.handshakeError}
                    </div>
                  )}
                </div>
              )}
          </div>
        </section>

        <section className="setting-card" data-testid="diagnostics-panel-card">
          <div className="setting-card-header"><div className="setting-card-title">Diagnostics &amp; Failure History</div></div>
          <div className="setting-card-body">
            <p className="settings-card-description">
              Recent opencode failures, root-cause analysis, and recommended resolution steps.
            </p>

            {/* Failure History Timeline */}
            {health?.failureHistory && health.failureHistory.length > 0 ? (
              <div className="settings-failure-list" data-testid="failure-history-list">
                {health.failureHistory.map((entry: FailureHistoryEntry) => (
                  <div
                    key={entry.id}
                    data-testid={`failure-entry-${entry.id}`}
                    className={`settings-failure-entry ${entry.resolved ? 'settings-failure-resolved' : 'settings-failure-unresolved'}`}
                  >
                    <div className="settings-failure-entry-header">
                      <div className="settings-failure-badges">
                        <span className={`settings-failure-badge ${entry.resolved ? 'settings-failure-badge-resolved' : 'settings-failure-badge-mode'}`}>
                          {entry.resolved ? 'Resolved' : entry.failureMode}
                        </span>
                        {entry.rootCauseCategory && (
                          <span className="settings-failure-badge settings-failure-badge-category">
                            {entry.rootCauseCategory.replace(/-/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="settings-failure-timestamp">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="settings-failure-message">
                      {entry.errorMessage.length > 200
                        ? `${entry.errorMessage.substring(0, 200)}...`
                        : entry.errorMessage}
                    </div>
                    {entry.resolutionSteps && entry.resolutionSteps.length > 0 && (
                      <div>
                        <div className="settings-failure-resolution-label">
                          Resolution steps:
                        </div>
                        <ol className="settings-failure-resolution-list">
                          {entry.resolutionSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="settings-empty-state">
                <div className="settings-empty-icon">{'✅'}</div>
                <div className="settings-empty-title">No recorded failures</div>
                <div className="settings-empty-desc">
                  Failure history will appear here when opencode encounters errors during operation.
                </div>
              </div>
            )}

          </div>
        </section>

        <section className="setting-card">
          <div className="setting-card-header"><div className="setting-card-title">Theme Configuration</div></div>
          <div className="setting-card-body">
            <p className="settings-card-description">
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
