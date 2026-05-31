import { NextRequest, NextResponse, connection } from "next/server";
import { checkAndRunDue } from '@/server/grant-ops/crawl-scheduler-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const shouldTrigger = searchParams.get('trigger') === 'true';
    const triggered = shouldTrigger ? await checkAndRunDue() : 0;
    return NextResponse.json({ triggered });
  } catch (error) {
    console.error('Error checking scheduled crawls:', error);
    return NextResponse.json({ error: 'Failed to check scheduled crawls' }, { status: 500 });
  }
}

export async function POST() {
  await connection();
  try {
    const triggered = await checkAndRunDue();
    return NextResponse.json({ triggered });
  } catch (error) {
    console.error('Error triggering scheduled crawls:', error);
    return NextResponse.json({ error: 'Failed to trigger scheduled crawls' }, { status: 500 });
  }
}
