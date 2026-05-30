import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { SubmissionManifest, SubmissionManifestItem } from '../../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  version: z.string().optional(),
  role: z.string(),
});

const bodySchema = z.object({
  instructions: z.string().optional(),
  portalUrl: z.string().optional(),
  fileConstraints: z.string().optional(),
  dueDate: z.string().optional(),
  materialRefs: z.array(itemSchema).default([]),
  notes: z.string().optional(),
  submissionMethod: z.enum(['portal', 'email', 'mail', 'other']).optional(),
  confirmationNumber: z.string().optional(),
  runbookCompleted: z.boolean().optional(),
});

const patchBodySchema = z.object({
  confirmationNumber: z.string().optional(),
  runbookCompleted: z.boolean().optional(),
  submissionMethod: z.enum(['portal', 'email', 'mail', 'other']).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  const deps = getDependencies();
  const grant = await deps.repository.getGrant(grantId);
  if (!grant) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
  }
  const manifests = await deps.repository.getSubmissionManifests(grantId);
  const manifest = manifests[0] ?? null;
  if (!manifest) {
    return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
  }
  return NextResponse.json(manifest);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const { grantId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid manifest payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }
    const existing = await deps.repository.getSubmissionManifests(grantId);
    const materialRefs: SubmissionManifestItem[] = parsed.data.materialRefs.map((item) => ({
      documentId: item.documentId,
      documentName: item.documentName,
      role: item.role,
      ...(item.version !== undefined ? { version: item.version } : {}),
    }));
    const manifest: SubmissionManifest = {
      id: existing[0]?.id ?? deps.idGenerator.generateId('manifest'),
      grantId,
      version: (existing[0]?.version ?? 0) + 1,
      createdAt: existing[0]?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      materialRefs,
    };
    if (parsed.data.instructions !== undefined) manifest.instructions = parsed.data.instructions;
    if (parsed.data.portalUrl !== undefined) manifest.portalUrl = parsed.data.portalUrl;
    if (parsed.data.fileConstraints !== undefined) manifest.fileConstraints = parsed.data.fileConstraints;
    if (parsed.data.dueDate !== undefined) manifest.dueDate = parsed.data.dueDate;
    if (parsed.data.notes !== undefined) manifest.notes = parsed.data.notes;
    if (parsed.data.submissionMethod !== undefined) manifest.submissionMethod = parsed.data.submissionMethod;
    if (parsed.data.confirmationNumber !== undefined) manifest.confirmationNumber = parsed.data.confirmationNumber;
    if (parsed.data.runbookCompleted !== undefined) manifest.runbookCompleted = parsed.data.runbookCompleted;
    await deps.repository.addSubmissionManifest(manifest);
    return NextResponse.json(manifest);
  } catch (error) {
    console.error('Error saving manifest:', error);
    return NextResponse.json({ error: 'Failed to save manifest' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const { grantId } = await params;
    const parsed = patchBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }
    const manifests = await deps.repository.getSubmissionManifests(grantId);
    const existing = manifests[0];
    if (!existing) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    const updated: SubmissionManifest = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };
    if (parsed.data.confirmationNumber !== undefined) updated.confirmationNumber = parsed.data.confirmationNumber;
    if (parsed.data.runbookCompleted !== undefined) updated.runbookCompleted = parsed.data.runbookCompleted;
    if (parsed.data.submissionMethod !== undefined) updated.submissionMethod = parsed.data.submissionMethod;

    await deps.repository.addSubmissionManifest(updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating manifest:', error);
    return NextResponse.json({ error: 'Failed to update manifest' }, { status: 500 });
  }
}
