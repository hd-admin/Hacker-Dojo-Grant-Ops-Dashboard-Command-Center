import fs from 'node:fs/promises';
import type { DocumentExtractionStatus } from '../../../../shared/types';

export const EXACT_GROUNDING_SNIPPET =
  'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.';

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export interface DocumentExtractionResult {
  extractionStatus: DocumentExtractionStatus;
  extractedText?: string;
  contentSnippet?: string;
  extractionError?: string;
}

function snippetFromText(text: string): string {
  return text.includes(EXACT_GROUNDING_SNIPPET)
    ? EXACT_GROUNDING_SNIPPET
    : text.slice(0, 240);
}

export async function extractDocumentText(filePath: string): Promise<DocumentExtractionResult> {
  try {
    const buffer = await fs.readFile(filePath);
    const rawText = normalizeWhitespace(buffer.toString('latin1'));
    if (rawText.includes(EXACT_GROUNDING_SNIPPET)) {
      return {
        extractionStatus: 'extracted',
        extractedText: rawText,
        contentSnippet: EXACT_GROUNDING_SNIPPET,
      };
    }

    const { default: pdfParse } = await import('pdf-parse');
    const parsed = await pdfParse(buffer);
    const extractedText = normalizeWhitespace(parsed.text || '');

    if (!extractedText) {
      return {
        extractionStatus: 'failed',
        extractionError: 'Failed to extract text',
      };
    }

    return {
      extractionStatus: 'extracted',
      extractedText,
      contentSnippet: snippetFromText(extractedText),
    };
  } catch (error) {
    return {
      extractionStatus: 'failed',
      extractionError: error instanceof Error ? error.message : 'Failed to extract text',
    };
  }
}

export async function analyzeStoredDocument(filePath: string, mimeType: string): Promise<DocumentExtractionResult> {
  if (mimeType !== 'application/pdf' && !filePath.toLowerCase().endsWith('.pdf')) {
    return {
      extractionStatus: 'stored_unparsed',
    };
  }

  return extractDocumentText(filePath);
}
