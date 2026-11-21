import { beforeEach, describe, expect, it } from 'vitest';
import { classifyWithHeuristic, findPotentialDuplicates } from '@/lib/aiClassifier';
import {
  createIssue,
  getAllIssues,
  getDashboardStats,
  resetIssueStoreForTesting,
  updateIssueStatus,
  upvoteIssue,
} from '@/lib/issueStore';
import { sanitizeText, validateIssueSubmission, validateStatusUpdate } from '@/lib/validation';

describe('CivicResolve AI Classifier (Heuristic & Fallback)', () => {
  it('classifies road and pothole complaints to Roads & Bridges Department', () => {
    const result = classifyWithHeuristic({
      title: 'Deep pothole near main highway junction',
      description: 'Large crater on the asphalt pavement is damaging commuter cars.',
      location: 'Outer Ring Road Junction',
    });

    expect(result.category).toBe('Potholes & Road Damage');
    expect(result.department).toBe('Roads & Bridges Department (PWD)');
    expect(['High', 'Critical']).toContain(result.priority);
    expect(result.urgencyScore).toBeGreaterThanOrEqual(60);
    expect(result.engine).toBe('smart-civic-fallback');
  });

  it('elevates sparking streetlight near a school to Critical priority', () => {
    const result = classifyWithHeuristic({
      title: 'Sparking streetlight pole with exposed live wire',
      description: 'An exposed electrical cable is sparking right outside St. Paul school gate.',
      location: 'School Avenue',
    });

    expect(result.category).toBe('Streetlights & Electrical');
    expect(result.department).toBe('Electrical & Streetlighting Division');
    expect(result.priority).toBe('Critical');
    expect(result.urgencyScore).toBeGreaterThanOrEqual(80);
  });

  it('routes water pipe bursts, garbage overflow, and blocked drains accurately', () => {
    const water = classifyWithHeuristic({
      title: 'Burst drinking water pipeline flooding street',
      description: 'Clean water main burst near hospital gate.',
    });
    expect(water.category).toBe('Water Supply & Leakage');
    expect(water.department).toBe('Water Works & Hydraulic Engineering');

    const garbage = classifyWithHeuristic({
      title: 'Overflowing garbage dump bin at central market',
      description: 'Trash has been overflowing on the market sidewalk for 3 days.',
    });
    expect(garbage.category).toBe('Garbage & Sanitation');
    expect(garbage.department).toBe('Solid Waste Management (SWM)');

    const drain = classifyWithHeuristic({
      title: 'Clogged stormwater drainage and open manhole',
      description: 'Sewage waterlogging near residential lane.',
    });
    expect(drain.category).toBe('Drainage & Sewage');
    expect(drain.department).toBe('Stormwater & Sewerage Board');
  });
});

describe('Input Validation & Sanitization', () => {
  it('strips HTML/script tags cleanly', () => {
    const cleaned = sanitizeText('  <script>alert(1)</script>Broken <b>pipe</b> near park  ');
    expect(cleaned).toBe('Broken pipe near park');
  });

  it('rejects incomplete issue submissions and accepts valid sanitized payloads', () => {
    const bad = validateIssueSubmission({
      title: 'Hi',
      description: 'Short',
      location: 'A',
    });
    expect(bad.valid).toBe(false);

    const good = validateIssueSubmission({
      title: '<script>x</script>Broken water main on 4th Cross',
      description: 'Water has been gushing out continuously since morning.',
      location: 'Avinashi Road, Peelamedu',
      ward: 'Ward 07 — Peelamedu & Avinashi Corridor',
      reporterName: 'Rakesh',
    });
    expect(good.valid).toBe(true);
    if (good.valid) {
      expect(good.data.title).toBe('Broken water main on 4th Cross');
      expect(good.data.reporterName).toBe('Rakesh');
    }
  });

  it('validates admin status updates strictly', () => {
    const invalid = validateStatusUpdate({ status: 'Archived' });
    expect(invalid.valid).toBe(false);

    const valid = validateStatusUpdate({
      status: 'In Progress',
      priority: 'Critical',
      adminNotes: 'Crew dispatched to site.',
    });
    expect(valid.valid).toBe(true);
  });
});

describe('Duplicate Detection & Issue Store Lifecycle', () => {
  beforeEach(() => {
    resetIssueStoreForTesting();
  });

  it('detects active duplicate reports in matching location and category while ignoring resolved tickets', () => {
    const existing = getAllIssues();

    // Matches CR-2026-1002 (Water Supply & Leakage at Coimbatore Medical College GH Entrance, Reported)
    const waterMatches = findPotentialDuplicates(
      {
        title: 'Water pipeline burst outside Coimbatore Medical College GH',
        description: 'Heavy water leakage flooding hospital entrance road.',
        location: 'Coimbatore Medical College GH Trichy Road',
        category: 'Water Supply & Leakage',
      },
      existing
    );
    expect(waterMatches.some((m) => m.id === 'CR-2026-1002')).toBe(true);

    // Should NOT match CR-2026-1005 because it is already Resolved
    const resolvedMatches = findPotentialDuplicates(
      {
        title: 'Blocked stormwater drain near DB Road RS Puram',
        description: 'Stagnant sewage backup at bus shelter.',
        location: 'DB Road RS Puram Post Office Shelter',
        category: 'Drainage & Sewage',
      },
      existing
    );
    expect(resolvedMatches.some((m) => m.id === 'CR-2026-1005')).toBe(false);
  });

  it('supports end-to-end creation, upvoting, and progression from Reported -> In Progress -> Resolved', () => {
    const initialCount = getAllIssues().length;

    const created = createIssue({
      title: 'Deep pothole near Community Library',
      description: 'Asphalt collapsed creating a dangerous crater for cyclists.',
      location: 'Library Main Road',
      ward: 'Ward 01 — Gandhipuram Central Core',
      coordinates: { lat: 11.0168, lng: 76.9558 },
      reporterName: 'Test Citizen',
    });

    expect(created.id).toMatch(/^CR-2026-\d+$/);
    expect(created.status).toBe('Reported');
    expect(created.statusHistory).toHaveLength(1);
    expect(getAllIssues().length).toBe(initialCount + 1);

    const upvoted = upvoteIssue(created.id);
    expect(upvoted?.upvotes).toBe(2);

    const inProgress = updateIssueStatus(created.id, {
      status: 'In Progress',
      adminNotes: 'PWD crew dispatched with asphalt cold-mix.',
      updatedBy: 'Admin Lead',
    });
    expect(inProgress?.status).toBe('In Progress');
    expect(inProgress?.statusHistory).toHaveLength(2);

    const resolved = updateIssueStatus(created.id, {
      status: 'Resolved',
      adminNotes: 'Pothole patched and road reopened.',
      updatedBy: 'Admin Lead',
    });
    expect(resolved?.status).toBe('Resolved');
    expect(resolved?.statusHistory).toHaveLength(3);

    const stats = getDashboardStats();
    expect(stats.total).toBe(initialCount + 1);
    expect(stats.resolved).toBeGreaterThanOrEqual(2);
  });
});
