import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

function createMockNextRequest(formData: FormData): import('next/server').NextRequest {
  return {
    formData: async () => formData,
    headers: new Headers({ 'content-type': 'multipart/form-data' }),
  } as unknown as import('next/server').NextRequest;
}

describe('POST /api/budget-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-multipart requests', async () => {
    const req = {
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as import('next/server').NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('multipart/form-data');
  });

  it('rejects missing file', async () => {
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('A file upload is required');
  });

  it('rejects empty file', async () => {
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([], 'empty.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('empty');
  });

  it('parses valid CSV with header detection', async () => {
    const csv = 'Category,Item,Amount\nPersonnel,Salary,50000\nEquipment,Laptops,12000\n';
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([csv], 'budget.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.detectedColumns).toEqual(['Category', 'Item', 'Amount']);
    expect(json.preview.rows.length).toBe(2);
    expect(json.preview.validRowCount).toBe(2);
    expect(json.preview.totalAmount).toBe(62000);
  });

  it('parses valid XLSX file', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.getRow(1).getCell(1).value = 'Category';
    worksheet.getRow(1).getCell(2).value = 'Description';
    worksheet.getRow(1).getCell(3).value = 'Budget';
    worksheet.getRow(2).getCell(1).value = 'Personnel';
    worksheet.getRow(2).getCell(2).value = 'Salaries';
    worksheet.getRow(2).getCell(3).value = 50000;
    worksheet.getRow(3).getCell(1).value = 'Travel';
    worksheet.getRow(3).getCell(2).value = 'Conference';
    worksheet.getRow(3).getCell(3).value = 3000;
    const buffer = await workbook.xlsx.writeBuffer();
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append(
      'file',
      new File([buffer], 'budget.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.rows.length).toBe(2);
    expect(json.preview.validRowCount).toBe(2);
    expect(json.preview.totalAmount).toBe(53000);
  });

  it('flags rows with non-numeric amounts', async () => {
    const csv = 'Category,Amount\nPersonnel,abc\nEquipment,12000\n';
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([csv], 'budget.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.invalidRowCount).toBe(1);
    const invalidRow = json.preview.rows.find((r: { errors: string[] }) => r.errors.length > 0);
    expect(invalidRow.errors[0]).toContain('Non-numeric amount');
  });

  it('flags rows with missing categories', async () => {
    const csv = 'Category,Amount\n,50000\nEquipment,12000\n';
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([csv], 'budget.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.invalidRowCount).toBe(1);
    const invalidRow = json.preview.rows.find((r: { errors: string[] }) => r.errors.length > 0);
    expect(invalidRow.errors[0]).toContain('Missing category');
  });

  it('returns operator preview with detected columns', async () => {
    const csv = 'Line Item,Description,Total Cost\n1,Salary,50000\n2,Laptops,12000\n';
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([csv], 'budget.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.detectedColumns).toContain('Line Item');
    expect(json.preview.detectedColumns).toContain('Description');
    expect(json.preview.detectedColumns).toContain('Total Cost');
    expect(json.message).toContain('Review and confirm');
  });

  it('handles CSV without detectable headers gracefully', async () => {
    const csv = 'foo,bar,baz\n1,2,3\n4,5,6\n';
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File([csv], 'budget.csv', { type: 'text/csv' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.rows.length).toBe(2);
  });

  it('rejects unsupported file types', async () => {
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File(['not a budget'], 'budget.pdf', { type: 'application/pdf' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unsupported file type');
  });

  it('rejects .xls files', async () => {
    const fd = new FormData();
    fd.append('awardId', 'award-1');
    fd.append('file', new File(['not a budget'], 'budget.xls', { type: 'application/vnd.ms-excel' }));
    const req = createMockNextRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unsupported file type');
  });
});
