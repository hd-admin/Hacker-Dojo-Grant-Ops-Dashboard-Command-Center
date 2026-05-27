import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
    return NextResponse.json({ error: 'Failed to discover sources' }, { status: 500 });
  }
}
