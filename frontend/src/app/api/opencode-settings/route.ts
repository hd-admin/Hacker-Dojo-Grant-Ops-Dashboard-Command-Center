import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { OpencodeSettingsSchema } from '../../../../../shared/schemas';
import type { OpencodeSettings } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const deps = getDependencies();
    const settings = await deps.repository.getOpencodeSettings();
    if (!settings) {
      return NextResponse.json({ error: 'Opencode settings not found' }, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting opencode settings:', error);
    return NextResponse.json({ error: 'Failed to get opencode settings' }, { status: 500 });
  }
}


export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    // Validate body against schema
    const parsed = OpencodeSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid opencode settings',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Transform Zod output to match TypeScript optional property semantics
    // With exactOptionalPropertyTypes: true, { profile?: string } is different from { profile: string | undefined }
    // We need to only include profile if it's defined (not undefined)
    const settings: OpencodeSettings = {
      binaryPath: parsed.data.binaryPath,
      workingDirectory: parsed.data.workingDirectory,
      timeoutMs: parsed.data.timeoutMs,
      isConfigured: parsed.data.isConfigured,
      ...(parsed.data.profile !== undefined && { profile: parsed.data.profile }),
    };

    const deps = getDependencies();
    await deps.repository.updateOpencodeSettings(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating opencode settings:', error);
    return NextResponse.json({ error: 'Failed to update opencode settings' }, { status: 500 });
  }
}
