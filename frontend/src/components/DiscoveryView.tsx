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
  const [manualAward, setManualAward] = useState('');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualTags, setManualTags] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualEligibility, setManualEligibility] = useState('');
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
      body: JSON.stringify({
        title: manualTitle.trim(),
        funder: manualFunder.trim(),
        award: manualAward.trim() || undefined,
        deadline: manualDeadline || undefined,
        tags: manualTags ? manualTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        notes: manualNotes.trim() || undefined,
        eligibility: manualEligibility.trim() || undefined,
      }),
    });
    setManualTitle('');
    setManualFunder('');
    setManualAward('');
    setManualDeadline('');
    setManualTags('');
    setManualNotes('');
    setManualEligibility('');
    setShowManualIntake(false);
    await Promise.all([client.grants.getAll().then(setGrants), onRefreshAppState?.()]);
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    setIsAddingSource(true);
    try {
      await client.sources.add({ name: newSourceName.trim(), url: newSourceUrl.trim(), type: 'website', reviewStatus: 'pending-review' });
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
    return <div className="header-title" role="status" aria-busy="true" aria-label="Loading grants">Loading...</div>;
  }

  // Empty state: no grants discovered
  if (grants.length === 0 && !loading) {
    return (
      <>
        <div className="header">
          <div>
            <h1 className="header-title">
              Discovery <span className="accent">Find grants</span>
            </h1>
            <div className="header-sub">0 grants · crawled {sourcesCrawled} sources</div>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowAddSourceForm((value) => !value)}>
              + Add source
            </button>
          </div>
        </div>
        <div className="empty-state-guide" data-testid="discovery-empty-state">
          <div className="empty-state-icon" aria-hidden="true">{String.fromCodePoint(0x1F50D)}</div>
          <div className="empty-state-title">No grants discovered yet</div>
          <div className="empty-state-description">
            Add funding sources to start discovering grants. You can add websites, databases,
            or manually enter grant opportunities. The AI will automatically crawl and match.
          </div>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowAddSourceForm(true)} aria-label="Add a funding source">
              Add a source
            </button>
            <button type="button" data-testid="add-manually-btn" className="btn" onClick={() => setShowManualIntake(true)} aria-label="Add grant manually">
              Add grant manually
            </button>
          </div>
        </div>
        {showManualIntake && (
          <form onSubmit={handleManualSubmit} className="manual-intake-form" data-testid="manual-intake-form">
            <label htmlFor="manual-title">Grant Title (required)</label>
            <input id="manual-title" data-testid="manual-title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="e.g., NSF STEM Education Grant" required />
            <label htmlFor="manual-funder">Funder (required)</label>
            <input id="manual-funder" data-testid="manual-funder" value={manualFunder} onChange={(e) => setManualFunder(e.target.value)} placeholder="e.g., National Science Foundation" required />
            <label htmlFor="manual-award">Award Amount</label>
            <input id="manual-award" data-testid="manual-award" value={manualAward} onChange={(e) => setManualAward(e.target.value)} placeholder="e.g., $50,000" />
            <label htmlFor="manual-deadline">Deadline</label>
            <input id="manual-deadline" type="date" data-testid="manual-deadline" value={manualDeadline} onChange={(e) => setManualDeadline(e.target.value)} />
            <label htmlFor="manual-tags">Tags (comma-separated)</label>
            <input id="manual-tags" data-testid="manual-tags" value={manualTags} onChange={(e) => setManualTags(e.target.value)} placeholder="e.g., STEM, Community, Education" />
            <label htmlFor="manual-eligibility">Eligibility Notes</label>
            <textarea id="manual-eligibility" data-testid="manual-eligibility" rows={3} value={manualEligibility} onChange={(e) => setManualEligibility(e.target.value)} placeholder="Describe eligibility requirements..." />
            <label htmlFor="manual-notes">Source Notes</label>
            <textarea id="manual-notes" data-testid="manual-notes" rows={2} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Where did you find this opportunity? Any additional context..." />
            <div className="manual-intake-actions">
              <button type="submit" className="btn btn-primary" data-testid="manual-submit-btn">
                Add Grant Opportunity
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowManualIntake(false); setManualTitle(''); setManualFunder(''); setManualAward(''); setManualDeadline(''); setManualTags(''); setManualNotes(''); setManualEligibility(''); }}>
                Cancel
              </button>
            </div>
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
        <div className="sources-panel">
          <div className="sources-panel-header">Sources ({sources.length})</div>
          {sources.map((source) => (
            <div key={source.id} className="source-item">
              <div className="source-info">
                <div className="source-name">{source.name}</div>
                <div className="source-url">{source.url}</div>
              </div>
              <button type="button" onClick={() => void handleDeleteSource(source.id)}>Delete</button>
            </div>
          ))}
        </div>
      </>
    );
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
        <form onSubmit={handleManualSubmit} className="manual-intake-form" data-testid="manual-intake-form">
          <label htmlFor="manual-title-main">Grant Title (required)</label>
          <input id="manual-title-main" data-testid="manual-title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="e.g., NSF STEM Education Grant" required />
          <label htmlFor="manual-funder-main">Funder (required)</label>
          <input id="manual-funder-main" data-testid="manual-funder" value={manualFunder} onChange={(e) => setManualFunder(e.target.value)} placeholder="e.g., National Science Foundation" required />
          <label htmlFor="manual-award-main">Award Amount</label>
          <input id="manual-award-main" data-testid="manual-award" value={manualAward} onChange={(e) => setManualAward(e.target.value)} placeholder="e.g., $50,000" />
          <label htmlFor="manual-deadline-main">Deadline</label>
          <input id="manual-deadline-main" type="date" data-testid="manual-deadline" value={manualDeadline} onChange={(e) => setManualDeadline(e.target.value)} />
          <label htmlFor="manual-tags-main">Tags (comma-separated)</label>
          <input id="manual-tags-main" data-testid="manual-tags" value={manualTags} onChange={(e) => setManualTags(e.target.value)} placeholder="e.g., STEM, Community, Education" />
          <label htmlFor="manual-eligibility-main">Eligibility Notes</label>
          <textarea id="manual-eligibility-main" data-testid="manual-eligibility" rows={3} value={manualEligibility} onChange={(e) => setManualEligibility(e.target.value)} placeholder="Describe eligibility requirements..." />
          <label htmlFor="manual-notes-main">Source Notes</label>
          <textarea id="manual-notes-main" data-testid="manual-notes" rows={2} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Where did you find this opportunity? Any additional context..." />
          <div className="manual-intake-actions">
            <button type="submit" className="btn btn-primary" data-testid="manual-submit-btn">
              Add Grant Opportunity
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowManualIntake(false); setManualTitle(''); setManualFunder(''); setManualAward(''); setManualDeadline(''); setManualTags(''); setManualNotes(''); setManualEligibility(''); }}>
              Cancel
            </button>
          </div>
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
