import { NextRequest, NextResponse } from 'next/server';
import { discoverSourcesFromPrompt } from '@/server/grant-ops/source-discovery-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const result = await discoverSourcesFromPrompt(prompt);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error discovering sources:', error);
    return NextResponse.json({ error: 'Failed to discover sources' }, { status: 500 });
  }
}
