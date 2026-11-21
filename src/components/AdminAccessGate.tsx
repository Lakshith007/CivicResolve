'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { AdminAuthModal } from '@/components/AdminAuthModal';
import type { SessionUser } from '@/types/civic';

interface AdminAccessGateProps {
  currentUser: SessionUser | null;
}

export function AdminAccessGate({ currentUser }: AdminAccessGateProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100/80 px-4 py-12"
    >
      <section
        aria-labelledby="access-denied-heading"
        className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 text-center shadow-xl shadow-slate-200/50 sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 ring-1 ring-blue-200/80 shadow-sm">
          <ShieldAlert className="h-7 w-7 text-blue-700" aria-hidden="true" />
        </div>

        <h1 id="access-denied-heading" className="mt-5 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Municipal Official Access Required
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
          {currentUser
            ? `Your session (${currentUser.email}) does not hold municipal administrator privileges.`
            : 'Access to the CivicResolve Admin Command Center is strictly protected by Municipal 2-Step Verification (2FA).'}
        </p>

        <div className="mt-5 rounded-xl border border-amber-200/90 bg-amber-50/70 p-3.5 text-left text-xs leading-relaxed text-amber-950">
          <strong>Citizen Notice:</strong> Citizens do not need an account. You can report civic problems, upload photos, and track repair status directly from the public portal.
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Admin Sign-In (2FA)</span>
          </button>

          <Link
            href="/"
            className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Public Citizen Portal</span>
          </Link>
        </div>
      </section>

      <AdminAuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        redirectToAdmin={true}
      />
    </main>
  );
}
