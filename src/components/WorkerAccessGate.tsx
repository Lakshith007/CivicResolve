'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  HardHat,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { SessionUser } from '@/types/civic';

interface WorkerAccessGateProps {
  currentUser: SessionUser | null;
}

const DEMO_CREWS = [
  {
    label: 'Rapid Response Lead (All Divisions)',
    crewUnitId: 'CREW-LEAD',
    passcode: 'Crew@Lead!2026',
  },
  {
    label: 'Electrical Unit E-4 (Electrical Only)',
    crewUnitId: 'CREW-E4',
    passcode: 'Crew@E4!2026',
  },
  {
    label: 'Hydraulic Unit H-2 (Water Works Only)',
    crewUnitId: 'CREW-H2',
    passcode: 'Crew@H2!2026',
  },
];

export function WorkerAccessGate({ currentUser }: WorkerAccessGateProps) {
  const [crewUnitId, setCrewUnitId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/worker-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewUnitId: crewUnitId.trim(),
          passcode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid Crew Unit ID or Dispatch Passcode.');
        return;
      }

      window.location.href = '/worker';
    } catch {
      setError('Network error while connecting to municipal crew authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"
    >
      <section
        aria-labelledby="worker-gate-heading"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-amber-700 to-orange-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <HardHat className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 id="worker-gate-heading" className="text-lg font-extrabold tracking-tight">
                Field Crew Portal Sign-In
              </h1>
              <p className="text-xs text-white/95">
                Authorized Municipal Dispatch Units Only
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {currentUser && currentUser.role === 'CITIZEN' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Your current session ({currentUser.email}) does not hold Field Crew credentials. Sign
              in below with an authorized Crew Unit ID.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="crew-unit-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Crew Unit ID
              </label>
              <input
                id="crew-unit-input"
                type="text"
                required
                value={crewUnitId}
                onChange={(e) => setCrewUnitId(e.target.value)}
                placeholder="e.g. CREW-E4 or CREW-LEAD"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label
                htmlFor="crew-passcode-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Crew Dispatch Passcode
              </label>
              <input
                id="crew-passcode-input"
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* 1-Click Demo Crew Presets */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                <Sparkles className="h-3 w-3 text-amber-600" aria-hidden="true" />
                <span>Quick Fill Authorized Demo Crew:</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEMO_CREWS.map((crew) => (
                  <button
                    key={crew.crewUnitId}
                    type="button"
                    onClick={() => {
                      setCrewUnitId(crew.crewUnitId);
                      setPasscode(crew.passcode);
                      setError(null);
                    }}
                    className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
                  >
                    {crew.crewUnitId}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[11px] text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                <strong>Department Scoped &amp; Plagiarism-Protected:</strong> Each crew unit can
                only post unique, SHA-256 verified completion photos for its assigned municipal
                division.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Verifying Crew Unit...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Sign In to Field Crew Portal</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Return to Role Selection</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
