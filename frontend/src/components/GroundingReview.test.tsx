// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { act } from 'react';
import type { DraftArtifact } from '../../../shared/types';
import GroundingReview from './GroundingReview';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe('GroundingReview', () => {
  it('renders without error with empty groundingSections', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    expect(container.textContent).toBeTruthy();
  });

  it('renders strongly grounded section with Well-grounded label', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [{ sectionTitle: 'Mission', evidence: ['Document: Impact Report', 'Source: NSF', 'Federal grants database'], isGrounded: true }],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    expect(container.textContent).toContain('Well-grounded');
  });

  it('renders weakly grounded section with Weak grounding label', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [{ sectionTitle: 'Mission', evidence: ['Document: Impact Report'], isGrounded: true }],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    expect(container.textContent).toContain('Weak grounding');
  });

  it('renders ungrounded section with Unsupported label', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [{ sectionTitle: 'Budget', evidence: [], isGrounded: false }],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    expect(container.textContent).toContain('Unsupported');
  });

  it('blocks approval when any section is unsupported', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [
        { sectionTitle: 'Mission', evidence: ['Doc 1', 'Doc 2', 'Doc 3'], isGrounded: true },
        { sectionTitle: 'Budget', evidence: [], isGrounded: false },
      ],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    expect(container.textContent).toContain('Approval blocked');
  });

  it('displays all evidence items for a section', async () => {
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [{ sectionTitle: 'Programs', evidence: ['Document: Budget', 'Federal grants database'], isGrounded: true }],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} />);
    });
    // Expand evidence section
    const expandBtn = container.querySelector('.grounding-expand-toggle') as HTMLButtonElement | null;
    if (expandBtn) {
      await act(async () => {
        expandBtn.click();
      });
    }
    expect(container.textContent).toContain('Document: Budget');
    expect(container.textContent).toContain('Federal grants database');
  });

  it('accepts onReviewComplete callback without error', async () => {
    const onReviewComplete = vi.fn();
    const draft: DraftArtifact = {
      id: 'd1',
      grantId: 'g1',
      version: 1,
      content: 'test content',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
      groundingSections: [{ sectionTitle: 'Mission', evidence: [], isGrounded: true }],
    };
    await act(async () => {
      createRoot(container).render(<GroundingReview draftArtifact={draft} onReviewComplete={onReviewComplete} />);
    });
    expect(container.textContent).toBeTruthy();
  });
});
