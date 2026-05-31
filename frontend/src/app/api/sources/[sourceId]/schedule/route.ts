import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from 'zod';
import { disableScheduleForSource, getScheduleForSource, upsertScheduleForSource } from '@/server/grant-ops/crawl-scheduler-service';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  intervalHours: z.number().int().min(1).max(168),
  isEnabled: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  const { sourceId } = await params;
  const deps = getDependencies();
  const source = (await deps.repository.getSources()).find((item) => item.id === sourceId);
  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const schedule = await getScheduleForSource(sourceId);
  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }
  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  try {
    const { sourceId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid schedule payload', issues: parsed.error.flatten() }, { status: 400 });
    }
    const deps = getDependencies();
    const source = (await deps.repository.getSources()).find((item) => item.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    const schedule = await upsertScheduleForSource(sourceId, parsed.data.intervalHours, parsed.data.isEnabled ?? true);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  try {
    const { sourceId } = await params;
    const deps = getDependencies();
    const source = (await deps.repository.getSources()).find((item) => item.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    await disableScheduleForSource(sourceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
