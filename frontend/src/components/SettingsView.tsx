'use client';

import { useState, useEffect } from 'react';
import type { OrganizationProfile } from '../../../shared/types';

const docList = [
  { type: 'pdf', name: '2025 Impact Report', meta: 'v2.1 · Apr 2026' },
  { type: 'pdf', name: 'One-Pager', meta: 'v3.0 · Mar 2026' },
  { type: 'xls', name: 'Budget & Financials FY2025', meta: 'Mar 2026' },
  { type: 'doc', name: 'Board roster + bios', meta: 'Jan 2026' },
  { type: 'pdf', name: 'Program logic model', meta: 'Dec 2025' },
  { type: 'doc', name: '+ Upload', meta: '' },
];

export default function SettingsView() {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrganizationProfile>>({});

  useEffect(() => {
    async function load() {
      try {
        const data = await window.electronAPI.getOrgProfile();
        setProfile(data);
        setEditForm(data);
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
              {docList.map((doc, idx) => (
                <div
                  key={idx}
                  className="doc-item"
                  onClick={() => {
                    if (doc.name === '+ Upload') {
                      console.log('Reference document upload not implemented in v1');
                    }
                  }}
                >
                  <div className={`doc-icon ${doc.type}`}>{doc.type.toUpperCase()}</div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    {doc.meta && <div className="doc-meta">{doc.meta}</div>}
                  </div>
                </div>
              ))}
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
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Behavior Card */}
        <div className="setting-card">
          <div className="setting-card-header">
            <div className="setting-card-title">Agent Behavior</div>
          </div>
          <div className="setting-card-body">
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
