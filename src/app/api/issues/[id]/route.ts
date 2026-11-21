import { NextResponse } from 'next/server';
import { getDashboardStats, getIssueById, updateIssueStatus, upvoteIssue } from '@/lib/issueStore';
import { validateStatusUpdate } from '@/lib/validation';

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const issue = getIssueById(context.params.id);
  if (!issue) {
    return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
  }
  return NextResponse.json({ issue });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === 'upvote') {
      const updated = upvoteIssue(context.params.id);
      if (!updated) {
        return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
      }
      return NextResponse.json({ issue: updated, stats: getDashboardStats() });
    }

    const validation = validateStatusUpdate(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' '), errors: validation.errors },
        { status: 400 }
      );
    }

    const updated = updateIssueStatus(context.params.id, validation.data);
    if (!updated) {
      return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
    }

    return NextResponse.json({ issue: updated, stats: getDashboardStats() });
  } catch {
    return NextResponse.json({ error: 'Invalid status update payload.' }, { status: 400 });
  }
}
