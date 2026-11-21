'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { WARDS } from '@/types/civic';

export interface DemoScenario {
  label: string;
  title: string;
  description: string;
  location: string;
  ward: string;
  coordinates: { lat: number; lng: number };
}

export const DEMO_PRESETS: readonly DemoScenario[] = [
  {
    label: 'Burst Water Main near GH',
    title: 'Pressurized water main burst flooding Coimbatore GH Gate',
    description:
      'Clean drinking water pipeline ruptured beneath the pavement, flooding the ambulance lane outside Coimbatore Medical College Hospital and dropping local water pressure.',
    location: 'Trichy Road, Coimbatore Medical College GH Gate',
    ward: WARDS[3],
    coordinates: { lat: 10.9964, lng: 76.9698 },
  },
  {
    label: 'Live Sparking Streetlight Wire',
    title: 'Sparking streetlight pole with exposed live wire near school',
    description:
      'Streetlight pole #18 junction box on Avinashi Road is broken open and sparking loudly right beside the school pedestrian crossing.',
    location: 'Avinashi Road, Peelamedu PSG School Cross',
    ward: WARDS[2],
    coordinates: { lat: 11.0246, lng: 77.0028 },
  },
  {
    label: 'Deep Flyover Pothole',
    title: 'Deep crater pothole on Gandhipuram Flyover ramp',
    description:
      'A 3-foot wide deep asphalt pothole filled with rainwater is causing sudden swerves and near-accidents for commuters near 100 Feet Road.',
    location: '100 Feet Road, Gandhipuram Flyover Ramp',
    ward: WARDS[0],
    coordinates: { lat: 11.0183, lng: 76.9674 },
  },
  {
    label: 'Overflowing Ukkadam Market Bins',
    title: 'Overflowing municipal garbage bins at Ukkadam Market',
    description:
      'Two large community waste containers along Oppanakara Street have been overflowing for 3 days, blocking the footpath with rotting vegetable waste.',
    location: 'Oppanakara Street, Ukkadam Market Arcade',
    ward: WARDS[1],
    coordinates: { lat: 10.9905, lng: 76.9606 },
  },
];

interface DemoScenariosBarProps {
  onSelectPreset: (preset: DemoScenario) => void;
}

/** 1-click Coimbatore civic complaint presets for quick AI triage demos. */
export function DemoScenariosBar({ onSelectPreset }: DemoScenariosBarProps) {
  return (
    <section
      aria-label="Quick demo complaint presets"
      className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-blue-950">
            1-Click Demo Scenarios (Pre-fill &amp; Test AI Classification)
          </h2>
        </div>
        <span className="text-xs font-medium text-blue-800">Click any scenario to auto-fill</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className="focus-ring min-h-[38px] rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </section>
  );
}
