'use client';

import { useState, useEffect } from 'react';
import type { Grant } from '../../../shared/types';

interface DiscoveryViewProps {
  onGrantSelect: (grantId: string) => void;
}

type SortOption = 'fit' | 'deadline' | 'award';
type CategoryFilter = 'All' | 'EdTech' | 'Community' | 'Science & Tech' | 'Federal' | 'Foundation' | 'Corporate';

const categoryFilters: CategoryFilter[] = ['All', 'EdTech', 'Community', 'Science & Tech', 'Federal', 'Foundation', 'Corporate'];

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}`;
}

export default function DiscoveryView({ onGrantSelect }: DiscoveryViewProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('fit');
  const [category, setCategory] = useState<CategoryFilter>('All');

  useEffect(() => {
    async function load() {
      try {
        const data = await window.electronAPI.getGrants();
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

  // Filter grants
  let filtered = grants.filter((g) => {
    // Search filter
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      g.title.toLowerCase().includes(searchLower) ||
      g.funder.toLowerCase().includes(searchLower) ||
      g.tags.some((t) => t.toLowerCase().includes(searchLower));

    // Category filter
    const matchesCategory =
      category === 'All' || g.tags.some((t) => t === category || t.includes(category));

    return matchesSearch && matchesCategory;
  });

  // Sort grants
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
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search grants, funders, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="fit">Best fit</option>
          <option value="deadline">Deadline</option>
          <option value="award">Award size</option>
        </select>
        {categoryFilters.map((cat) => (
          <button
            key={cat}
            className={`filter-pill ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grants Table */}
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
          const dayClass =
            grant.daysOut < 30 ? 'urgent' : grant.daysOut < 60 ? 'soon' : '';
          return (
            <div
              key={grant.id}
              className="grants-row"
              onClick={() => onGrantSelect(grant.id)}
            >
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
            </div>
          );
        })}
      </div>
    </>
  );
}
