'use client';

import { useState, useEffect } from 'react';
import type { OrganizationProfile, DocumentMetadata } from '../../../shared/types';
import { mockProfile, isElectronAPIavailable } from '../lib/mockData';

export default function SettingsView() {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrganizationProfile>>({});
  const [newTheme, setNewTheme] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (isElectronAPIavailable()) {
          const [profileData, docsData] = await Promise.all([
            window.electronAPI.getOrgProfile(),
            window.electronAPI.getDocuments(),
          ]);
          setProfile(profileData);
          setEditForm(profileData);
          setDocuments(docsData);
        } else {
          setProfile(mockProfile);
          setEditForm(mockProfile);
          setDocuments([]);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setProfile(mockProfile);
        setEditForm(mockProfile);
        setDocuments([]);
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
      await window.electronAPI.updateOrgProfile(editForm as OrganizationProfile);
      const updated = await window.electronAPI.getOrgProfile();
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
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

  const handleUploadDocument = async () => {
    try {
      const doc = await window.electronAPI.uploadDocument();
      if (doc) {
        setDocuments((prev) => [...prev, doc]);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    }
  };

  const handleRemoveTheme = async (theme: string) => {
    try {
      await window.electronAPI.removeTheme(theme);
      const updated = await window.electronAPI.getOrgProfile();
      setProfile(updated);
      setEditForm(updated);
    } catch (error) {
      console.error('Error removing theme:', error);
    }
  };

  const handleAddTheme = async () => {
    const theme = newTheme.trim();
    if (!theme) return;
    try {
      await window.electronAPI.addTheme(theme);
      const updated = await window.electronAPI.getOrgProfile();
      setProfile(updated);
      setEditForm(updated);
      setNewTheme('');
    } catch (error) {
      console.error('Error adding theme:', error);
    }
  };

  const handleThemeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTheme();
    }
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
            <button className="btn btn-primary" onClick={handleEdit}>
              Edit profile
            </button>
          )}
        </div>
      </div>

      {/* Settings Grid */}
      <div className="settings-grid">
        {/* Organization Card */}
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

        {/* Reference Documents Card */}
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
                    {doc.lastUsed && (
                      <div className="doc-meta">
                        {new Date(doc.lastUsed).toLocaleDateString()}
                        {doc.audited && <span className="audited-badge"> · Audited</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="doc-item upload-item" onClick={handleUploadDocument}>
                <div className="doc-icon upload">+</div>
                <div className="doc-info">
                  <div className="doc-name">Upload</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Themes Card */}
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
              <button className="btn btn-sm" onClick={handleAddTheme}>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Agent Behavior Card */}
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
      </div>

      {/* Edit Mode Actions */}
      {isEditing && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            Save changes
          </button>
          <button className="btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
