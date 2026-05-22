import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';
import type { DocumentMetadata } from '../../../../../shared/types';

// GET: List all documents
export async function GET() {
  try {
    const documents = await repository.getDocuments();
    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error getting documents:', error);
    return NextResponse.json({ error: 'Failed to get documents' }, { status: 500 });
  }
}

// POST: Add a new document (metadata only - actual file upload handled client-side)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const doc: DocumentMetadata = {
      id: body.id || `doc-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      name: body.name,
      type: body.type,
      lastUsed: body.lastUsed || new Date().toISOString(),
      version: body.version,
      audited: body.audited || false,
    };

    await repository.addDocument(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Error adding document:', error);
    return NextResponse.json({ error: 'Failed to add document' }, { status: 500 });
  }
}

// PATCH: Update document metadata
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const updates: Partial<DocumentMetadata> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.lastUsed !== undefined) updates.lastUsed = body.lastUsed;
    if (body.version !== undefined) updates.version = body.version;
    if (body.audited !== undefined) updates.audited = body.audited;

    await repository.updateDocument(body.id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
