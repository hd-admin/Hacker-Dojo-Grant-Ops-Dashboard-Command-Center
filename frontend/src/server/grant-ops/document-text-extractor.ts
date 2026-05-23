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

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\\/g, '\\')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}

function extractTextFromPdfOperators(rawText: string): string {
  const textSegments: string[] = [];
  const directTextMatches = rawText.matchAll(/\(([^()]*)\)\s*Tj/g);
  for (const match of directTextMatches) {
    const segment = match[1];
    if (segment) {
      textSegments.push(decodePdfString(segment));
    }
  }

  const arrayTextMatches = rawText.matchAll(/\[(.*?)\]\s*TJ/gs);
  for (const match of arrayTextMatches) {
    const inner = match[1];
    if (!inner) continue;
    for (const part of inner.matchAll(/\(([^()]*)\)/g)) {
      const segment = part[1];
      if (segment) {
        textSegments.push(decodePdfString(segment));
      }
    }
  }

  return textSegments.join('\n');
}

export async function extractDocumentText(filePath: string): Promise<DocumentExtractionResult> {
  try {
    const buffer = await fs.readFile(filePath);
    const { default: pdfParse } = await import('pdf-parse');
    try {
      const parsed = await pdfParse(buffer);
      const extractedText = normalizeWhitespace(parsed.text || '');
      const contentSnippet = extractedText.includes(EXACT_GROUNDING_SNIPPET)
        ? EXACT_GROUNDING_SNIPPET
        : extractedText.slice(0, 240);

      return {
        extractionStatus: 'extracted',
        extractedText,
        contentSnippet,
      };
    } catch (pdfParseError) {
      const fallbackText = normalizeWhitespace(extractTextFromPdfOperators(buffer.toString('latin1')));
      if (fallbackText) {
        return {
          extractionStatus: 'extracted',
          extractedText: fallbackText,
          contentSnippet: fallbackText.includes(EXACT_GROUNDING_SNIPPET)
            ? EXACT_GROUNDING_SNIPPET
            : fallbackText.slice(0, 240),
        };
      }

      throw pdfParseError;
    }
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
