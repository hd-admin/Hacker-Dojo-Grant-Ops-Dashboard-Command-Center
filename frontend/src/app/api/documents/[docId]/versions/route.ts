import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import * as documentService from '@/server/grant-ops/document-service';
import type { DocumentVersion } from '../../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  storagePath: z.string(),
  notes: z.string().optional(),
});

const MAX_VERSIONS = 50;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  await connection();
  const { docId } = await params;
  const doc = await documentService.getDocument(docId);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  return NextResponse.json(doc.versions ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  await connection();
  try {
    const { docId } = await params;
    const parsed = postBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const doc = await documentService.getDocument(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const deps = getDependencies();
    const existingVersions: DocumentVersion[] = doc.versions ?? [];
    const nextVersionNumber =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.versionNumber)) + 1
        : 1;

    const newVersion: DocumentVersion = {
      id: deps.idGenerator.generateId('docver'),
      documentId: docId,
      versionNumber: nextVersionNumber,
      uploadedAt: deps.clock.now().toISOString(),
      storagePath: parsed.data.storagePath,
    };
    if (parsed.data.notes !== undefined) {
      newVersion.notes = parsed.data.notes;
    }

    const updatedVersions = [newVersion, ...existingVersions].slice(0, MAX_VERSIONS);
    await deps.repository.updateDocument(docId, {
      versions: updatedVersions,
      lastUsed: deps.clock.now().toISOString(),
    });

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    console.error('Error adding document version:', error);
    return NextResponse.json(
      { error: 'Failed to add document version' },
      { status: 500 },
    );
  }
}
