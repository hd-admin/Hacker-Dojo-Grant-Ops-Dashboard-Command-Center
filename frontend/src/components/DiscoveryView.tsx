'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Grant, Source } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';

interface DiscoveryViewProps {
  onGrantSelect: (grantId: string) => void;
  onRefreshAppState?: () => Promise<void> | void;
}

type SortOption = 'fit' | 'deadline' | 'award' | 'recently-added';
type CategoryFilter = 'All' | 'EdTech' | 'Community' | 'Science & Tech' | 'Federal' | 'Foundation' | 'Corporate';

const WORKING_CONTEXT_KEY = 'grantops.workingContext';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
}

function readWorkingContext(): Record<string, unknown> {
  const storage = getWorkingContextStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveWorkingContextField(field: string, value: unknown): void {
  const storage = getWorkingContextStorage();
  if (!storage) return;
  const next = { ...readWorkingContext(), [field]: value };
  storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(next));
}

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}`;
}

export default function DiscoveryView({ onGrantSelect, onRefreshAppState }: DiscoveryViewProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesCrawled, setSourcesCrawled] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('fit');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [showManualIntake, setShowManualIntake] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualFunder, setManualFunder] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  useEffect(() => {
    const context = readWorkingContext();
    setSortBy((context.discoverySort as SortOption) ?? 'fit');
    setCategory((context.discoveryCategory as CategoryFilter) ?? 'All');
    setSearch((context.discoverySearch as string) ?? '');
  }, []);

  useEffect(() => { saveWorkingContextField('discoverySort', sortBy); }, [sortBy]);
  useEffect(() => { saveWorkingContextField('discoveryCategory', category); }, [category]);
  useEffect(() => { saveWorkingContextField('discoverySearch', search); }, [search]);

  useEffect(() => {
    async function load() {
      try {
        const [grantsData, sourcesData, runsData] = await Promise.all([
          client.grants.getAll(),
          client.sources.getAll(),
          client.research.getRuns(),
        ]);
        setGrants(grantsData);
        setSources(sourcesData);
        setSourcesCrawled(runsData.latestRun?.sourcesCrawled ?? 0);
      } catch (error) {
        console.error('Error loading discovery data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pendingReviewCount = sources.filter((source) => source.reviewStatus === 'pending-review').length;

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return [...grants]
      .filter((g) => !search || g.title.toLowerCase().includes(searchLower) || g.funder.toLowerCase().includes(searchLower) || g.tags.some((t) => t.toLowerCase().includes(searchLower)))
      .filter((g) => category === 'All' || g.tags.some((t) => t === category || t.includes(category)))
      .sort((a, b) => {
        switch (sortBy) {
          case 'fit': return b.fit - a.fit;
          case 'deadline': return a.deadline === 'Rolling' ? 1 : b.deadline === 'Rolling' ? -1 : a.daysOut - b.daysOut;
          case 'award': return b.awardSort - a.awardSort;
          case 'recently-added': return (b.matchedAt || '').localeCompare(a.matchedAt || '');
          default: return 0;
        }
      });
  }, [grants, search, category, sortBy]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualFunder.trim()) return;
    await fetch('/api/grants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: manualTitle, funder: manualFunder, notes: 'Manual intake' }),
    });
    setManualTitle('');
    setManualFunder('');
    setShowManualIntake(false);
    await Promise.all([client.grants.getAll().then(setGrants), onRefreshAppState?.()]);
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    setIsAddingSource(true);
    try {
      await client.sources.add({ name: newSourceName.trim(), url: newSourceUrl.trim(), type: 'website' });
      await client.research.trigger();
      setNewSourceName('');
      setNewSourceUrl('');
      setShowAddSourceForm(false);
      await Promise.all([client.grants.getAll().then(setGrants), client.sources.getAll().then(setSources), onRefreshAppState?.()]);
    } catch (error) {
      console.error('Error adding source:', error);
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleExportCsv = () => {
    const rows = ['title,funder,award,deadline,fit', ...filtered.map((grant) => [grant.title, grant.funder, grant.award, grant.deadline, String(grant.fit)].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grant-ops-discovery.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="header-title">Loading...</div>;
  }

  const handleDeleteSource = async (sourceId: string) => {
    await client.sources.remove(sourceId);
    await Promise.all([client.sources.getAll().then(setSources), onRefreshAppState?.()]);
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Discovery <span className="accent">Find grants</span>
          </h1>
          <div className="header-sub">{filtered.length} grants · crawled {sourcesCrawled} sources</div>
        </div>
        <div className="header-actions">
          <button type="button" data-testid="add-manually-btn" onClick={() => setShowManualIntake((value) => !value)}>
            + Add manually
          </button>
          <button type="button" onClick={() => { void handleExportCsv(); }}>
            Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddSourceForm((value) => !value)}>
            + Add source
          </button>
        </div>
      </div>

      {pendingReviewCount > 0 && (
        <div>
          <button type="button" onClick={() => window.dispatchEvent(new Event('grantops:navigate-sources'))}>
            {pendingReviewCount} sources awaiting review
          </button>
        </div>
      )}

      {showManualIntake && (
        <form onSubmit={handleManualSubmit} className="manual-intake-form">
          <input data-testid="manual-title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Title" />
          <input data-testid="manual-funder" value={manualFunder} onChange={(e) => setManualFunder(e.target.value)} placeholder="Funder" />
          <button type="submit" data-testid="manual-submit-btn">Save grant</button>
        </form>
      )}

      {showAddSourceForm && (
        <form onSubmit={handleAddSource} className="add-source-inline">
          <input type="text" placeholder="Source name" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} disabled={isAddingSource} />
          <input type="url" placeholder="https://..." value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} disabled={isAddingSource} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={isAddingSource || !newSourceName.trim() || !newSourceUrl.trim()}>
            {isAddingSource ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}

      <div className="filter-bar">
        <input type="text" placeholder="Search grants, funders, tags..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
          <option value="fit">Best fit</option>
          <option value="deadline">Deadline</option>
          <option value="award">Award size</option>
          <option value="recently-added">Recently added</option>
        </select>
        {['All', 'EdTech', 'Community', 'Science & Tech', 'Federal', 'Foundation', 'Corporate'].map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-pill ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat as CategoryFilter)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grants-table">
        <div className="grants-row header">
          <div>Grant</div>
          <div>Funder</div>
          <div>Award</div>
          <div>Deadline</div>
          <div>Fit</div>
        </div>
        {filtered.map((grant) => (
          <button key={grant.id} type="button" className="grants-row" onClick={() => onGrantSelect(grant.id)}>
            <div>
              {grant.title}
              {grant.humanOverrides?.some((override) => override.field === 'fit' || override.field === 'category') && (
                <span data-testid="human-confirmed-chip" className="ai-badge">Human-confirmed</span>
              )}
            </div>
            <div className="grant-funder">{grant.funderShort}</div>
            <div className="award">{grant.award}</div>
            <div className="days">{formatDate(grant.deadline)}</div>
            <div className="fit-num">{grant.fit}</div>
          </button>
        ))}
      </div>

      <div className="sources-panel">
        <div className="sources-panel-header">Sources ({sources.length})</div>
        {sources.map((source) => (
          <div key={source.id} className="source-item">
            <div className="source-info">
              <div className="source-name">{source.name}</div>
              <div className="source-url">{source.url}</div>
              {source.reviewStatus === 'pending-review' && <div data-testid="sources-pending-review-section">pending review</div>}
            </div>
            <button type="button" onClick={() => void handleDeleteSource(source.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
