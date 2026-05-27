'use client';

import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { BackupFreshnessStatus, DocumentMetadata, HealthCheckResult, OpencodeSettings, OrganizationProfile } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';

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
  const [opencodeSettings, setOpencodeSettings] = useState<OpencodeSettings | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [freshness, setFreshness] = useState<BackupFreshnessStatus | null>(null);
  const [diagnosticsText, setDiagnosticsText] = useState('');
  const [isDirty, setIsDirty] = useState(initiallyDirty);
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isEditingOpencode, setIsEditingOpencode] = useState(false);
  const [opencodeForm, setOpencodeForm] = useState<Partial<OpencodeSettings>>({});

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
        setOpencodeSettings(opencodeData);
        setHealth(healthData);
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

  const handleEditOpencode = () => {
    setOpencodeForm(opencodeSettings || { binaryPath: '', workingDirectory: '', timeoutMs: 60000, isConfigured: false });
    setIsEditingOpencode(true);
  };

  const handleSaveOpencode = async () => {
    const nextSettings: OpencodeSettings = {
      ...(opencodeForm as OpencodeSettings),
      isConfigured: true,
    };
    await client.opencodeSettings.update(nextSettings);
    setOpencodeSettings(await client.opencodeSettings.get());
    setIsEditingOpencode(false);
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
          <div className="setting-card-header"><div className="setting-card-title">Opencode</div></div>
          <div className="setting-card-body">
            {isEditingOpencode ? (
              <>
                <input value={opencodeForm.binaryPath ?? ''} onChange={(e) => setOpencodeForm((prev) => ({ ...prev, binaryPath: e.target.value }))} />
                <input value={opencodeForm.workingDirectory ?? ''} onChange={(e) => setOpencodeForm((prev) => ({ ...prev, workingDirectory: e.target.value }))} />
                <input type="number" value={opencodeForm.timeoutMs ?? 60000} onChange={(e) => setOpencodeForm((prev) => ({ ...prev, timeoutMs: Number(e.target.value) }))} />
                <button type="button" onClick={() => void handleSaveOpencode()}>Save</button>
              </>
            ) : (
              <>
                <div>{opencodeSettings?.binaryPath ?? 'Not configured'}</div>
                <button type="button" onClick={handleEditOpencode}>Edit Opencode</button>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
