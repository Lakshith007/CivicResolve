import type { Department, IssueCategory, IssuePriority } from '@/types/civic';

export interface CategoryRule {
  category: IssueCategory;
  department: Department;
  baseUrgency: number;
  keywords: string[];
  defaultAction: string;
}

export const CATEGORY_RULES: CategoryRule[] = [
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

export const URGENCY_AMPLIFIERS: Array<{ term: string; boost: number; reason: string }> = [
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

export const LOW_PRIORITY_DAMPENERS = [
  'minor',
  'small',
  'cosmetic',
  'faded',
  'peeling',
  'slightly',
  'routine',
];

export const DUPLICATE_STOP_WORDS = new Set([
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
