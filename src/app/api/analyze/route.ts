import { NextResponse } from 'next/server';
import { analyzeCivicIssueWithGemini, findPotentialDuplicates } from '@/lib/aiClassifier';
import { getAllIssues } from '@/lib/issueStore';
import { sanitizeText } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = sanitizeText(body.title, 140);
    const description = sanitizeText(body.description, 2000);
    const location = sanitizeText(body.location, 200);
    const userCategory = typeof body.userCategory === 'string' ? body.userCategory : undefined;
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined;

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

    const duplicates = findPotentialDuplicates(
      {
        title,
        description,
        location,
        category: analysis.category,
      },
      getAllIssues()
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
