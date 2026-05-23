import { NextResponse } from 'next/server';
import { resetPersistentStateForTests } from '../../../../../../shared/grant-ops-persistence';

export const dynamic = 'force-dynamic';

export async function POST() {
  await resetPersistentStateForTests();
  return NextResponse.json({ success: true });
}
