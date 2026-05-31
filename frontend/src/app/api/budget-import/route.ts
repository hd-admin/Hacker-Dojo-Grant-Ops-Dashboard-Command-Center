import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from '@/lib/logger';


export const dynamic = 'force-dynamic';

const HEADER_KEYWORDS = [
  'category', 'item', 'line', 'description', 'amount',
  'budget', 'total', 'cost', 'expense'
];

export interface ParsedBudgetRow {
  raw: Record<string, unknown>;
  detectedColumns: string[];
  mappedCategory: string | undefined;
  mappedAmount: number | undefined;
  errors: string[];
}

export interface BudgetImportPreview {
  detectedColumns: string[];
  rows: ParsedBudgetRow[];
  validRowCount: number;
  invalidRowCount: number;
  totalAmount: number;
}

function detectHeaderRow(rows: string[][]): { headerRowIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const lowerCells = row.map(c => String(c).toLowerCase().trim());
    const matchCount = lowerCells.filter(c => HEADER_KEYWORDS.some(k => c.includes(k))).length;
    if (matchCount >= 2) {
      return { headerRowIndex: i, headers: row.map(h => String(h).trim()) };
    }
  }
  return { headerRowIndex: 0, headers: rows[0]?.map((_, idx) => `Column ${idx + 1}`) ?? [] };
}

function parseCsvBuffer(buffer: Buffer): string[][] {
  const { parse } = require('csv-parse/sync');
  const text = buffer.toString('utf-8');
  const records: string[][] = parse(text, { skip_empty_lines: true });
  return records;
}

function parseXlsxBuffer(buffer: Buffer): string[][] {
  const xlsx = require('xlsx');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const json: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return json.map(row => row.map(cell => String(cell)));
}

function parseBudgetFile(buffer: Buffer, mimeType: string, fileName: string): BudgetImportPreview {
  let rawRows: string[][];

  if (mimeType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
    rawRows = parseCsvBuffer(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    fileName.toLowerCase().endsWith('.xlsx') ||
    fileName.toLowerCase().endsWith('.xls')
  ) {
    rawRows = parseXlsxBuffer(buffer);
  } else {
    throw new Error('Unsupported file type. Please upload CSV or XLSX.');
  }

  if (rawRows.length === 0) {
    throw new Error('File is empty or contains no readable rows.');
  }

  const { headerRowIndex, headers } = detectHeaderRow(rawRows);
  const dataRows = rawRows.slice(headerRowIndex + 1);

  const parsedRows: ParsedBudgetRow[] = dataRows.map((row) => {
    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      raw[h] = row[i] ?? '';
    });

    const detectedColumns = headers.filter(h =>
      HEADER_KEYWORDS.some(k => h.toLowerCase().includes(k))
    );

    const errors: string[] = [];

    const categoryCol = headers.find(h => h.toLowerCase().includes('category'));
    const itemCol = headers.find(h => h.toLowerCase().includes('item') || h.toLowerCase().includes('description') || h.toLowerCase().includes('line'));
    const amountCol = headers.find(h => h.toLowerCase().includes('amount') || h.toLowerCase().includes('budget') || h.toLowerCase().includes('total') || h.toLowerCase().includes('cost') || h.toLowerCase().includes('expense'));

    const mappedCategory = categoryCol ? String(raw[categoryCol] ?? '').trim() : itemCol ? String(raw[itemCol] ?? '').trim() : undefined;
    const amountRaw = amountCol ? raw[amountCol] : undefined;
    let mappedAmount: number | undefined;

    if (amountRaw !== undefined) {
      const cleaned = String(amountRaw).replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && isFinite(parsed)) {
        mappedAmount = parsed;
      } else {
        errors.push(`Non-numeric amount: "${amountRaw}"`);
      }
    }

    if (!mappedCategory || mappedCategory.length === 0) {
      errors.push('Missing category or item description.');
    }

    return {
      raw,
      detectedColumns,
      mappedCategory,
      mappedAmount,
      errors,
    };
  });

  const validRowCount = parsedRows.filter(r => r.errors.length === 0).length;
  const invalidRowCount = parsedRows.filter(r => r.errors.length > 0).length;
  const totalAmount = parsedRows
    .filter(r => r.mappedAmount !== undefined && r.errors.length === 0)
    .reduce((sum, r) => sum + (r.mappedAmount ?? 0), 0);

  return {
    detectedColumns: headers,
    rows: parsedRows,
    validRowCount,
    invalidRowCount,
    totalAmount,
  };
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'Request must be multipart/form-data with a file upload'),
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const awardId = formData.get('awardId');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'No file provided'),
        { status: 400 }
      );
    }

    const fileName = file.name;
    const mimeType = file.type || 'application/octet-stream';
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length === 0) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'File is empty'),
        { status: 400 }
      );
    }

    const preview = parseBudgetFile(buffer, mimeType, fileName);

    return NextResponse.json({
      preview,
      awardId: awardId ? String(awardId) : undefined,
      fileName,
      message: 'Budget file parsed successfully. Review and confirm before ingestion.',
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse budget file';
    logger.error({ err: error }, 'Error parsing budget import');
    return NextResponse.json(
      createErrorResponse('AGENT_SCHEMA_MISMATCH', message),
      { status: 400 }
    );
  }
}
