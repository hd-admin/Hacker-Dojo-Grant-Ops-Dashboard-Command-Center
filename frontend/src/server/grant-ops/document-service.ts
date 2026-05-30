/**
 * Document Service
 *
 * Manages file storage, text extraction/indexing, and document search.
 * Follows DI pattern via getDependencies().
 *
 * The indexing system maintains an in-memory search index for fast full-text
 * search across uploaded documents. Index is rebuilt on service initialization.
 */

import type { DocumentMetadata } from '../../../../shared/types';
import { getDependencies } from './dependencies';
import { saveDocuments } from '../../../../shared/grant-ops-persistence';

/**
 * In-memory search index.
 * Maps lowercase tokens to document IDs for fast full-text search.
 */
const searchIndex = new Map<string, Set<string>>();

/**
 * Simple tokenizer that splits text into lowercase words,
 * filtering out noise tokens and very short words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

/**
 * Build index entries for a document.
 */
function indexDocumentText(docId: string, text: string): void {
  const tokens = tokenize(text);
  for (const token of tokens) {
    const existing = searchIndex.get(token);
    if (existing) {
      existing.add(docId);
    } else {
      searchIndex.set(token, new Set([docId]));
    }
  }
}

/**
 * Remove a document's entries from the index.
 */
function removeFromIndex(docId: string): void {
  for (const [, docIds] of searchIndex) {
    docIds.delete(docId);
  }
  // Clean up empty sets
  for (const [token, docIds] of searchIndex) {
    if (docIds.size === 0) {
      searchIndex.delete(token);
    }
  }
}

// --- Public API ---

/**
 * List all documents, optionally excluding restricted documents.
 */
export async function listDocuments(excludeRestricted = false): Promise<DocumentMetadata[]> {
  const deps = getDependencies();
  const docs = await deps.repository.getDocuments();
  if (excludeRestricted) {
    return docs.filter((d) => d.classification !== 'restricted');
  }
  return docs;
}

/**
 * Get documents available for AI drafting context (excludes restricted).
 */
export async function getDocumentsForDrafting(): Promise<DocumentMetadata[]> {
  return listDocuments(true);
}

/**
 * Get documents available for export (excludes restricted).
 */
export async function getDocumentsForExport(): Promise<DocumentMetadata[]> {
  return listDocuments(true);
}

/**
 * Get documents available for submission packages (excludes restricted unless explicitly included).
 */
export async function getDocumentsForSubmission(includeRestrictedIds?: string[]): Promise<DocumentMetadata[]> {
  const deps = getDependencies();
  const docs = await deps.repository.getDocuments();
  if (!includeRestrictedIds || includeRestrictedIds.length === 0) {
    return docs.filter((d) => d.classification !== 'restricted');
  }
  return docs.filter((d) => d.classification !== 'restricted' || includeRestrictedIds.includes(d.id));
}

/**
 * Get a single document by ID.
 */
export async function getDocument(
  id: string,
): Promise<DocumentMetadata | null> {
  const deps = getDependencies();
  const docs = await deps.repository.getDocuments();
  return docs.find((d) => d.id === id) ?? null;
}

/**
 * Index a document's extracted text for search.
 * Returns indexing result with status.
 */
export async function indexDocument(
  doc: DocumentMetadata,
): Promise<{
  indexed: boolean;
  indexedText?: string;
  error?: string;
}> {
  if (doc.extractionStatus === 'failed') {
    return {
      indexed: false,
      error: doc.extractionError ?? 'Extraction failed',
    };
  }

  if (
    doc.extractionStatus === 'stored_unparsed' ||
    !doc.extractedText
  ) {
    return {
      indexed: false,
      error: 'No extracted text available for indexing',
    };
  }

  // Remove old index entries first
  removeFromIndex(doc.id);

  // Index the document text
  indexDocumentText(doc.id, doc.extractedText);

  // Also index the document name for name-based search
  indexDocumentText(doc.id, doc.name);

  return {
    indexed: true,
    indexedText: doc.extractedText.slice(0, 500) + (doc.extractedText.length > 500 ? '...' : ''),
  };
}

/**
 * Search indexed documents by text query.
 * Returns matching document metadata ordered by relevance.
 */
export async function searchDocuments(
  query: string,
): Promise<DocumentMetadata[]> {
  const deps = getDependencies();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  // Find document IDs matching any query token
  const matchingDocIds = new Set<string>();
  for (const token of queryTokens) {
    // Partial matching: check all indexed tokens for substring matches
    for (const [indexedToken, docIds] of searchIndex) {
      if (indexedToken.includes(token) || token.includes(indexedToken)) {
        for (const docId of docIds) {
          matchingDocIds.add(docId);
        }
      }
    }
  }

  if (matchingDocIds.size === 0) {
    return [];
  }

  // Score documents by match count
  const docScores = new Map<string, number>();
  for (const token of queryTokens) {
    const docs = searchIndex.get(token);
    if (docs) {
      for (const docId of docs) {
        docScores.set(docId, (docScores.get(docId) ?? 0) + 1);
      }
    }
    // Also check partial matches for scoring
    for (const [indexedToken, docIds] of searchIndex) {
      if (indexedToken !== token && (indexedToken.includes(token) || token.includes(indexedToken))) {
        for (const docId of docIds) {
          docScores.set(docId, (docScores.get(docId) ?? 0) + 0.5);
        }
      }
    }
  }

  // Get all documents and sort by score
  const allDocs = await deps.repository.getDocuments();
  const matchingDocs = allDocs.filter((d) => matchingDocIds.has(d.id));

  // Sort by relevance score (descending)
  matchingDocs.sort((a, b) => {
    const scoreA = docScores.get(a.id) ?? 0;
    const scoreB = docScores.get(b.id) ?? 0;
    return scoreB - scoreA;
  });

  return matchingDocs;
}

/**
 * Delete a document and remove its index entries.
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const deps = getDependencies();
  const docs = await deps.repository.getDocuments();
  const filtered = docs.filter((d) => d.id !== id);

  if (filtered.length === docs.length) {
    return false; // Document not found
  }

  // Remove from search index
  removeFromIndex(id);

  // Save updated document list
  await saveDocuments(filtered);

  return true;
}

/**
 * Get the storage path for a document.
 */
export function getStoragePath(doc: DocumentMetadata): string | null {
  return doc.storagePath ?? null;
}

/**
 * Get document version with default fallback.
 */
export function getDocumentVersion(doc: DocumentMetadata): string {
  return doc.version ?? '1.0';
}

/**
 * Clear the in-memory search index.
 * Exposed for test isolation.
 */
export function clearSearchIndex(): void {
  searchIndex.clear();
}

/**
 * Rebuild the entire search index from all stored documents.
 * Useful after service restart or data migration.
 */
export async function rebuildIndex(): Promise<{
  totalDocuments: number;
  indexedCount: number;
}> {
  // Clear existing index
  searchIndex.clear();

  const deps = getDependencies();
  const docs = await deps.repository.getDocuments();
  let indexedCount = 0;

  for (const doc of docs) {
    if (doc.extractedText && doc.extractionStatus === 'extracted') {
      indexDocumentText(doc.id, doc.extractedText);
      indexDocumentText(doc.id, doc.name);
      indexedCount++;
    }
  }

  return {
    totalDocuments: docs.length,
    indexedCount,
  };
}
