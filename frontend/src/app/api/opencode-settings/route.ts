import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const deps = getDependencies();
    const settings = await deps.repository.getOpencodeSettings();
    if (settings) {
      return NextResponse.json(settings);
    }
    return NextResponse.json({
      binaryPath: 'opencode',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: true,
    });
  } catch (_error) {
    console.error('Error getting opencode settings:', _error);
    return NextResponse.json({
      binaryPath: 'opencode',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: true,
    });
  }
}

// PUT is removed — opencode path is auto-detected via PATH.
// Previously configurable settings are now read-only via health check.
export async function PUT(_request: NextRequest) {
  // Preserve backward compatibility: accept PUT but return current value
  // Settings are now auto-detected and not user-configurable
  const response = await GET();
  return response;
}
