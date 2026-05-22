'use client';

import { useState, useEffect } from 'react';
import type { Grant, GrantStatus } from '../../../shared/types';

interface PipelineViewProps {
  onGrantSelect: (grantId: string) => void;
}

interface BoardColumn {
  key: GrantStatus | 'awarded';
  title: string;
}

const columns: BoardColumn[] = [
  { key: 'matched', title: 'Matched' },
  { key: 'draft', title: 'Drafting' },
  { key: 'review', title: 'Review' },
  { key: 'submitted', title: 'Submitted' },
  { key: 'awarded', title: 'Awarded/Closed' },
];

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}`;
}

export default function PipelineView({ onGrantSelect }: PipelineViewProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getGrantsForColumn = (status: GrantStatus | 'awarded') => {
    if (status === 'awarded') {
      return grants.filter((g) => g.status === 'awarded');
    }
    return grants.filter((g) => g.status === status);
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Pipeline <span className="accent">Grant board</span>
          </h1>
          <div className="header-sub">
            {grants.filter((g) => g.status !== 'awarded').length} active grants
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="board">
        {columns.map((col) => {
          const colGrants = getGrantsForColumn(col.key);
          return (
            <div key={col.key} className="board-col">
              <div className="board-col-header">
                <div className="board-col-title">{col.title}</div>
                <div className="board-col-count">{colGrants.length}</div>
              </div>
              <div className="board-col-body">
                {colGrants.length === 0 ? (
                  <div className="empty">none</div>
                ) : (
                  colGrants.map((grant) => (
                    <div
                      key={grant.id}
                      className="board-card"
                      onClick={() => onGrantSelect(grant.id)}
                    >
                      <div className="board-card-funder">{grant.funder}</div>
                      <div className="board-card-title">{grant.title}</div>
                      <div className="board-card-foot">
                        <span>{formatDate(grant.deadline)}</span>
                        <span className="amount">{grant.award}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
