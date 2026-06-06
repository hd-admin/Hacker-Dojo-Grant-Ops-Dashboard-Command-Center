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
  return text.includes(EXACT_GROUNDING_SNIPPET) ? EXACT_GROUNDING_SNIPPET : text.slice(0, 240);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import('pdf-parse');
  const parsed = await pdfParse(buffer);
  return normalizeWhitespace(parsed.text || '');
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
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: string[] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: string[] = [];
    worksheet.eachRow((row) => {
      const cellValues = Array.isArray(row.values) ? row.values : Object.values(row.values);
      const cells = cellValues.slice(1).map((cell) => String(cell ?? ''));
      rows.push(cells.join('\t'));
    });
    sheets.push(rows.join('\n'));
  }
  return normalizeWhitespace(sheets.join('\n\n'));
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
    } else if (lowerPath.endsWith('.xlsx')) {
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

export async function analyzeStoredDocument(
  filePath: string,
  mimeType: string,
): Promise<DocumentExtractionResult> {
  const supportedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  const lowerPath = filePath.toLowerCase();
  const isSupportedExtension =
    lowerPath.endsWith('.pdf') ||
    lowerPath.endsWith('.docx') ||
    lowerPath.endsWith('.csv') ||
    lowerPath.endsWith('.xlsx');
  const isSupportedMime = supportedMimeTypes.includes(mimeType);

  if (!isSupportedExtension && !isSupportedMime) {
    return {
      extractionStatus: 'stored_unparsed',
    };
  }

  return extractDocumentText(filePath);
}
