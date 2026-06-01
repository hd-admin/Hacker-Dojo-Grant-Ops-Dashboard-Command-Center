'use client';

import React, { useCallback, useEffect, useState } from 'react';
import styles from './SnippetsBrowser.module.css';

interface Snippet {
  id: string;
  title: string;
  sourceGrant: string;
  funder: string;
  topicTags: string[];
  usageCount: number;
  content: string;
}

interface SnippetsBrowserProps {
  snippets?: Snippet[];
  onInsert?: (content: string) => void;
  grantId?: string;
}

export function SnippetsBrowser({ snippets: propSnippets, onInsert, grantId }: SnippetsBrowserProps) {
  const [search, setSearch] = useState('');
  const [snippets, setSnippets] = useState<Snippet[]>(propSnippets || []);
  const [loading, setLoading] = useState(!propSnippets);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSnippets = useCallback(async () => {
    try {
      const params = grantId ? `?grantId=${encodeURIComponent(grantId)}` : '';
      const res = await fetch(`/api/snippets${params}`);
      if (res.ok) {
        const data = (await res.json()) as { snippets: Snippet[] };
        setSnippets(data.snippets || []);
      }
    } catch (_err) {
      // silently fail, keep existing snippets
    } finally {
      setLoading(false);
    }
  }, [grantId]);

  useEffect(() => {
    if (propSnippets) {
      setSnippets(propSnippets);
      setLoading(false);
    }
  }, [propSnippets]);

  useEffect(() => {
    if (!propSnippets) {
      void loadSnippets();
    }
  }, [propSnippets, loadSnippets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent, category: newCategory || 'general', grantId: grantId || null }),
      });
      if (res.ok) {
        const data = (await res.json()) as { snippet: Snippet };
        setSnippets((prev) => [...prev, data.snippet]);
        setNewTitle('');
        setNewContent('');
        setNewCategory('');
        setShowCreateForm(false);
      }
    } catch (_err) {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/snippets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setSnippets((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (_err) {
      // silently fail
    }
  };

  const filtered = snippets.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.funder.toLowerCase().includes(search.toLowerCase()) ||
    s.topicTags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="snippets-browser" data-testid="snippets-browser">
        <div role="status" aria-busy="true" aria-label="Loading snippets">Loading snippets...</div>
      </div>
    );
  }

  return (
    <div className="snippets-browser" data-testid="snippets-browser">
      <div className={`snippets-header ${styles.searchRow}`}>
        <input
          type="text"
          placeholder="Search snippets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`form-input ${styles.searchInput}`}
          aria-label="Search snippets"
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setShowCreateForm((v) => !v)}
          aria-label="Create new snippet"
          data-testid="create-snippet-btn"
        >
          + New
        </button>
      </div>

      {showCreateForm && (
        <form className={`snippet-create-form ${styles.createForm}`} onSubmit={handleCreate} data-testid="snippet-create-form">
          <input
            type="text"
            placeholder="Snippet title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            aria-label="Snippet title"
            data-testid="snippet-create-title"
            className="form-input"
            required
          />
          <textarea
            placeholder="Snippet content"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            aria-label="Snippet content"
            data-testid="snippet-create-content"
            className="form-input"
            rows={3}
          />
          <input
            type="text"
            placeholder="Category (optional)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            aria-label="Snippet category"
            className="form-input"
          />
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving || !newTitle.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="snippets-list">
        {filtered.length === 0 && (
          <div className="empty-state">No snippets found.</div>
        )}
        {filtered.map((snippet) => (
          <div key={snippet.id} className={`snippet-card ${styles.cardBody}`} data-testid="snippet-card">
            <div className={`snippet-title ${styles.cardTitle}`}>{snippet.title}</div>
            <div className={`snippet-meta ${styles.cardMeta}`}>
              {snippet.funder} · Used {snippet.usageCount} times
            </div>
            <div className={`snippet-tags ${styles.cardTags}`}>
              {snippet.topicTags.map((tag) => (
                <span key={tag} className="tag" style={{ padding: '1px 6px', background: 'rgba(212, 169, 67, 0.06)', color: 'var(--accent)', borderRadius: '3px', fontSize: '11px' }}>{tag}</span>
              ))}
            </div>
            <div className={`snippet-actions ${styles.cardActions}`}>
              {onInsert && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onInsert(snippet.content)}
                  aria-label={`Insert ${snippet.title}`}
                >
                  Insert
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => { if (window.confirm(`Delete snippet "${snippet.title}"?`)) { void handleDelete(snippet.id); } }}
                aria-label={`Delete snippet ${snippet.title}`}
                data-testid={`delete-snippet-${snippet.id}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
