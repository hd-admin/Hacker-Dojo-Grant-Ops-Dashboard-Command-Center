/**
 * Document Service Tests
 *
 * Tests file storage management, text extraction/indexing,
 * document search, and document lifecycle operations.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type { DocumentMetadata } from '../../../../shared/types';
import * as repository from './repository';
import * as documentService from './document-service';

function makeDoc(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: 'test-document.pdf',
    type: 'PDF',
    lastUsed: new Date().toISOString(),
    audited: true,
    uploadedAt: new Date().toISOString(),
    mimeType: 'application/pdf',
    extractionStatus: 'extracted',
    extractedText: 'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    ...overrides,
  };
}

describe('DocumentService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    documentService.clearSearchIndex();
  });

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    invalidateCache();
    documentService.clearSearchIndex();
  });

  describe('listDocuments', () => {
    it('returns empty array when no documents exist', async () => {
      const docs = await documentService.listDocuments();
      expect(docs).toEqual([]);
    });

    it('returns all persisted documents', async () => {
      const doc = makeDoc();
      await repository.addDocument(doc);

      const docs = await documentService.listDocuments();
      expect(docs).toHaveLength(1);
      expect(docs[0]?.id).toBe(doc.id);
    });
  });

  describe('getDocument', () => {
    it('returns null for non-existent document', async () => {
      const doc = await documentService.getDocument('non-existent');
      expect(doc).toBeNull();
    });

    it('returns document by id', async () => {
      const doc = makeDoc();
      await repository.addDocument(doc);

      const result = await documentService.getDocument(doc.id);
      expect(result).toBeDefined();
      expect(result?.name).toBe('test-document.pdf');
    });
  });

  describe('indexDocument', () => {
    it('indexes document with extracted text', async () => {
      const doc = makeDoc({
        extractedText: 'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
        extractionStatus: 'extracted',
      });

      const result = await documentService.indexDocument(doc);
      expect(result.indexed).toBe(true);
      expect(result.indexedText).toBeDefined();
      expect(result.indexedText).toContain('Hacker Dojo');
    });

    it('marks document as not indexed when no text is available', async () => {
      const baseDoc = makeDoc({ extractionStatus: 'stored_unparsed' });
       
      const { extractedText: _text, ...docFields } = baseDoc;
      const doc = docFields as DocumentMetadata;

      const result = await documentService.indexDocument(doc);
      expect(result.indexed).toBe(false);
    });

    it('reports failed extraction status', async () => {
      const doc = makeDoc({
        extractionStatus: 'failed',
        extractionError: 'Could not parse file',
      });

      const result = await documentService.indexDocument(doc);
      expect(result.indexed).toBe(false);
    });
  });

  describe('searchDocuments', () => {
    it('returns empty results when no documents are indexed', async () => {
      const results = await documentService.searchDocuments('education');
      expect(results).toEqual([]);
    });

    it('finds documents by text content', async () => {
      const doc = makeDoc({
        id: 'searchable-doc',
        extractedText: 'This document is about STEM education and workforce development programs.',
        extractionStatus: 'extracted',
      });
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const results = await documentService.searchDocuments('STEM education');
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('searchable-doc');
    });

    it('finds documents by name', async () => {
      const doc = makeDoc({
        id: 'named-doc',
        name: 'NSF Grant Proposal 2026.pdf',
        extractedText: 'Some content about other things.',
        extractionStatus: 'extracted',
      });
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const results = await documentService.searchDocuments('NSF Proposal');
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('named-doc');
    });

    it('returns empty results for no matches', async () => {
      const doc = makeDoc({
        id: 'unrelated-doc',
        extractedText: 'This document is about gardening tips and plant care.',
        extractionStatus: 'extracted',
      });
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const results = await documentService.searchDocuments('quantum physics');
      expect(results).toEqual([]);
    });

    it('case insensitive search', async () => {
      const doc = makeDoc({
        id: 'case-doc',
        extractedText: 'HACKER DOJO TECHNOLOGY EDUCATION',
        extractionStatus: 'extracted',
      });
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const results = await documentService.searchDocuments('hacker dojo');
      expect(results).toHaveLength(1);
    });

    it('partial word matching', async () => {
      const doc = makeDoc({
        id: 'partial-doc',
        extractedText: 'Technology education programs for the community.',
        extractionStatus: 'extracted',
      });
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const results = await documentService.searchDocuments('tech');
      expect(results).toHaveLength(1);
    });
  });

  describe('deleteDocument', () => {
    it('removes document from storage', async () => {
      const doc = makeDoc();
      await repository.addDocument(doc);
      await documentService.indexDocument(doc);

      const result = await documentService.deleteDocument(doc.id);
      expect(result).toBe(true);

      const remaining = await repository.getDocuments();
      expect(remaining).toHaveLength(0);
    });

    it('returns false for non-existent document', async () => {
      const result = await documentService.deleteDocument('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getStoragePath', () => {
    it('returns storage path for document', async () => {
      const doc = makeDoc({ storagePath: '/tmp/test.pdf' });
      const sp = documentService.getStoragePath(doc);
      expect(sp).toBe('/tmp/test.pdf');
    });

    it('returns null for document without storage path', async () => {
       
      const { storagePath: _sp, ...docFields } = makeDoc();
      const doc = docFields as DocumentMetadata;
      const sp = documentService.getStoragePath(doc);
      expect(sp).toBeNull();
    });
  });

  describe('getDocumentVersion', () => {
    it('returns version string', async () => {
      const doc = makeDoc({ version: 'v2.1' });
      const v = documentService.getDocumentVersion(doc);
      expect(v).toBe('v2.1');
    });

    it('returns default version when not set', async () => {
       
      const { version: _v, ...docFields } = makeDoc();
      const doc = docFields as DocumentMetadata;
      const v = documentService.getDocumentVersion(doc);
      expect(v).toBe('1.0');
    });
  });
});
