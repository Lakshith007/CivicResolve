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

export interface ClassificationInput {
  title: string;
  description: string;
  location?: string;
  imageBase64?: string;
  userCategory?: string;
}

interface CategoryRule {
  category: IssueCategory;
  department: Department;
  baseUrgency: number;
  keywords: string[];
  defaultAction: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Streetlights & Electrical',
    department: 'Electrical & Streetlighting Division',
    baseUrgency: 52,
    keywords: [
      'streetlight',
      'street light',
      'lamp',
      'bulb',
      'dark',
      'wire',
      'cable',
      'electric',
      'electrical',
      'spark',
      'sparking',
      'transformer',
      'pole',
      'shock',
      'short circuit',
      'outage',
      'blackout',
    ],
    defaultAction:
      'Dispatch electrical maintenance crew to isolate power hazard, inspect pole wiring, and restore illumination.',
  },
  {
    category: 'Water Supply & Leakage',
    department: 'Water Works & Hydraulic Engineering',
    baseUrgency: 56,
    keywords: [
      'water',
      'pipe',
      'pipeline',
      'leak',
      'leaking',
      'burst',
      'main',
      'valve',
      'hydrant',
      'contamination',
      'dirty water',
      'tap',
      'drinking',
      'flooding',
      'supply',
    ],
    defaultAction:
      'Dispatch hydraulic emergency unit to shut isolation valve, repair ruptured pipeline, and check pressure.',
  },
  {
    category: 'Potholes & Road Damage',
    department: 'Roads & Bridges Department (PWD)',
    baseUrgency: 48,
    keywords: [
      'pothole',
      'road',
      'asphalt',
      'crater',
      'crack',
      'pavement',
      'highway',
      'street',
      'sinkhole',
      'bridge',
      'speed breaker',
      'junction',
      'traffic',
      'divider',
      'tar',
    ],
    defaultAction:
      'Place reflective safety barricades immediately and schedule cold-mix/hot-mix asphalt patching crew.',
  },
  {
    category: 'Garbage & Sanitation',
    department: 'Solid Waste Management (SWM)',
    baseUrgency: 44,
    keywords: [
      'garbage',
      'trash',
      'waste',
      'bin',
      'dump',
      'overflow',
      'overflowing',
      'litter',
      'smell',
      'stink',
      'rot',
      'compactor',
      'sanitation',
      'debris',
      'stray',
      'market',
    ],
    defaultAction:
      'Assign compactor collection truck for immediate clearance, area sanitization spray, and bin replacement.',
  },
  {
    category: 'Drainage & Sewage',
    department: 'Stormwater & Sewerage Board',
    baseUrgency: 54,
    keywords: [
      'drain',
      'drainage',
      'sewage',
      'sewer',
      'manhole',
      'clog',
      'clogged',
      'blocked',
      'gutter',
      'waterlogging',
      'stagnant',
      'culvert',
      'overflowing drain',
      'stormwater',
    ],
    defaultAction:
      'Deploy jetting/suction unit to clear blockage, secure manhole cover, and disinfect affected stretch.',
  },
  {
    category: 'Public Safety & Hazards',
    department: 'Disaster & Public Safety Cell',
    baseUrgency: 68,
    keywords: [
      'collapse',
      'fallen tree',
      'tree',
      'fire',
      'gas',
      'hazard',
      'unsafe',
      'danger',
      'dangerous',
      'broken wall',
      'accident',
      'debris',
      'emergency',
    ],
    defaultAction:
      'Cordon off the danger zone immediately and mobilize rapid-response civic safety engineers.',
  },
  {
    category: 'Parks & Public Spaces',
    department: 'Horticulture & Parks Department',
    baseUrgency: 28,
    keywords: [
      'park',
      'playground',
      'bench',
      'swing',
      'garden',
      'walkway',
      'footpath',
      'fountain',
      'grass',
      'pruning',
      'public toilet',
    ],
    defaultAction:
      'Schedule park maintenance inspection to repair civic amenities and clear pathways.',
  },
];

const URGENCY_AMPLIFIERS: Array<{ term: string; boost: number; reason: string }> = [
  { term: 'live wire', boost: 34, reason: 'electrocution risk from exposed live wire' },
  { term: 'sparking', boost: 28, reason: 'active electrical sparking / fire hazard' },
  { term: 'burst', boost: 26, reason: 'active infrastructure rupture causing resource loss' },
  { term: 'open manhole', boost: 32, reason: 'severe fall/fatality risk from uncovered manhole' },
  { term: 'sinkhole', boost: 30, reason: 'structural road collapse risk' },
  { term: 'hospital', boost: 18, reason: 'proximity to emergency healthcare access' },
  { term: 'school', boost: 18, reason: 'high vulnerability near student pedestrian zone' },
  { term: 'highway', boost: 16, reason: 'high-speed traffic accident risk' },
  { term: 'arterial', boost: 14, reason: 'major commuter corridor disruption' },
  { term: 'flooding', boost: 20, reason: 'active flooding threatening commuters and property' },
  { term: 'child', boost: 16, reason: 'direct hazard to children' },
  { term: 'elderly', boost: 14, reason: 'accessibility/safety risk for elderly residents' },
  { term: 'accident', boost: 22, reason: 'reported injuries or collision potential' },
  { term: 'contaminated', boost: 24, reason: 'public health contamination concern' },
  { term: 'overflowing', boost: 12, reason: 'escalating sanitation/spillover spread' },
  { term: 'days', boost: 8, reason: 'prolonged unresolved community impact' },
  { term: 'urgent', boost: 12, reason: 'reporter flagged immediate hazard' },
  { term: 'dangerous', boost: 15, reason: 'explicit public safety risk' },
];

const LOW_PRIORITY_DAMPENERS = ['minor', 'small', 'cosmetic', 'faded', 'peeling', 'slightly', 'routine'];

export function scoreToPriority(score: number): IssuePriority {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export function priorityToSla(priority: IssuePriority): string {
  switch (priority) {
    case 'Critical':
      return '2–4 hours (Emergency Dispatch)';
    case 'High':
      return '24 hours (Priority Queue)';
    case 'Medium':
      return '48–72 hours (Standard SLA)';
    case 'Low':
      return '5–7 business days (Scheduled Maintenance)';
  }
}

export function categoryToDepartment(category: IssueCategory): Department {
  const matched = CATEGORY_RULES.find((rule) => rule.category === category);
  return matched ? matched.department : 'General Municipal Administration';
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

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'near',
  'from',
  'that',
  'this',
  'there',
  'have',
  'been',
  'very',
  'road',
  'street',
  'area',
  'issue',
]);

function extractTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
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
