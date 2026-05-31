import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { getDataDir } from '../../../../../shared/grant-ops-persistence';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { analyzeStoredDocument } from '@/server/grant-ops/document-text-extractor';
import * as documentService from '@/server/grant-ops/document-service';
import { validateFileSize, validateFileExtension, validateMimeType, atomicWrite } from '@/server/grant-ops/upload-validator';
import type { DocumentMetadata } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function parseBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

// GET: List all documents, with optional search
export async function GET(request: NextRequest) {
  await connection();
  try {
    const searchQuery = new URL(request.url).searchParams.get('q');

    if (searchQuery) {
      const results = await documentService.searchDocuments(searchQuery);
      return NextResponse.json(results);
    }

    const documents = await documentService.listDocuments();
    return NextResponse.json(documents);
  } catch (error) {
    logger.error({ err: error }, 'Error getting documents');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get documents'), { status: 500 });
  }
}

// POST: Upload a real document payload via multipart/form-data
export async function POST(request: NextRequest) {
  await connection();
  try {
    const formData = await request.formData();
    const deps = getDependencies();
    const fileEntry = formData.get('file');

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'File is required'), { status: 400 });
    }

    const id = deps.idGenerator.generateId('doc');
    const name = typeof formData.get('name') === 'string' && formData.get('name')
      ? String(formData.get('name'))
      : fileEntry.name;
    const type = typeof formData.get('type') === 'string' && formData.get('type')
      ? String(formData.get('type'))
      : path.extname(fileEntry.name).replace(/^[.]/, '').toUpperCase() || 'FILE';
    const nowIso = deps.clock.now().toISOString();
    const storageDir = path.join(getDataDir(), 'documents');
    await fs.mkdir(storageDir, { recursive: true });

    const sanitized = sanitizeFileName(fileEntry.name);
    const storagePath = path.join(storageDir, `${id}-${sanitized}`);
    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const tmpPath = storagePath + '.tmp.upload';
    await fs.writeFile(tmpPath, bytes);

    const sizeErr = validateFileSize(tmpPath);
    if (sizeErr) {
      await fs.unlink(tmpPath).catch(() => {});
      return NextResponse.json(sizeErr, { status: 400 });
    }

    const extErr = validateFileExtension(fileEntry.name);
    if (extErr) {
      await fs.unlink(tmpPath).catch(() => {});
      return NextResponse.json(extErr, { status: 400 });
    }

    const mimeErr = await validateMimeType(tmpPath, fileEntry.name);
    if (mimeErr) {
      await fs.unlink(tmpPath).catch(() => {});
      return NextResponse.json(mimeErr, { status: 400 });
    }

    const { error: writeError } = await atomicWrite(tmpPath, storageDir, `${id}-${sanitized}`);
    await fs.unlink(tmpPath).catch(() => {});
    if (writeError) {
      return NextResponse.json(writeError, { status: 500 });
    }

    const extraction = await analyzeStoredDocument(storagePath, fileEntry.type || 'application/octet-stream');

    const doc: DocumentMetadata = {
      id,
      name,
      type,
      lastUsed: typeof formData.get('lastUsed') === 'string' ? String(formData.get('lastUsed')) : nowIso,
      audited: parseBoolean(formData.get('audited')) ?? false,
      uploadedAt: nowIso,
      storagePath,
      sha256,
    };

    const version = typeof formData.get('version') === 'string' ? String(formData.get('version')) : null;
    if (version) {
      doc.version = version;
    }
    if (extraction.extractionStatus) {
      doc.extractionStatus = extraction.extractionStatus;
    }
    if (extraction.extractedText) {
      doc.extractedText = extraction.extractedText;
    }
    if (extraction.contentSnippet) {
      doc.contentSnippet = extraction.contentSnippet;
    }
    if (extraction.extractionError) {
      doc.extractionError = extraction.extractionError;
    }
    if (fileEntry.type) {
      doc.mimeType = fileEntry.type;
    }

    await deps.repository.addDocument(doc);

    // Index the document for search
    await documentService.indexDocument(doc);

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error adding document');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to add document'), { status: 500 });
  }
}

// PATCH: Update document metadata
export async function PATCH(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const deps = getDependencies();

    if (!body || !body.id) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Document ID is required'), { status: 400 });
    }

    const updates: Partial<DocumentMetadata> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.lastUsed !== undefined) updates.lastUsed = body.lastUsed;
    if (body.version !== undefined) updates.version = body.version;
    if (body.audited !== undefined) updates.audited = body.audited;
    if (body.classification !== undefined) updates.classification = body.classification;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'At least one document field is required'), { status: 400 });
    }

    await deps.repository.updateDocument(body.id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating document');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update document'), { status: 500 });
  }
}

// DELETE: Remove a document
export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.id) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Document ID is required'), { status: 400 });
    }

    const success = await documentService.deleteDocument(body.id);
    if (!success) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Document not found'), { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting document');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to delete document'), { status: 500 });
  }
}
