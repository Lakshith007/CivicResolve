import { NextResponse } from 'next/server';
import { analyzeCivicIssueWithGemini, findPotentialDuplicates } from '@/lib/aiClassifier';
import {
  authenticateUser,
  checkRateLimit,
  getClientIp,
  requireCitizen,
  verifySameOrigin,
} from '@/lib/authGuards';
import {
  createIssue,
  getAllIssues,
  getDashboardStats,
  toPublicIssue,
} from '@/lib/issueStore';
import { syncIssueToFirestore } from '@/lib/firebase';
import { validateIssueSubmission } from '@/lib/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const department = searchParams.get('department');
  const search = searchParams.get('search')?.trim().toLowerCase();

  let viewer = authenticateUser(request);
  if (scope === 'mine') {
    const citizenGuard = requireCitizen(request);
    if (!citizenGuard.ok) return citizenGuard.response;
    viewer = citizenGuard.user;
  }

  const allIssues = getAllIssues();

  const filtered = allIssues.filter((issue) => {
    if (scope === 'mine' && issue.reporterUserId !== viewer?.id) return false;
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

  // Always strip private reporter PII unless viewer is ADMIN or the ticket owner
  const safeIssues = filtered.map((issue) => toPublicIssue(issue, viewer));

  return NextResponse.json({
    issues: safeIssues,
    stats: getDashboardStats(allIssues),
  });
}

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`create-issue:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Submission rate limit reached. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const viewer = authenticateUser(request);
    const body = await request.json();
    const validation = validateIssueSubmission(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' '), errors: validation.errors },
        { status: 400 }
      );
    }

    const submission = validation.data;

    // Always compute AI classification on the server so clients cannot forge urgency/priority
    const analysis = await analyzeCivicIssueWithGemini({
      title: submission.title,
      description: submission.description,
      location: submission.location,
      imageBase64: submission.imageUrl,
      userCategory: submission.userCategory,
    });

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

    const created = createIssue(submission, {
      aiAnalysis: analysis,
      reporterUserId: viewer?.id,
    });

    // Asynchronously mirror to Google Firebase Firestore (non-blocking fallback)
    void syncIssueToFirestore(created);

    return NextResponse.json(
      {
        issue: toPublicIssue(created, viewer),
        duplicatesCount: duplicates.length,
        stats: getDashboardStats(),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to parse issue submission payload.' }, { status: 400 });
  }
}
