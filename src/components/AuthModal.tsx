'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Lock, Shield, UserPlus, X } from 'lucide-react';
import type { SessionUser } from '@/types/civic';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
}

export function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
      } else if (data.user) {
        onAuthenticated(data.user);
        setPassword('');
        onClose();
      }
    } catch {
      setError('Network error while connecting to authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900">
                {mode === 'login' ? 'Sign In to CivicResolve' : 'Citizen Account Registration'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'login'
                  ? 'Access your personal reports or municipal console'
                  : 'New accounts receive Citizen access by default'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="focus-ring rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`focus-ring flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === 'login' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`focus-ring flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-700'
            }`}
          >
            Register as Citizen
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-800">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Priya Sharma"
                className="focus-ring mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-800">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="focus-ring mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-800">
              Password {mode === 'register' && '(minimum 8 characters)'}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="focus-ring mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : mode === 'login' ? (
              <Lock className="h-4 w-4" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{mode === 'login' ? 'Sign In' : 'Create Citizen Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
