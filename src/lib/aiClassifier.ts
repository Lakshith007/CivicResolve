import {
  DEPARTMENTS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  type AIAnalysisResult,
  type CivicIssue,
  type Department,
  type IssueCategory,
  type IssuePriority,
} from '@/types/civic';
import {
  CATEGORY_RULES,
  DUPLICATE_STOP_WORDS,
  LOW_PRIORITY_DAMPENERS,
  URGENCY_AMPLIFIERS,
  categoryToDepartment,
  priorityToSla,
  scoreToPriority,
  type CategoryRule,
} from './civicKeywords';

export { categoryToDepartment, priorityToSla, scoreToPriority };

export interface ClassificationInput {
  title: string;
  description: string;
  location?: string;
  imageBase64?: string;
  userCategory?: string;
}

/**
 * Deterministic civic issue analyzer used both as the offline/fallback classifier
 * and as a deterministic baseline for unit verification.
 */
export function classifyWithHeuristic(input: ClassificationInput): AIAnalysisResult {
  const combined = `${input.title} ${input.description} ${input.location ?? ''}`.toLowerCase();

  let bestRule: CategoryRule | null = null;
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const rule of CATEGORY_RULES) {
    const hits = rule.keywords.filter((kw) => combined.includes(kw));
    if (hits.length > bestScore) {
      bestScore = hits.length;
      bestRule = rule;
      matchedKeywords = hits;
    }
  }

  let category: IssueCategory = bestRule ? bestRule.category : 'Other Civic Issue';
  let department: Department = bestRule ? bestRule.department : 'General Municipal Administration';
  let urgencyScore = bestRule ? bestRule.baseUrgency : 35;

  if (
    input.userCategory &&
    input.userCategory !== 'auto' &&
    (ISSUE_CATEGORIES as readonly string[]).includes(input.userCategory)
  ) {
    // Respect explicit user category when classifier has weak signal
    if (bestScore <= 1) {
      category = input.userCategory as IssueCategory;
      department = categoryToDepartment(category);
    }
  }

  const reasons: string[] = [];
  for (const amp of URGENCY_AMPLIFIERS) {
    if (combined.includes(amp.term)) {
      urgencyScore += amp.boost;
      reasons.push(amp.reason);
      if (!matchedKeywords.includes(amp.term)) {
        matchedKeywords.push(amp.term);
      }
    }
  }

  for (const damp of LOW_PRIORITY_DAMPENERS) {
    if (combined.includes(damp)) {
      urgencyScore -= 10;
    }
  }

  urgencyScore = Math.max(12, Math.min(98, urgencyScore));
  const priority = scoreToPriority(urgencyScore);

  const locationContext = input.location ? ` at ${input.location}` : '';
  const aiSummary = `${priority}-priority ${category.toLowerCase()} issue reported${locationContext}, routed to ${department}.`;

  const impactAssessment =
    reasons.length > 0
      ? `Elevated urgency driven by ${reasons.slice(0, 3).join('; ')}.`
      : `Standard municipal impact affecting local mobility, sanitation, or neighborhood infrastructure.`;

  const suggestedAction = bestRule
    ? bestRule.defaultAction
    : 'Assign municipal ward officer for on-site verification and departmental routing.';

  const confidence = bestScore >= 2 ? 0.89 : bestScore === 1 ? 0.78 : 0.65;

  return {
    category,
    priority,
    urgencyScore,
    department,
    aiSummary,
    impactAssessment,
    suggestedAction,
    estimatedResolutionSla: priorityToSla(priority),
    confidence,
    detectedKeywords: matchedKeywords.slice(0, 6),
    engine: 'smart-civic-fallback',
  };
}

