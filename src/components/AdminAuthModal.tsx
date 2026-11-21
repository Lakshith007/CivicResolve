'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { SessionUser } from '@/types/civic';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: (user: SessionUser) => void;
  redirectToAdmin?: boolean;
}

export function AdminAuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  redirectToAdmin = true,
}: AdminAuthModalProps) {
  const [step, setStep] = useState<'credentials' | '2fa' | 'success'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(300);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Timer countdown for OTP expiration
  useEffect(() => {
    if (step !== '2fa' || expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, expiresIn]);

  if (!isOpen) return null;

  const handleFillDemoAdmin = () => {
    setEmail('admin@civicresolve.gov');
    setPassword('CivicAdmin@2026!Secure');
    setError(null);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'credentials',
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
        return;
      }

      if (data.requires2FA) {
        setChallengeId(data.challengeId);
        setMaskedEmail(data.maskedEmail);
        setDemoCode(data.demoCode || '');
        setExpiresIn(data.expiresInSeconds || 300);
        setOtpCode('');
        setStep('2fa');
      } else if (data.user) {
        // Direct access fallback
        setStep('success');
        onAuthenticated?.(data.user);
        setTimeout(() => {
          if (redirectToAdmin) {
            window.location.href = '/admin';
          } else {
            onClose();
          }
        }, 1200);
      }
    } catch {
      setError('Network communication failure. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'verify_2fa',
          challengeId,
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification code failed or expired.');
        return;
      }

      setStep('success');
      onAuthenticated?.(data.user);

      setTimeout(() => {
        if (redirectToAdmin) {
          window.location.href = '/admin';
        } else {
          onClose();
        }
      }, 1200);
    } catch {
      setError('Network error while validating security code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!challengeId) return;
    setIsResending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend_2fa',
          challengeId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.challengeId) setChallengeId(data.challengeId);
        setDemoCode(data.demoCode);
        setExpiresIn(data.expiresInSeconds || 300);
      } else {
        setError(data.error || 'Unable to generate new code. Please restart sign in.');
      }
    } catch {
      setError('Failed to contact verification service.');
    } finally {
      setIsResending(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
        {/* Header Banner */}
        <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/50">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="admin-auth-title" className="text-base font-extrabold tracking-tight text-white">
                    Municipal Administration
                  </h2>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300 ring-1 ring-blue-500/40">
                    Official
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {step === 'credentials'
                    ? 'Step 1 of 2: Administrator Credentials'
                    : step === '2fa'
                    ? 'Step 2 of 2: Municipal 2-Step Verification'
                    : 'Authentication Complete'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Official Municipal Email
                </label>
                <div className="relative mt-1">
                  <Mail
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@civicresolve.gov"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Administrator Password
                </label>
                <div className="relative mt-1">
                  <Lock
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-password-input"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleFillDemoAdmin}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline"
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>Fill Demo Admin Credentials</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Strict RBAC &amp; 2FA Policy</span>
                </div>
                <p className="mt-1">
                  Citizens do not need an account to report or track civic issues. This portal is restricted exclusively to authorized city department administrators.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Verifying Credentials...
                  </span>
                ) : (
                  <span>Verify Credentials &amp; Continue →</span>
                )}
              </button>
            </form>
          )}

          {step === '2fa' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40">
                  <KeyRound className="h-6 w-6 animate-pulse" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-base font-bold text-white">Two-Step Verification</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Enter the 6-digit municipal security code dispatched to{' '}
                  <span className="font-semibold text-slate-200">{maskedEmail}</span>
                </p>
              </div>

              {/* Simulated Government SMS/Email Dispatch Banner */}
              {demoCode && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Simulated Official 2FA Dispatch</span>
                    </div>
                    <span className="rounded bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-200">
                      OTP DEMO
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2">
                    <span className="font-mono text-base font-extrabold tracking-widest text-emerald-400">
                      {demoCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(demoCode)}
                      className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-blue-500"
                    >
                      Auto-fill Code
                    </button>
                  </div>
                </div>
              )}

              {/* 6-Digit Code Input */}
              <div>
                <label
                  htmlFor="admin-otp-input"
                  className="block text-center text-xs font-semibold text-slate-300"
                >
                  Enter 6-Digit Security Code
                </label>
                <div className="mt-2 flex justify-center">
                  <input
                    id="admin-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-56 rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.4em] text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              {/* Countdown & Resend */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  Expires in: <strong className="font-mono text-slate-300">{formatTimer(expiresIn)}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>Resend Code</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleVerify2FA()}
                  disabled={isSubmitting || otpCode.length !== 6 || expiresIn <= 0}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Validating Municipal Token...
                    </span>
                  ) : (
                    <span>Verify &amp; Enter Admin Console</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError(null);
                  }}
                  className="inline-flex w-full items-center justify-center gap-1 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Change administrator account</span>
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white">Administrator Identity Verified</h3>
              <p className="text-xs text-slate-400">
                Two-step municipal authentication successful. Redirecting to Admin Command Center...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
