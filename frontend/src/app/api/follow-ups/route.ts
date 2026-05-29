import { NextRequest, NextResponse } from 'next/server';
import * as submissionService from '@/server/grant-ops/submission-service';
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');
    const statusFilter = searchParams.get('status');

    const followUps = await submissionService.getFollowUps();

    let filtered = followUps;

    if (grantId) {
      filtered = filtered.filter((f) => f.grantId === grantId);
    }

    if (statusFilter && ['pending', 'overdue', 'completed'].includes(statusFilter)) {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error getting follow-ups:', error);
    return NextResponse.json({ error: 'Failed to get follow-ups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || !body.title) {
      return NextResponse.json(
        { error: 'ID and title are required' },
        { status: 400 },
      );
    }

    const followUp = await submissionService.createFollowUp({
      id: body.id,
      grantId: body.grantId,
      submissionId: body.submissionId,
      type: body.type || 'other',
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      status: body.status || 'pending',
      completedAt: body.completedAt,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(followUp, { status: 201 });
  } catch (error) {
    console.error('Error creating follow-up:', error);
    return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await submissionService.updateFollowUp({
      id: body.id,
      grantId: body.grantId,
      submissionId: body.submissionId,
      type: body.type || 'other',
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      status: body.status || 'pending',
      completedAt: body.completedAt,
      createdAt: body.createdAt || new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating follow-up:', error);
    return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
    }

    const deleted = await submissionService.deleteFollowUp(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting follow-up:', error);
    return NextResponse.json({ error: 'Failed to delete follow-up' }, { status: 500 });
  }
}