function normalizeGeminiPayload(
  raw: Record<string, unknown>,
  fallback: AIAnalysisResult
): AIAnalysisResult {
  const category = (ISSUE_CATEGORIES as readonly string[]).includes(String(raw.category))
    ? (raw.category as IssueCategory)
    : fallback.category;

  const department = (DEPARTMENTS as readonly string[]).includes(String(raw.department))
    ? (raw.department as Department)
    : categoryToDepartment(category);

  const rawScore = Number(raw.urgencyScore);
  const urgencyScore = Number.isFinite(rawScore)
    ? Math.max(1, Math.min(100, Math.round(rawScore)))
    : fallback.urgencyScore;

  const priority = (ISSUE_PRIORITIES as readonly string[]).includes(String(raw.priority))
    ? (raw.priority as IssuePriority)
    : scoreToPriority(urgencyScore);

  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0.5, Math.min(1, Number(confidenceRaw.toFixed(2))))
    : 0.92;

  const detectedKeywords = Array.isArray(raw.detectedKeywords)
    ? raw.detectedKeywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 6)
    : fallback.detectedKeywords;

  return {
    category,
    priority,
    urgencyScore,
    department,
    aiSummary: typeof raw.aiSummary === 'string' && raw.aiSummary.trim() ? raw.aiSummary.trim() : fallback.aiSummary,
    impactAssessment:
      typeof raw.impactAssessment === 'string' && raw.impactAssessment.trim()
        ? raw.impactAssessment.trim()
        : fallback.impactAssessment,
    suggestedAction:
      typeof raw.suggestedAction === 'string' && raw.suggestedAction.trim()
        ? raw.suggestedAction.trim()
        : fallback.suggestedAction,
    estimatedResolutionSla:
      typeof raw.estimatedResolutionSla === 'string' && raw.estimatedResolutionSla.trim()
        ? raw.estimatedResolutionSla.trim()
        : priorityToSla(priority),
    confidence,
    detectedKeywords,
    engine: 'gemini-ai',
  };
}

function extractInlineImagePart(imageBase64?: string): { inlineData: { mimeType: string; data: string } } | null {
  if (!imageBase64 || !imageBase64.startsWith('data:image/')) return null;
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}

async function callGeminiEndpoint(
  baseUrl: string,
  apiKey: string,
  parts: Array<Record<string, unknown>>
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const url = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyzes a civic issue using Google Gemini when GEMINI_API_KEY is configured,
 * seamlessly falling back to the deterministic civic classifier if unavailable or offline.
 */
export async function analyzeCivicIssueWithGemini(input: ClassificationInput): Promise<AIAnalysisResult> {
  const fallback = classifyWithHeuristic(input);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return fallback;
  }

  const prompt = `You are an AI municipal triage system for CivicResolve. Analyze this citizen civic complaint and return ONLY a JSON object matching the schema below.

Allowed categories: ${ISSUE_CATEGORIES.join(' | ')}
Allowed priorities: ${ISSUE_PRIORITIES.join(' | ')}
Allowed departments: ${DEPARTMENTS.join(' | ')}

Citizen Complaint:
- Title: ${input.title}
- Description: ${input.description}
- Location: ${input.location || 'Not specified'}
- User-suggested category: ${input.userCategory || 'Auto-detect'}

JSON Schema:
{
  "category": "<exact string from Allowed categories>",
  "priority": "<Critical | High | Medium | Low>",
  "urgencyScore": <integer 1-100>,
  "department": "<exact string from Allowed departments>",
  "aiSummary": "<concise 1-sentence operational summary>",
  "impactAssessment": "<concise public safety/community impact explanation>",
  "suggestedAction": "<specific immediate dispatch action for municipal crew>",
  "estimatedResolutionSla": "<target SLA timeframe>",
  "confidence": <number 0.5-1.0>,
  "detectedKeywords": ["<up to 5 key hazard/category terms>"]
}`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  const imagePart = extractInlineImagePart(input.imageBase64);
  if (imagePart) {
    parts.push(imagePart);
  }

  const endpoints = [
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
  ];
  for (const endpoint of endpoints) {
    const parsed = await callGeminiEndpoint(endpoint, apiKey, parts);
    if (parsed) {
      return normalizeGeminiPayload(parsed, fallback);
    }
  }

  return fallback;
}

function extractTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !DUPLICATE_STOP_WORDS.has(w));
  return new Set(tokens);
}

/**
 * Finds active (non-resolved) complaints in the same category that share
 * significant location or keyword overlap to prevent duplicate crew dispatches.
 */
export function findPotentialDuplicates(
  newIssue: { title: string; description: string; location: string; category?: IssueCategory },
  existingIssues: CivicIssue[]
): CivicIssue[] {
  const targetCategory = newIssue.category ?? classifyWithHeuristic(newIssue).category;
  const newTokens = extractTokens(`${newIssue.title} ${newIssue.description}`);
  const newLocationTokens = extractTokens(newIssue.location);

  return existingIssues.filter((existing) => {
    if (existing.status === 'Resolved') return false;
    if (existing.category !== targetCategory) return false;

    const existingLocTokens = extractTokens(existing.location);
    let locOverlap = 0;
    Array.from(newLocationTokens).forEach((t) => {
      if (existingLocTokens.has(t)) locOverlap++;
    });

    const existingTokens = extractTokens(`${existing.title} ${existing.description}`);
    let contentOverlap = 0;
    Array.from(newTokens).forEach((t) => {
      if (existingTokens.has(t)) contentOverlap++;
    });

    return locOverlap >= 1 && (contentOverlap >= 1 || newLocationTokens.size === 0);
  });
}
