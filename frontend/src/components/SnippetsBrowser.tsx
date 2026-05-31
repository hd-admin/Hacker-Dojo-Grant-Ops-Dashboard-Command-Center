'use client';

import React, { useState } from 'react';

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
  snippets: Snippet[];
  onInsert?: (content: string) => void;
}

export default function SnippetsBrowser({ snippets, onInsert }: SnippetsBrowserProps) {
  const [search, setSearch] = useState('');

  const filtered = snippets.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.funder.toLowerCase().includes(search.toLowerCase()) ||
    s.topicTags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="snippets-browser" data-testid="snippets-browser">
      <input
        type="text"
        placeholder="Search snippets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="form-input"
        aria-label="Search snippets"
      />
      <div className="snippets-list">
        {filtered.map((snippet) => (
          <div key={snippet.id} className="snippet-card">
            <div className="snippet-title">{snippet.title}</div>
            <div className="snippet-meta">
              {snippet.funder} · Used {snippet.usageCount} times
            </div>
            <div className="snippet-tags">
              {snippet.topicTags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
