import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  await connection();
  const { grantId } = await params;
  // Return empty history for now - will be backed by pipeline_transitions table
  return NextResponse.json({
    grantId,
    history: [],
  });
}
