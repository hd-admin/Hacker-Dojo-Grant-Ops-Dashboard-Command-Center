'use client';

import { useState, useEffect } from 'react';
import type { Grant } from '../../../shared/types';
import { seedGrants } from '../../../shared/seed-data';
import { client } from '../lib/grant-ops-client';

interface DiscoveryViewProps {
  onGrantSelect: (grantId: string) => void;
  onRefreshAppState?: () => Promise<void> | void;
}

type SortOption = 'fit' | 'deadline' | 'award' | 'recently-added';
type CategoryFilter =
  | 'All'
  | 'EdTech'
  | 'Community'
  | 'Science & Tech'
  | 'Federal'
  | 'Foundation'
  | 'Corporate';

const categoryFilters: CategoryFilter[] = [
  'All',
  'EdTech',
  'Community',
  'Science & Tech',
  'Federal',
  'Foundation',
  'Corporate',
];

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}`;
}

export default function DiscoveryView({ onGrantSelect, onRefreshAppState }: DiscoveryViewProps) {
  const [grants, setGrants] = useState<Grant[]>(seedGrants);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('fit');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await client.grants.getAll();
        setGrants(data);
      } catch (error) {
        console.error('Error loading grants:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="header-title">Loading...</div>;
  }

  const handleExportCsv = () => {
    const headers = ['Title', 'Funder', 'Award', 'Deadline', 'Fit', 'Status'];
    const rows = filtered.map((g) => [
      `"${g.title}"`,
      `"${g.funder}"`,
      g.award,
      g.deadline,
      g.fit.toString(),
      g.statusLabel,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `grants-export-${new Date().toISOString().split('T')[0]}.csv`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddSource = () => {
    setShowAddSourceForm(true);
  };

  const handleSubmitSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    setIsAddingSource(true);
    try {
      await client.sources.add({
        name: newSourceName.trim(),
        url: newSourceUrl.trim(),
        type: 'website',
      });
      await client.research.trigger();
      await onRefreshAppState?.();
      const data = await client.grants.getAll();
      setGrants(data);
      setNewSourceName('');
      setNewSourceUrl('');
      setShowAddSourceForm(false);
    } catch (error) {
      console.error('Error adding source:', error);
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleCancelSource = () => {
    setNewSourceName('');
    setNewSourceUrl('');
    setShowAddSourceForm(false);
  };

  let filtered = grants.filter((g) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      g.title.toLowerCase().includes(searchLower) ||
      g.funder.toLowerCase().includes(searchLower) ||
      g.tags.some((t) => t.toLowerCase().includes(searchLower));

    const matchesCategory =
      category === 'All' || g.tags.some((t) => t === category || t.includes(category));

    return matchesSearch && matchesCategory;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'fit':
        return b.fit - a.fit;
      case 'deadline':
        if (a.deadline === 'Rolling') return 1;
        if (b.deadline === 'Rolling') return -1;
        return a.daysOut - b.daysOut;
      case 'award':
        return b.awardSort - a.awardSort;
      case 'recently-added':
        return (b.matchedAt || '').localeCompare(a.matchedAt || '');
      default:
        return 0;
    }
  });

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Discovery <span className="accent">Find grants</span>
          </h1>
          <div className="header-sub">{filtered.length} grants</div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleExportCsv}>
            Export CSV
          </button>
          {showAddSourceForm ? (
            <span className="add-source-form">
              <form onSubmit={handleSubmitSource} className="add-source-inline">
                <input
                  type="text"
                  placeholder="Source name"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  disabled={isAddingSource}
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  disabled={isAddingSource}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isAddingSource || !newSourceName.trim() || !newSourceUrl.trim()}
                >
                  {isAddingSource ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelSource}
                  disabled={isAddingSource}
                >
                  Cancel
                </button>
              </form>
            </span>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleAddSource}>
              + Add source
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search grants, funders, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
          <option value="fit">Best fit</option>
          <option value="deadline">Deadline</option>
          <option value="award">Award size</option>
          <option value="recently-added">Recently added</option>
        </select>
        {categoryFilters.map((cat) => {
          const count =
            cat === 'All'
              ? grants.length
              : grants.filter((g) => g.tags.some((t) => t === cat || t.includes(cat))).length;
          return (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      <div className="grants-table">
        <div className="grants-row header">
          <div>Grant</div>
          <div>Funder</div>
          <div>Award</div>
          <div>Deadline</div>
          <div>Fit</div>
        </div>
        {filtered.map((grant) => {
          const fitClass = grant.fit >= 85 ? 'high' : grant.fit >= 70 ? 'med' : 'low';
          const dayClass = grant.daysOut < 30 ? 'urgent' : grant.daysOut < 60 ? 'soon' : '';
          return (
            <button type="button" key={grant.id} className="grants-row" onClick={() => onGrantSelect(grant.id)}>
              <div>
                <div className="grant-title">{grant.title}</div>
                <div className="grant-tags">
                  {grant.tags.map((tag) => (
                    <span key={tag} className="grant-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grant-funder">{grant.funderShort}</div>
              <div className="award">{grant.award}</div>
              <div className="deadline-cell">
                {formatDate(grant.deadline)}
                <div className={`days ${dayClass}`}>
                  {grant.deadline === 'Rolling' ? 'rolling' : `${grant.daysOut}d out`}
                </div>
              </div>
              <div className="fit-score">
                <div className="fit-bar">
                  <div className={`fit-fill ${fitClass}`} style={{ width: `${grant.fit}%` }} />
                </div>
                <div className="fit-num">{grant.fit}</div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
