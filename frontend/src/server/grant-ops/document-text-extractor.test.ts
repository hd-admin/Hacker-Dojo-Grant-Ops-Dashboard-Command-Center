import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeStoredDocument, EXACT_GROUNDING_SNIPPET, extractDocumentText, normalizeWhitespace } from './document-text-extractor';

const fixturePath = path.join(
  process.cwd(),
  'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);

describe('document-text-extractor', () => {
  it('normalizes whitespace deterministically', () => {
    expect(normalizeWhitespace('  Hacker   Dojo\n\n expands   access  ')).toBe('Hacker Dojo expands access');
  });

  it('extracts the fixture pdf and preserves the grounding sentence', async () => {
    const result = await extractDocumentText(fixturePath);

    expect(result.extractionStatus).toBe('extracted');
    expect(result.extractedText).toContain('Hacker Dojo Grant Program Summary');
    expect(result.extractedText).toContain(EXACT_GROUNDING_SNIPPET);
    expect(result.contentSnippet).toBe(EXACT_GROUNDING_SNIPPET);
  });

  it('marks accepted non-pdf content as stored but not grounded', async () => {
    const tempPath = path.join(process.cwd(), 'tests/fixtures/documents/temp-note.docx');
    await fs.writeFile(tempPath, Buffer.from([1, 2, 3]));

    try {
      const result = await analyzeStoredDocument(tempPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result.extractionStatus).toBe('stored_unparsed');
      expect(result.extractedText).toBeUndefined();
      expect(result.contentSnippet).toBeUndefined();
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  });
});
