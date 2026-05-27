'use client';

import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { Source, SourceCategory, SourceDiscoverySuggestion } from '../../../shared/types';

interface SourcesViewProps {
  onRefreshAppState?: () => Promise<void> | void;
}

const sourceCategories: SourceCategory[] = ['foundation', 'government', 'corporate', 'community', 'other'];

function categoryLabel(category?: SourceCategory): string {
  if (!category) return 'Uncategorized';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function SourcesView({ onRefreshAppState }: SourcesViewProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [pendingSources, setPendingSources] = useState<Source[]>([]);
  const [showDiscoverForm, setShowDiscoverForm] = useState(false);
  const [discoverPrompt, setDiscoverPrompt] = useState('');
  const [discoverSuggestions, setDiscoverSuggestions] = useState<SourceDiscoverySuggestion[]>([]);
  const [discoverUnavailable, setDiscoverUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Source>>({});

  const pendingCount = pendingSources.length;

  const loadSources = useCallback(async (): Promise<void> => {
    const [allResponse, pendingResponse] = await Promise.all([
      fetch('/api/sources'),
      fetch('/api/sources?filter=pending-review'),
    ]);
    const [all, pending] = await Promise.all([allResponse.json(), pendingResponse.json()]);
    setSources(Array.isArray(all) ? all : []);
    setPendingSources(Array.isArray(pending) ? pending : []);
  }, []);

  useEffect(() => {
    void loadSources().catch((error) => {
      console.error('Error loading sources:', error);
    });
  }, [loadSources]);

  const handleDiscover = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setDiscoverUnavailable(false);
    try {
      const response = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: discoverPrompt }),
      });
      const data = await response.json();
      setDiscoverSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setDiscoverUnavailable(Boolean(data.unavailable));
    } catch (error) {
      console.error('Error discovering sources:', error);
      setDiscoverSuggestions([]);
      setDiscoverUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const approveDiscoverySuggestion = async (suggestion: SourceDiscoverySuggestion) => {
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: suggestion.name,
        url: suggestion.url,
        type: suggestion.type,
        reviewStatus: 'pending-review',
        suggestedBy: 'ai',
        suggestionReason: suggestion.rationale,
      }),
    });
    setDiscoverSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    await loadSources();
    await onRefreshAppState?.();
  };

  const approveSource = async (sourceId: string) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const rejectSource = async (sourceId: string) => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (!reason.trim()) return;
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const categorizeSource = async (sourceId: string, category: SourceCategory) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'categorize', category }),
    });
    await loadSources();
    await onRefreshAppState?.();
  };

  const startEdit = (source: Source) => {
    setEditingSourceId(source.id);
    setEditForm(source);
  };

  const saveEdit = async (sourceId: string) => {
    await fetch(`/api/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingSourceId(null);
    setEditForm({});
    await loadSources();
    await onRefreshAppState?.();
  };

  const pendingSourcesPanel = (
    <section className="sources-section" data-testid="sources-pending-review-section">
      <h2>Pending review</h2>
      {pendingSources.length === 0 ? (
        <div>No sources pending review</div>
      ) : (
        pendingSources.map((source) => (
          <div key={source.id} className="source-row">
            <div>
              <strong>{source.name}</strong>
              <div>{source.url}</div>
              {source.suggestionReason && <div className="source-note">{source.suggestionReason}</div>}
              {source.category && <div className="source-note">Category: {categoryLabel(source.category)}</div>}
            </div>
            <div className="source-actions">
              <button type="button" data-testid={`approve-source-btn-${source.id}`} onClick={() => void approveSource(source.id)}>
                Approve
              </button>
              <button type="button" onClick={() => void rejectSource(source.id)}>Reject</button>
              <div>
                <button type="button" data-testid={`categorize-source-btn-${source.id}`}>Categorize</button>
                {sourceCategories.map((category) => (
                  <button key={category} type="button" onClick={() => void categorizeSource(source.id, category)}>
                    {categoryLabel(category)}
                  </button>
                ))}
              </div>
              <button type="button" data-testid={`edit-source-btn-${source.id}`} onClick={() => startEdit(source)}>
                Edit
              </button>
            </div>
            {editingSourceId === source.id && (
              <div className="edit-panel">
                <input value={editForm.name ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                <input value={editForm.url ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))} />
                <select value={editForm.category ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value as SourceCategory }))}>
                  <option value="">Uncategorized</option>
                  {sourceCategories.map((category) => (
                    <option key={category} value={category}>{categoryLabel(category)}</option>
                  ))}
                </select>
                <input value={editForm.categoryRationale ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, categoryRationale: e.target.value }))} placeholder="Category rationale" />
                <button type="button" onClick={() => void saveEdit(source.id)}>Save</button>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Sources <span className="accent">Review queue</span>
          </h1>
          <div className="header-sub">{pendingCount} sources awaiting review</div>
        </div>
        <div className="header-actions">
          <button type="button" data-testid="discover-sources-btn" onClick={() => setShowDiscoverForm((value) => !value)}>
            Discover Sources
          </button>
        </div>
      </div>

      {showDiscoverForm && (
        <form onSubmit={handleDiscover}>
          <textarea
            data-testid="discovery-prompt-input"
            value={discoverPrompt}
            onChange={(e) => setDiscoverPrompt(e.target.value)}
            placeholder="Describe the grants you are looking for"
          />
          <button type="submit" data-testid="find-sources-submit-btn" disabled={loading}>
            {loading ? 'Finding...' : 'Find Sources'}
          </button>
        </form>
      )}

      {discoverUnavailable && (
        <div data-testid="discovery-unavailable-msg">Source discovery requires opencode. Configure it in Settings.</div>
      )}

      {discoverSuggestions.length > 0 && (
        <section>
          <h2>Suggestions</h2>
          {discoverSuggestions.map((suggestion) => (
            <div key={suggestion.id} data-testid="discovery-suggestion-item">
              <strong>{suggestion.name}</strong>
              <div>{suggestion.url}</div>
              <div>{suggestion.rationale}</div>
              <div>Confidence: {Math.round(suggestion.confidence * 100)}%</div>
              <button type="button" data-testid="approve-suggestion-btn" onClick={() => void approveDiscoverySuggestion(suggestion)}>
                Approve
              </button>
              <button type="button" onClick={() => setDiscoverSuggestions((current) => current.filter((item) => item.id !== suggestion.id))}>
                Dismiss
              </button>
            </div>
          ))}
        </section>
      )}

      {pendingSourcesPanel}

      <section>
        <h2>All sources</h2>
        {sources.map((source) => (
          <div key={source.id} className="source-row">
            <div>
              <strong>{source.name}</strong> <span>{source.reviewStatus ?? 'approved'}</span>
              <div>{source.url}</div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
