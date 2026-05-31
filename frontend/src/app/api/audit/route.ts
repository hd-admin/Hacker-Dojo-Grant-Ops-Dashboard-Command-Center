import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const entityType = searchParams.get('entityType');

    const events = await deps.repository.getAuditEvents(100);
    const filtered = events
      .filter((event) => (entityId ? event.entityId === entityId : true))
      .filter((event) => (entityType ? event.entityType === entityType : true))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error listing audit events:', error);
    return NextResponse.json({ error: 'Failed to list audit events' }, { status: 500 });
  }
}
