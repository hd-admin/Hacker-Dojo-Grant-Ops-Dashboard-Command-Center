import { NextRequest, NextResponse } from 'next/server';
import * as submissionService from '@/server/grant-ops/submission-service';

export async function GET() {
  try {
    const followUps = await submissionService.getFollowUps();
    return NextResponse.json(followUps);
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
