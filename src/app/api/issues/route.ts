import { NextResponse } from 'next/server';
import { analyzeCivicIssueWithGemini, findPotentialDuplicates } from '@/lib/aiClassifier';
import { createIssue, getAllIssues, getDashboardStats } from '@/lib/issueStore';
import { validateIssueSubmission } from '@/lib/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const department = searchParams.get('department');
  const search = searchParams.get('search')?.trim().toLowerCase();

  const allIssues = getAllIssues();

  const filtered = allIssues.filter((issue) => {
    if (status && status !== 'All' && issue.status !== status) return false;
    if (category && category !== 'All' && issue.category !== category) return false;
    if (priority && priority !== 'All' && issue.priority !== priority) return false;
    if (department && department !== 'All' && issue.department !== department) return false;
    if (search) {
      const haystack = `${issue.id} ${issue.title} ${issue.description} ${issue.location} ${issue.ward} ${issue.department}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return NextResponse.json({
    issues: filtered,
    stats: getDashboardStats(allIssues),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateIssueSubmission(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' '), errors: validation.errors },
        { status: 400 }
      );
    }

    const submission = validation.data;
    const analysis =
      submission.aiAnalysis ??
      (await analyzeCivicIssueWithGemini({
        title: submission.title,
        description: submission.description,
        location: submission.location,
        imageBase64: submission.imageUrl,
        userCategory: submission.userCategory,
      }));

    const existingIssues = getAllIssues();
    const duplicates = findPotentialDuplicates(
      {
        title: submission.title,
        description: submission.description,
        location: submission.location,
        category: analysis.category,
      },
      existingIssues
    );

    const created = createIssue({
      ...submission,
      aiAnalysis: analysis,
    });

    return NextResponse.json(
      {
        issue: created,
        duplicatesCount: duplicates.length,
        stats: getDashboardStats(),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to parse issue submission payload.' }, { status: 400 });
  }
}
