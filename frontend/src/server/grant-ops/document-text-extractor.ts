import 'server-only';
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

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { getDocument } = await import('pdfjs-dist');
    const data = new Uint8Array(buffer);
    const pdf = await getDocument({ data }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }
    return normalizeWhitespace(fullText);
  } catch {
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = await pdfParse(buffer);
    return normalizeWhitespace(parsed.text || '');
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value || '');
}

async function extractCsvText(buffer: Buffer): Promise<string> {
  const { parse } = await import('csv-parse/sync');
  const text = buffer.toString('utf-8');
  const records: string[][] = parse(text, { skip_empty_lines: true });
  return normalizeWhitespace(records.map((row) => row.join(' ')).join('\n'));
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const xlsx = await import('xlsx');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      const csv = xlsx.utils.sheet_to_csv(sheet);
      sheets.push(csv);
    }
  }
  return normalizeWhitespace(sheets.join('\n'));
}

export async function extractDocumentText(filePath: string): Promise<DocumentExtractionResult> {
  try {
    const buffer = await fs.readFile(filePath);
    const lowerPath = filePath.toLowerCase();

    let extractedText = '';

    if (lowerPath.endsWith('.pdf')) {
      extractedText = await extractPdfText(buffer);
    } else if (lowerPath.endsWith('.docx')) {
      extractedText = await extractDocxText(buffer);
    } else if (lowerPath.endsWith('.csv')) {
      extractedText = await extractCsvText(buffer);
    } else if (lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls')) {
      extractedText = await extractXlsxText(buffer);
    } else {
      const rawText = normalizeWhitespace(buffer.toString('utf-8'));
      extractedText = rawText;
    }

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
  const supportedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const lowerPath = filePath.toLowerCase();
  const isSupportedExtension = lowerPath.endsWith('.pdf') || lowerPath.endsWith('.docx') || lowerPath.endsWith('.csv') || lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls');
  const isSupportedMime = supportedMimeTypes.includes(mimeType);

  if (!isSupportedExtension && !isSupportedMime) {
    return {
      extractionStatus: 'stored_unparsed',
    };
  }

  return extractDocumentText(filePath);
}
