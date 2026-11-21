import type { CivicIssue } from '@/types/civic';

export const INITIAL_COIMBATORE_ISSUES: CivicIssue[] = [
  {
    id: 'CR-2026-1001',
    title: 'Exposed sparking streetlight pole wire outside PSG School Gate',
    description:
      'Streetlight pole #42 on Avinashi Road has broken junction casing with exposed live wire sparking intermittently near the school pedestrian crossing after rain.',
    location: 'Avinashi Road, Peelamedu PSG School Gate',
    ward: 'Ward 07 — Peelamedu & Avinashi Corridor',
    coordinates: { lat: 11.0246, lng: 77.0028 },
    category: 'Streetlights & Electrical',
    priority: 'Critical',
    urgencyScore: 94,
    department: 'Electrical & Streetlighting Division',
    status: 'In Progress',
    reporterName: 'Ananya Krishnan',
    upvotes: 34,
    aiAnalysis: {
      category: 'Streetlights & Electrical',
      priority: 'Critical',
      urgencyScore: 94,
      department: 'Electrical & Streetlighting Division',
      aiSummary:
        'Critical-priority streetlights & electrical issue reported at Avinashi Road, Peelamedu PSG School Gate, routed to Electrical & Streetlighting Division.',
      impactAssessment:
        'Elevated urgency driven by electrocution risk from exposed live wire; active electrical sparking / fire hazard; high vulnerability near student pedestrian zone.',
      suggestedAction:
        'Dispatch electrical maintenance crew to isolate power hazard, inspect pole wiring, and restore illumination.',
      estimatedResolutionSla: '2–4 hours (Emergency Dispatch)',
      confidence: 0.96,
      detectedKeywords: ['streetlight', 'wire', 'sparking', 'live wire', 'school'],
      engine: 'gemini-ai',
    },
    adminNotes: 'Emergency linemen team E-4 dispatched; feeder breaker temporarily isolated.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T06:15:00.000Z',
        note: 'Complaint submitted via Citizen Portal and auto-triaged as Critical.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-21T06:40:00.000Z',
        note: 'Emergency linemen team E-4 dispatched; feeder breaker temporarily isolated.',
        updatedBy: 'Dispatcher Suresh K.',
      },
    ],
    createdAt: '2026-11-21T06:15:00.000Z',
    updatedAt: '2026-11-21T06:40:00.000Z',
  },
  {
    id: 'CR-2026-1002',
    title: 'Major water main burst flooding Coimbatore Medical College GH road',
    description:
      'Pressurized underground drinking water pipeline has burst, sending heavy water flow onto the main ambulance approach road outside Coimbatore Medical College GH and reducing neighborhood pressure.',
    location: 'Trichy Road, Coimbatore Medical College GH Entrance',
    ward: 'Ward 12 — RS Puram & GH Medical Zone',
    coordinates: { lat: 10.9964, lng: 76.9698 },
    category: 'Water Supply & Leakage',
    priority: 'Critical',
    urgencyScore: 91,
    department: 'Water Works & Hydraulic Engineering',
    status: 'Reported',
    reporterName: 'Dr. Karthik Subramanian',
    upvotes: 28,
    aiAnalysis: {
      category: 'Water Supply & Leakage',
      priority: 'Critical',
      urgencyScore: 91,
      department: 'Water Works & Hydraulic Engineering',
      aiSummary:
        'Critical-priority water supply & leakage issue reported at Trichy Road, Coimbatore Medical College GH Entrance, routed to Water Works & Hydraulic Engineering.',
      impactAssessment:
        'Elevated urgency driven by active infrastructure rupture causing resource loss; proximity to emergency healthcare access; active flooding threatening commuters.',
      suggestedAction:
        'Dispatch hydraulic emergency unit to shut isolation valve, repair ruptured pipeline, and check pressure.',
      estimatedResolutionSla: '2–4 hours (Emergency Dispatch)',
      confidence: 0.95,
      detectedKeywords: ['water', 'pipeline', 'burst', 'hospital', 'flooding'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T07:10:00.000Z',
        note: 'Complaint logged and escalated to Hydraulic Engineering Rapid Response.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-21T07:10:00.000Z',
    updatedAt: '2026-11-21T07:10:00.000Z',
  },
  {
    id: 'CR-2026-1003',
    title: 'Deep arterial pothole causing two-wheeler swerves near Gandhipuram Flyover',
    description:
      'A 4-foot wide deep pothole filled with rainwater on the left lane near Gandhipuram 100 Feet Road ramp is forcing two-wheelers to swerve abruptly into fast-moving traffic.',
    location: '100 Feet Road, Gandhipuram Flyover Ramp',
    ward: 'Ward 01 — Gandhipuram Central Core',
    coordinates: { lat: 11.0183, lng: 76.9674 },
    category: 'Potholes & Road Damage',
    priority: 'High',
    urgencyScore: 76,
    department: 'Roads & Bridges Department (PWD)',
    status: 'Reported',
    reporterName: 'Aravindh Natarajan',
    upvotes: 42,
    aiAnalysis: {
      category: 'Potholes & Road Damage',
      priority: 'High',
      urgencyScore: 76,
      department: 'Roads & Bridges Department (PWD)',
      aiSummary:
        'High-priority potholes & road damage issue reported at 100 Feet Road, Gandhipuram Flyover Ramp, routed to Roads & Bridges Department (PWD).',
      impactAssessment:
        'Elevated urgency driven by high-speed traffic accident risk on major commuter ramp.',
      suggestedAction:
        'Place reflective safety barricades immediately and schedule cold-mix/hot-mix asphalt patching crew.',
      estimatedResolutionSla: '24 hours (Priority Queue)',
      confidence: 0.93,
      detectedKeywords: ['pothole', 'road', 'highway', 'traffic'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T05:45:00.000Z',
        note: 'Submitted by commuter; flagged for Priority PWD Road Patching.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-21T05:45:00.000Z',
    updatedAt: '2026-11-21T05:45:00.000Z',
  },
  {
    id: 'CR-2026-1004',
    title: 'Overflowing community garbage bins at Ukkadam Market vegetable wing',
    description:
      'Three municipal waste containers along Oppanakara Street near Ukkadam Market have not been cleared for 2 days, spilling organic waste onto the footpath and creating strong foul odor.',
    location: 'Oppanakara Street, Ukkadam Market Gate',
    ward: 'Ward 04 — Town Hall & Oppanakara Market',
    coordinates: { lat: 10.9905, lng: 76.9606 },
    category: 'Garbage & Sanitation',
    priority: 'High',
    urgencyScore: 64,
    department: 'Solid Waste Management (SWM)',
    status: 'In Progress',
    reporterName: 'Meenakshi Sundaram',
    upvotes: 19,
    aiAnalysis: {
      category: 'Garbage & Sanitation',
      priority: 'High',
      urgencyScore: 64,
      department: 'Solid Waste Management (SWM)',
      aiSummary:
        'High-priority garbage & sanitation issue reported at Oppanakara Street, Ukkadam Market Gate, routed to Solid Waste Management (SWM).',
      impactAssessment:
        'Elevated urgency driven by escalating sanitation/spillover spread and prolonged unresolved community impact.',
      suggestedAction:
        'Assign compactor collection truck for immediate clearance, area sanitization spray, and bin replacement.',
      estimatedResolutionSla: '24 hours (Priority Queue)',
      confidence: 0.91,
      detectedKeywords: ['garbage', 'bin', 'overflowing', 'market', 'days'],
      engine: 'gemini-ai',
    },
    adminNotes: 'SWM Zone-2 compactor route diverted for afternoon clearance.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-20T16:20:00.000Z',
        note: 'Reported by market traders association.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-21T04:50:00.000Z',
        note: 'SWM Zone-2 compactor route diverted for afternoon clearance.',
        updatedBy: 'Sanitation Supervisor',
      },
    ],
    createdAt: '2026-11-20T16:20:00.000Z',
    updatedAt: '2026-11-21T04:50:00.000Z',
  },
  {
    id: 'CR-2026-1005',
    title: 'Blocked stormwater drain causing stagnant sewage near DB Road bus stop',
    description:
      'Plastic debris has choked the stormwater grating near DB Road Junction in RS Puram, causing stagnant greywater backup across the curb.',
    location: 'DB Road, RS Puram Head Post Office Shelter',
    ward: 'Ward 12 — RS Puram & GH Medical Zone',
    coordinates: { lat: 11.0086, lng: 76.9511 },
    category: 'Drainage & Sewage',
    priority: 'Medium',
    urgencyScore: 54,
    department: 'Stormwater & Sewerage Board',
    status: 'Resolved',
    reporterName: 'Vikramaditya R.',
    upvotes: 15,
    aiAnalysis: {
      category: 'Drainage & Sewage',
      priority: 'Medium',
      urgencyScore: 54,
      department: 'Stormwater & Sewerage Board',
      aiSummary:
        'Medium-priority drainage & sewage issue reported at DB Road, RS Puram Head Post Office Shelter, routed to Stormwater & Sewerage Board.',
      impactAssessment:
        'Standard municipal impact affecting commuter access and local hygiene.',
      suggestedAction:
        'Deploy jetting/suction unit to clear blockage, secure manhole cover, and disinfect affected stretch.',
      estimatedResolutionSla: '48–72 hours (Standard SLA)',
      confidence: 0.89,
      detectedKeywords: ['drain', 'stormwater', 'sewage', 'stagnant'],
      engine: 'gemini-ai',
    },
    adminNotes: 'Desilting complete and anti-larval spray applied on Nov 21.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-19T11:00:00.000Z',
        note: 'Issue logged and assigned to Stormwater & Sewerage Board.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-20T09:15:00.000Z',
        note: 'Jetting crew deployed for silt and plastic extraction.',
        updatedBy: 'Ward 12 Engineer',
      },
      {
        status: 'Resolved',
        timestamp: '2026-11-21T03:30:00.000Z',
        note: 'Desilting complete and anti-larval spray applied on Nov 21.',
        updatedBy: 'Ward 12 Engineer',
      },
    ],
    createdAt: '2026-11-19T11:00:00.000Z',
    updatedAt: '2026-11-21T03:30:00.000Z',
  },
  {
    id: 'CR-2026-1006',
    title: 'Broken wooden park bench and uneven paver tiles on Race Course walkway',
    description:
      'Two concrete paver slabs along the Thomas Park walking track on Race Course Road have settled slightly, and a bench slat is broken.',
    location: 'Race Course Road, Thomas Park Walking Loop',
    ward: 'Ward 15 — Race Course & VOC Park Belt',
    coordinates: { lat: 11.0018, lng: 76.9762 },
    category: 'Parks & Public Spaces',
    priority: 'Low',
    urgencyScore: 26,
    department: 'Horticulture & Parks Department',
    status: 'Reported',
    reporterName: 'Priya Venkatesh',
    upvotes: 6,
    aiAnalysis: {
      category: 'Parks & Public Spaces',
      priority: 'Low',
      urgencyScore: 26,
      department: 'Horticulture & Parks Department',
      aiSummary:
        'Low-priority parks & public spaces issue reported at Race Course Road, Thomas Park Walking Loop, routed to Horticulture & Parks Department.',
      impactAssessment:
        'Localized recreational amenity wear with low immediate safety risk.',
      suggestedAction:
        'Schedule park maintenance inspection to repair civic amenities and level walkway pavers.',
      estimatedResolutionSla: '5–7 business days (Scheduled Maintenance)',
      confidence: 0.87,
      detectedKeywords: ['park', 'bench', 'walkway'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-20T14:05:00.000Z',
        note: 'Logged into scheduled Parks maintenance queue.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-20T14:05:00.000Z',
    updatedAt: '2026-11-20T14:05:00.000Z',
  },
];
