import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { opencodeFailureMessages } from '@/lib/failure-messages';
import { classifyOpencodeError } from '@/server/grant-ops/opencode-client';
import { discoverSourcesFromPrompt } from '@/server/grant-ops/source-discovery-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  prompt: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid discovery prompt', issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = await discoverSourcesFromPrompt(parsed.data.prompt);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error discovering sources:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to discover sources';
    const failureMode = classifyOpencodeError(errorMessage);
    const guidance = opencodeFailureMessages[failureMode];
    const retryable = ['rate-limit', 'malformed-output', 'model-unavailable', 'timeout', 'unknown'].includes(failureMode);

    return NextResponse.json(
      {
        error: errorMessage,
        failureMode,
        retryable,
        guidance,
      },
      { status: 500 },
    );
  }
}
