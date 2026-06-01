'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavedSearch } from '../../../shared/types';
import styles from './SavedSearchesPanel.module.css';

interface SavedSearchesPanelProps {
  currentSearchQuery: string;
  onRunSearch: (query: string) => void;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function SavedSearchesPanel({ currentSearchQuery, onRunSearch }: SavedSearchesPanelProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  const loadSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/saved-searches');
      if (res.ok) {
        const data = (await res.json()) as SavedSearch[];
        setSearches(data);
      }
    } catch (_err) {
      setError('Error loading saved searches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSearches();
  }, [loadSearches]);

  const handleSaveCurrent = async () => {
    if (!currentSearchQuery.trim() && !saveName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim() || 'Saved Search',
          queryText: currentSearchQuery,
        }),
      });
      if (res.ok) {
        setSaveName('');
        setShowSaveInput(false);
        await loadSearches();
      }
    } catch (_err) {
      setError('Error saving search');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (_err) {
      setError('Error deleting saved search');
    }
  };

  const handleStartEdit = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditName(search.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/saved-searches/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setSearches((prev) => prev.map((s) => (s.id === id ? { ...s, name: editName.trim() } : s)));
        setEditingId(null);
      }
    } catch (_err) {
      setError('Error updating saved search');
    }
  };

  const hasResults = useMemo(() => searches.some((s) => s.newResultsCount > 0), [searches]);

  if (loading) {
    return (
      <div className="saved-searches-panel">
        <div className="saved-searches-empty" role="status" aria-label="Loading saved searches">
          Loading saved searches...
        </div>
      </div>
    );
  }

  return (
    <div className="saved-searches-panel" data-testid="saved-searches-panel">
      <div className="saved-searches-header">
        <button
          type="button"
          className="saved-search-collapse-toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand saved searches' : 'Collapse saved searches'}
        >
          <span>Saved Searches ({searches.length})</span>
          <span aria-hidden="true">{collapsed ? '\u25B6' : '\u25BC'}</span>
        </button>
        <div className={styles.flexRow}>
          {showSaveInput ? (
            <form
              className="saved-search-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveCurrent();
              }}
            >
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Search name..."
                aria-label="Name for saved search"
                data-testid="save-search-name-input"
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={saving}
                data-testid="save-search-confirm-btn"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setShowSaveInput(false);
                  setSaveName('');
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowSaveInput(true)}
              aria-label="Save current search"
              data-testid="save-current-search-btn"
            >
              + Save search
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {searches.length === 0 ? (
            <div className="saved-searches-empty" data-testid="saved-searches-empty">
              No saved searches yet. Use the &ldquo;+ Save search&rdquo; button to save your current
              query.
            </div>
          ) : (
            <div className="saved-searches-list">
              {searches.map((search) => (
                <div key={search.id} className="saved-search-card" data-testid="saved-search-card">
                  {editingId === search.id ? (
                    <form
                      className="saved-search-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSaveEdit(search.id);
                      }}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Edit search name"
                        data-testid="edit-search-name-input"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="btn btn-sm btn-primary"
                        data-testid="edit-search-save-btn"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="saved-search-card-name">
                      {search.name}
                      {search.newResultsCount > 0 && (
                        <span className={`saved-search-badge${hasResults ? ' has-results' : ''}`}>
                          {search.newResultsCount} new
                        </span>
                      )}
                    </div>
                  )}
                  {search.queryText && (
                    <div className="saved-search-card-query" title={search.queryText}>
                      {search.queryText}
                    </div>
                  )}
                  <div className="saved-search-card-meta">
                    <span>{formatRelativeTime(search.lastCheckedAt)}</span>
                  </div>
                  <div className="saved-search-card-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onRunSearch(search.queryText)}
                      aria-label={`Run saved search ${search.name}`}
                      data-testid="run-saved-search-btn"
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleStartEdit(search)}
                      aria-label={`Edit saved search ${search.name}`}
                      data-testid="edit-saved-search-btn"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete saved search "${search.name}"?`)) {
                          void handleDelete(search.id);
                        }
                      }}
                      aria-label={`Delete saved search ${search.name}`}
                      data-testid="delete-saved-search-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
