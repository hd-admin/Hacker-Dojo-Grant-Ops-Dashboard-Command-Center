'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { BackupFreshnessStatus, DocumentMetadata, HealthCheckResult, OpencodeSettings, OrganizationProfile, FailureHistoryEntry } from '../../../shared/types';
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

        <section className="setting-card" data-testid="org-profile-card">
          <div className="setting-card-header"><div className="setting-card-title">Organization Profile</div></div>
          <div className="setting-card-body">
            {isEditing ? (
              <div className="settings-form">
                {/* Identity */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Identity</legend>
                  <div className="settings-form-grid">
                    <div>
                      <label className="setting-label">Legal Name</label>
                      <input className="form-input" value={editForm.legalName ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, legalName: e.target.value }))} placeholder="e.g., Hacker Dojo" />
                    </div>
                    <div>
                      <label className="setting-label">EIN</label>
                      <input className="form-input" value={editForm.ein ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, ein: e.target.value }))} placeholder="e.g., 26-3375350" />
                    </div>
                    <div>
                      <label className="setting-label">SAM / UEI</label>
                      <input className="form-input" value={editForm.samUEI ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, samUEI: e.target.value }))} placeholder="e.g., ABC123DEF456" />
                    </div>
                    <div>
                      <label className="setting-label">Nonprofit Status</label>
                      <input className="form-input" value={editForm.nonprofitStatus ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, nonprofitStatus: e.target.value }))} placeholder="e.g., 501(c)(3)" />
                    </div>
                  </div>
                </fieldset>

                {/* Contact */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Contact</legend>
                  <div className="settings-form-grid">
                    <div>
                      <label className="setting-label">Address</label>
                      <input className="form-input" value={editForm.contactInfo?.address ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, address: e.target.value } }))} placeholder="Street address" />
                    </div>
                    <div>
                      <label className="setting-label">Phone</label>
                      <input className="form-input" value={editForm.contactInfo?.phone ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, phone: e.target.value } }))} placeholder="Phone number" />
                    </div>
                    <div>
                      <label className="setting-label">Email</label>
                      <input type="email" className="form-input" value={editForm.contactInfo?.email ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, email: e.target.value } }))} placeholder="contact@example.org" />
                    </div>
                    <div>
                      <label className="setting-label">Website</label>
                      <input type="url" className="form-input" value={editForm.contactInfo?.website ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, website: e.target.value } }))} placeholder="https://example.org" />
                    </div>
                  </div>
                </fieldset>

                {/* Mission & Geography */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Mission &amp; Geography</legend>
                  <div className="settings-form">
                    <div>
                      <label className="setting-label">Mission Statement</label>
                      <textarea className="form-input" rows={3} value={editForm.mission ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, mission: e.target.value }))} placeholder="Describe your organization's mission" />
                    </div>
                    <div>
                      <label className="setting-label">Geography / Service Area</label>
                      <input className="form-input" value={editForm.geography ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, geography: e.target.value }))} placeholder="e.g., Regional, Bay Area, National" />
                    </div>
                  </div>
                </fieldset>

                {/* Programs */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Programs &amp; Audiences</legend>
                  <div className="settings-form-grid">
                    <div>
                      <label className="setting-label">Program Areas</label>
                      <textarea className="form-input" rows={3} value={editForm.programAreas?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, programAreas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="STEM, Workforce Development, Community Learning (comma-separated)" />
                    </div>
                    <div>
                      <label className="setting-label">Populations Served</label>
                      <textarea className="form-input" rows={3} value={editForm.populationsServed?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, populationsServed: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="Youth, Veterans, Low-income (comma-separated)" />
                    </div>
                    <div>
                      <label className="setting-label">Partnerships</label>
                      <textarea className="form-input" rows={2} value={editForm.partnerships?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, partnerships: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="Org A, Org B (comma-separated)" />
                    </div>
                    <div>
                      <label className="setting-label">Search Themes</label>
                      <textarea className="form-input" rows={2} value={editForm.searchThemes?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, searchThemes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="EdTech, AI Literacy, STEM (comma-separated)" />
                    </div>
                  </div>
                </fieldset>

                {/* Compliance */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Compliance &amp; History</legend>
                  <div className="settings-form-grid">
                    <div>
                      <label className="setting-label">Compliance Facts</label>
                      <textarea className="form-input" rows={2} value={editForm.complianceFacts?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, complianceFacts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="SAM registration active, audit current (comma-separated)" />
                    </div>
                    <div>
                      <label className="setting-label">Document Types</label>
                      <textarea className="form-input" rows={2} value={editForm.docTypes?.join(', ') ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, docTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="PDF, DOCX, XLSX (comma-separated)" />
                    </div>
                  </div>
                </fieldset>

                {/* Agent Behavior */}
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Agent Behavior</legend>
                  <div className="settings-form-grid">
                    <div>
                      <label className="setting-label">Notification Email</label>
                      <input type="email" className="form-input" value={editForm.agentBehavior?.notifyEmail ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, agentBehavior: { ...prev.agentBehavior, notifyEmail: e.target.value, autoDraftThreshold: prev.agentBehavior?.autoDraftThreshold ?? 75, submissionPolicy: prev.agentBehavior?.submissionPolicy ?? '', voiceAndTone: prev.agentBehavior?.voiceAndTone ?? '' } }))} placeholder="ops@hackerdojo.com" />
                    </div>
                    <div>
                      <label className="setting-label">Auto-Draft Threshold (0-100)</label>
                      <input type="number" min={0} max={100} className="form-input" value={editForm.agentBehavior?.autoDraftThreshold ?? 75} onChange={(e) => setEditForm((prev) => ({ ...prev, agentBehavior: { notifyEmail: prev.agentBehavior?.notifyEmail ?? '', autoDraftThreshold: Number(e.target.value), submissionPolicy: prev.agentBehavior?.submissionPolicy ?? '', voiceAndTone: prev.agentBehavior?.voiceAndTone ?? '' } }))} />
                    </div>
                    <div>
                      <label className="setting-label">Submission Policy</label>
                      <select className="form-input" value={editForm.agentBehavior?.submissionPolicy ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, agentBehavior: { notifyEmail: prev.agentBehavior?.notifyEmail ?? '', autoDraftThreshold: prev.agentBehavior?.autoDraftThreshold ?? 75, submissionPolicy: e.target.value, voiceAndTone: prev.agentBehavior?.voiceAndTone ?? '' } }))}>
                        <option value="">Select policy...</option>
                        <option value="Human approval required">Human approval required</option>
                        <option value="Auto-submit drafts above threshold">Auto-submit drafts above threshold</option>
                        <option value="Manual submission only">Manual submission only</option>
                      </select>
                    </div>
                    <div>
                      <label className="setting-label">Voice &amp; Tone</label>
                      <input className="form-input" value={editForm.agentBehavior?.voiceAndTone ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, agentBehavior: { notifyEmail: prev.agentBehavior?.notifyEmail ?? '', autoDraftThreshold: prev.agentBehavior?.autoDraftThreshold ?? 75, submissionPolicy: prev.agentBehavior?.submissionPolicy ?? '', voiceAndTone: e.target.value } }))} placeholder="e.g., Plain-spoken, Professional, Community-focused" />
                    </div>
                  </div>
                </fieldset>

                <div className="settings-form-row">
                  <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>Save Profile</button>
                  <button type="button" className="btn" onClick={() => { setEditForm(profile); setIsEditing(false); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="settings-readonly-grid">
                <div className="setting-row"><span className="setting-label">Legal Name</span><span className="setting-value">{profile.legalName || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">EIN</span><span className="setting-value mono">{profile.ein || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">SAM / UEI</span><span className="setting-value mono">{profile.samUEI || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Nonprofit Status</span><span className="setting-value">{profile.nonprofitStatus || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Contact</span><span className="setting-value">{profile.contactInfo?.email || profile.contactInfo?.website || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Geography</span><span className="setting-value">{profile.geography || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Mission</span><span className="setting-value">{profile.mission || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Program Areas</span><span className="setting-value">{profile.programAreas?.join(', ') || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Populations Served</span><span className="setting-value">{profile.populationsServed?.join(', ') || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Search Themes</span><span className="setting-value">{profile.searchThemes?.join(', ') || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Auto-Draft Threshold</span><span className="setting-value mono">{profile.agentBehavior?.autoDraftThreshold ?? 75}</span></div>
                <div className="setting-row"><span className="setting-label">Submission Policy</span><span className="setting-value">{profile.agentBehavior?.submissionPolicy || '—'}</span></div>
                <div className="setting-row"><span className="setting-label">Voice &amp; Tone</span><span className="setting-value">{profile.agentBehavior?.voiceAndTone || '—'}</span></div>
              </div>
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
            <p className="settings-card-description">
              Configure application lock to protect sensitive grant data with a passcode.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { void fetch('/api/safety/lock', { method: 'POST' }); }}>Lock app now</button>
          </div>
        </section>

        <section className="setting-card" data-testid="opencode-status-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Opencode Status</div>
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
            {health?.opencode && opencodeStatusGuidance[health.opencode] && (
              <div className={`settings-status-guidance ${health.opencode ? getStatusGuidanceClass(health.opencode) : ''}`}>
                <div className="settings-status-guidance-title">
                  {opencodeStatusGuidance[health.opencode].title}
                </div>
                <div
                  className="settings-status-guidance-desc"
                  style={{ marginBottom: health.opencode !== 'ok' ? '10px' : 0 }}
                >
                  {opencodeStatusGuidance[health.opencode].description}
                </div>
                {health.opencode !== 'ok' && opencodeStatusGuidance[health.opencode].action && (
                  <div className="settings-status-guidance-action">
                    <strong>What to do:</strong> {opencodeStatusGuidance[health.opencode].action}
                  </div>
                )}
              </div>
            )}

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

            {/* Configuration section */}
            <div className="settings-connection-config">
              <div className="setting-label settings-connection-config-label">Connection Configuration</div>

              <div className="settings-form-stack">
                <div>
                  <label htmlFor="opencode-binary-path" className="settings-field-label-mono">
                    Binary Path
                  </label>
                  <input
                    id="opencode-binary-path"
                    className="settings-input-full"
                    value={opencodeForm.binaryPath ?? ''}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, binaryPath: e.target.value })); setOpencodeSaveSuccess(false); }}
                    placeholder="/usr/local/bin/opencode"
                  />
                </div>
                <div>
                  <label htmlFor="opencode-working-directory" className="settings-field-label-mono">
                    Working Directory
                  </label>
                  <input
                    id="opencode-working-directory"
                    className="settings-input-full"
                    value={opencodeForm.workingDirectory ?? ''}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, workingDirectory: e.target.value })); setOpencodeSaveSuccess(false); }}
                    placeholder="/home/user/projects"
                  />
                </div>
                <div>
                  <label htmlFor="opencode-timeout" className="settings-field-label-mono">
                    Timeout (ms)
                  </label>
                  <input
                    id="opencode-timeout"
                    type="number"
                    className="settings-input-full"
                    value={opencodeForm.timeoutMs ?? 60000}
                    onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, timeoutMs: Number(e.target.value) })); setOpencodeSaveSuccess(false); }}
                  />
                </div>
              </div>

              <div className="settings-button-row">
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
                  <span className="settings-save-indicator">✓ Saved</span>
                )}
              </div>

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

            {/* Backoff multiplier setting */}
            <div className="settings-backoff-row">
              <label htmlFor="opencode-backoff-multiplier" className="settings-backoff-label">
                Retry Backoff Multiplier (ms)
              </label>
              <div className="settings-backoff-input-row">
                <input
                  id="opencode-backoff-multiplier"
                  type="number"
                  min={500}
                  max={30000}
                  step={500}
                  value={opencodeForm.backoffMultiplier ?? 1000}
                  onChange={(e) => { setOpencodeForm((prev) => ({ ...prev, backoffMultiplier: Number(e.target.value) })); setOpencodeSaveSuccess(false); }}
                  className="settings-backoff-input"
                />
                <span className="settings-backoff-hint">
                  Base delay for retry backoff. Actual delay = multiplier × 2<sup>attempt</sup>
                </span>
              </div>
            </div>
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
            <button type="button" className="btn" onClick={() => setIsEditing(true)}>Edit Themes &amp; Threshold</button>
          </div>
        </section>
      </div>
    </>
  );
}
