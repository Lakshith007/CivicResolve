import { NextResponse } from 'next/server';
import { authenticateUser, requireAuth, verifySameOrigin } from '@/lib/authGuards';
import { updateUserName } from '@/lib/authStore';
import { sanitizeText } from '@/lib/validation';

export async function GET(request: Request) {
  const user = authenticateUser(request);
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const guard = requireAuth(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Ordinary profile updates can NEVER modify roles or privileges
    if (body && typeof body === 'object' && 'role' in body && body.role !== undefined) {
      return NextResponse.json(
        { error: 'Forbidden: users cannot modify their own role or privileges.' },
        { status: 403 }
      );
    }

    const name = sanitizeText(body.name, 80);
    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const updated = updateUserName(guard.user.id, name);
    if (!updated) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid profile update payload.' }, { status: 400 });
  }
}
