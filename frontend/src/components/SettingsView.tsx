'use client';

import React, { useState, useEffect } from 'react';
import type { OrganizationProfile, DocumentMetadata, OpencodeSettings } from '../../../shared/types';
import { defaultProfile } from '../../../shared/seed-data';
import { client } from '../lib/grant-ops-client';

interface SettingsViewProps {
  onRefreshAppState?: () => Promise<void> | void;
}

export default function SettingsView({ onRefreshAppState }: SettingsViewProps) {
  const [profile, setProfile] = useState<OrganizationProfile | null>(defaultProfile);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrganizationProfile>>({});
  const [newTheme, setNewTheme] = useState('');
  const [opencodeSettings, setOpencodeSettings] = useState<OpencodeSettings | null>(null);
  const [isEditingOpencode, setIsEditingOpencode] = useState(false);
  const [opencodeForm, setOpencodeForm] = useState<Partial<OpencodeSettings>>({});

  useEffect(() => {
    async function load() {
      try {
        const [profileData, docsData, opencodeData] = await Promise.all([
          client.profile.get(),
          client.documents.getAll(),
          client.opencodeSettings.get(),
        ]);
        setProfile(profileData);
        setEditForm(profileData);
        setDocuments(docsData);
        setOpencodeSettings(opencodeData);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleEdit = () => {
    if (profile) {
      setEditForm(profile);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setEditForm(profile);
    }
  };

  const handleSave = async () => {
    if (!editForm) return;
    try {
      await client.profile.update(editForm as OrganizationProfile);
      const updated = await client.profile.get();
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleInputChange = (field: keyof OrganizationProfile, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAgentBehaviorChange = (
    field: keyof OrganizationProfile['agentBehavior'],
    value: string | number,
  ) => {
    setEditForm((prev) => ({
      ...prev,
      agentBehavior: { ...prev.agentBehavior!, [field]: value },
    }));
  };

  const handleUploadDocument = () => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.xls,.xlsx,.doc,.docx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const docType = ext === 'pdf' ? 'PDF' : ext === 'xls' || ext === 'xlsx' ? 'XLS' : 'DOC';

      const doc = await client.documents.create(file, {
        name: file.name,
        type: docType,
        lastUsed: new Date().toISOString(),
      });

      setDocuments((prev) => [...prev, doc]);
      await onRefreshAppState?.();
    };
    input.click();
  };

  const handleRemoveTheme = async (theme: string) => {
    if (!profile) return;
    try {
      const updatedThemes = profile.searchThemes.filter((t) => t !== theme);
      const updatedProfile = { ...profile, searchThemes: updatedThemes };
      await client.profile.update(updatedProfile);
      setProfile(updatedProfile);
      setEditForm(updatedProfile);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error removing theme:', error);
    }
  };

  const handleAddTheme = async () => {
    const theme = newTheme.trim();
    if (!theme || !profile) return;
    try {
      const updatedThemes = [...profile.searchThemes, theme];
      const updatedProfile = { ...profile, searchThemes: updatedThemes };
      await client.profile.update(updatedProfile);
      setProfile(updatedProfile);
      setEditForm(updatedProfile);
      setNewTheme('');
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error adding theme:', error);
    }
  };

  const handleThemeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTheme();
    }
  };

  const handleEditOpencode = () => {
    setOpencodeForm(opencodeSettings || {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: false,
    });
    setIsEditingOpencode(true);
  };

  const handleCancelOpencode = () => {
    setIsEditingOpencode(false);
  };

  const handleSaveOpencode = async () => {
    try {
      await client.opencodeSettings.update(opencodeForm as OpencodeSettings);
      const updated = await client.opencodeSettings.get();
      setOpencodeSettings(updated);
      setIsEditingOpencode(false);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error saving Opencode settings:', error);
    }
  };

  const handleOpencodeChange = (field: keyof OpencodeSettings, value: string | number | boolean) => {
    setOpencodeForm((prev) => ({ ...prev, [field]: value }));
  };

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
            Settings <span className="accent">Organization</span>
          </h1>
          <div className="header-sub">Profile &amp; agent configuration</div>
        </div>
        <div className="header-actions">
          {!isEditing && (
            <button type="button" className="btn btn-primary" onClick={handleEdit}>
              Edit profile
            </button>
          )}
        </div>
      </div>

      <div className="settings-grid">
        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Organization</div>
          </div>
          <div className="setting-card-body">
            {isEditing ? (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Legal Name</div>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.legalName || ''}
                      onChange={(e) => handleInputChange('legalName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">EIN</div>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.ein || ''}
                      onChange={(e) => handleInputChange('ein', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">SAM.gov UEI</div>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.samUEI || ''}
                      onChange={(e) => handleInputChange('samUEI', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Mission</div>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={editForm.mission || ''}
                      onChange={(e) => handleInputChange('mission', e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Legal Name</div>
                    <div className="setting-value">{profile.legalName}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">EIN</div>
                    <div className="setting-value mono">{profile.ein}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">501(c)(3) Status</div>
                    <div className="setting-value">Active</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">SAM.gov UEI</div>
                    <div className="setting-value mono">{profile.samUEI}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Mission</div>
                    <div className="setting-value">{profile.mission}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Reference Documents</div>
          </div>
          <div className="setting-card-body">
            <div className="doc-list">
              {documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div className={`doc-icon ${doc.type.toLowerCase()}`}>{doc.type}</div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta">
                      {doc.lastUsed && <span>{new Date(doc.lastUsed).toLocaleDateString()}</span>}
                      {doc.extractionStatus && (
                        <span className="audited-badge"> · {doc.extractionStatus}</span>
                      )}
                      {doc.extractionStatus === 'stored_unparsed' && (
                        <span className="audited-badge"> · stored only</span>
                      )}
                      {doc.extractionStatus === 'extracted' && (
                        <span className="audited-badge"> · grounded</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="doc-item upload-item" onClick={handleUploadDocument}>
                <div className="doc-icon upload">+</div>
                <div className="doc-info">
                  <div className="doc-name">Upload</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Search Themes</div>
          </div>
          <div className="setting-card-body">
            <div className="theme-tags">
              {profile.searchThemes.map((theme) => (
                <span key={theme} className="theme-tag">
                  {theme}
                  <button
                    type="button"
                    className="theme-tag-remove"
                    onClick={() => handleRemoveTheme(theme)}
                    aria-label={`Remove ${theme}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="theme-add">
              <input
                type="text"
                className="theme-input"
                placeholder="Add theme..."
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                onKeyDown={handleThemeKeyDown}
              />
              <button type="button" className="btn btn-sm" onClick={handleAddTheme}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Agent Behavior</div>
          </div>
          <div className="setting-card-body">
            {isEditing ? (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Auto-draft threshold</div>
                    <input
                      type="range"
                      className="form-input"
                      min={0}
                      max={100}
                      value={editForm.agentBehavior?.autoDraftThreshold ?? 75}
                      onChange={(e) =>
                        handleAgentBehaviorChange('autoDraftThreshold', parseInt(e.target.value))
                      }
                    />
                    <div className="setting-hint">
                      Fit score ≥ {editForm.agentBehavior?.autoDraftThreshold ?? 75}
                    </div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Submission policy</div>
                    <select
                      className="form-input"
                      value={editForm.agentBehavior?.submissionPolicy ?? 'Human approval required'}
                      onChange={(e) =>
                        handleAgentBehaviorChange('submissionPolicy', e.target.value)
                      }
                    >
                      <option value="Always submit">Always submit</option>
                      <option value="Human approval required">Human approval required</option>
                      <option value="Review only high-fit">Review only high-fit</option>
                    </select>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Notify email</div>
                    <input
                      type="email"
                      className="form-input"
                      value={editForm.agentBehavior?.notifyEmail ?? ''}
                      onChange={(e) => handleAgentBehaviorChange('notifyEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Voice &amp; tone</div>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={editForm.agentBehavior?.voiceAndTone ?? ''}
                      onChange={(e) => handleAgentBehaviorChange('voiceAndTone', e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Auto-draft threshold</div>
                    <div className="setting-value">
                      Fit score ≥ {profile.agentBehavior.autoDraftThreshold}
                    </div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Submission policy</div>
                    <div className="setting-value">{profile.agentBehavior.submissionPolicy}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Notify</div>
                    <div className="setting-value">{profile.agentBehavior.notifyEmail}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Voice &amp; tone</div>
                    <div className="setting-value">{profile.agentBehavior.voiceAndTone}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Opencode Agent</div>
            <div className="setting-card-actions">
              {!isEditingOpencode && opencodeSettings && (
                <button type="button" className="btn btn-sm" onClick={handleEditOpencode}>
                  Configure
                </button>
              )}
            </div>
          </div>
          <div className="setting-card-body">
            {opencodeSettings?.isConfigured ? (
              <div className="setting-row">
                <div>
                  <div className="setting-label">Status</div>
                  <div className="setting-value">
                    <span className="status-dot" style={{ color: '#22c55e' }}>●</span> Configured
                  </div>
                </div>
              </div>
            ) : (
              <div className="setting-row">
                <div>
                  <div className="setting-label">Status</div>
                  <div className="setting-value" style={{ color: '#f59e0b' }}>
                    <span className="status-dot">●</span> Not configured
                  </div>
                </div>
              </div>
            )}
            {isEditingOpencode ? (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Binary path</div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="/usr/local/bin/opencode"
                      value={opencodeForm.binaryPath || ''}
                      onChange={(e) => handleOpencodeChange('binaryPath', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Working directory</div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="/path/to/workspace"
                      value={opencodeForm.workingDirectory || ''}
                      onChange={(e) => handleOpencodeChange('workingDirectory', e.target.value)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Timeout (ms)</div>
                    <input
                      type="number"
                      className="form-input"
                      value={opencodeForm.timeoutMs ?? 60000}
                      onChange={(e) => handleOpencodeChange('timeoutMs', parseInt(e.target.value) || 60000)}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Profile</div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="default"
                      value={opencodeForm.profile || ''}
                      onChange={(e) => handleOpencodeChange('profile', e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveOpencode}>
                    Save
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleCancelOpencode}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Binary path</div>
                    <div className="setting-value mono">{opencodeSettings?.binaryPath || 'Not set'}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Working directory</div>
                    <div className="setting-value mono">{opencodeSettings?.workingDirectory || 'Not set'}</div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Timeout</div>
                    <div className="setting-value">
                      {opencodeSettings?.timeoutMs ? `${opencodeSettings.timeoutMs / 1000}s` : 'Default'}
                    </div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Profile</div>
                    <div className="setting-value">{opencodeSettings?.profile || 'default'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save changes
          </button>
          <button type="button" className="btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
