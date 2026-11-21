import { NextResponse } from 'next/server';
import { analyzeCivicIssueWithGemini, findPotentialDuplicates } from '@/lib/aiClassifier';
import { checkRateLimit, getClientIp, verifySameOrigin } from '@/lib/authGuards';
import { hydrateIssuesFromFirestore } from '@/lib/issueStore';
import { isValidImageInput, sanitizeText } from '@/lib/validation';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`analyze:${ip}`, 30, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'AI analysis rate limit reached. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = sanitizeText(body.title, 140);
    const description = sanitizeText(body.description, 2000);
    const location = sanitizeText(body.location, 200);
    const userCategory = typeof body.userCategory === 'string' ? body.userCategory : undefined;
    const rawImage = typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined;
    const imageBase64 = rawImage ? isValidImageInput(rawImage) : undefined;

    if (rawImage && rawImage.trim() !== '' && !imageBase64) {
      return NextResponse.json(
        { error: 'Image attachment must be a valid PNG, JPEG, or WebP image under 1.5MB.' },
        { status: 400 }
      );
    }

    if (title.length < 3 && description.length < 5) {
      return NextResponse.json(
        { error: 'Please enter a short issue title or description before running AI analysis.' },
        { status: 400 }
      );
    }

    const analysis = await analyzeCivicIssueWithGemini({
      title,
      description,
      location,
      imageBase64,
      userCategory,
    });

    const existingIssues = await hydrateIssuesFromFirestore();
    const duplicates = findPotentialDuplicates(
      {
        title,
        description,
        location,
        category: analysis.category,
      },
      existingIssues
    );

    return NextResponse.json({
      analysis,
      duplicates: duplicates.map((d) => ({
        id: d.id,
        title: d.title,
        location: d.location,
        status: d.status,
        priority: d.priority,
        upvotes: d.upvotes,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload for AI analysis.' }, { status: 400 });
  }
}
