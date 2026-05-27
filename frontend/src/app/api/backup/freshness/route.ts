import { NextResponse } from 'next/server';
import { loadBackupFreshness } from '../../../../../../shared/grant-ops-persistence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadBackupFreshness());
  } catch (error) {
    console.error('Error loading backup freshness:', error);
    return NextResponse.json({ error: 'Failed to load backup freshness' }, { status: 500 });
  }
}
