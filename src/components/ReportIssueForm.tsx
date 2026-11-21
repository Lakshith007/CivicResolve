'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  Upload,
  X,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  WARDS,
  type AIAnalysisResult,
  type CivicIssue,
  type IssuePriority,
  type IssueStatus,
  type SessionUser,
} from '@/types/civic';
import { EngineBadge, PriorityBadge } from '@/components/CivicBadges';

interface DuplicateMatch {
  id: string;
  title: string;
  location: string;
  status: IssueStatus;
  priority: IssuePriority;
  upvotes: number;
}

interface ReportIssueFormProps {
  currentUser?: SessionUser | null;
  onIssueCreated: (issue: CivicIssue) => void;
  onSwitchToTrack: (ticketId?: string) => void;
  onUpvoteExisting: (id: string) => Promise<void>;
}

const DEMO_PRESETS = [
  {
    label: 'Burst Water Main near Hospital',
    title: 'Pressurized water main burst flooding Emergency Gate',
    description:
      'Clean drinking water pipeline ruptured beneath the pavement, flooding the ambulance lane outside District Hospital and dropping local water pressure.',
    location: 'Hospital Main Road, Gate 2',
    ward: WARDS[3],
    coordinates: { lat: 12.9635, lng: 77.5742 },
  },
  {
    label: 'Live Sparking Streetlight Wire',
    title: 'Sparking streetlight pole with exposed live wire near school',
    description:
      'Streetlight pole #18 junction box is broken open and sparking loudly right beside the primary school pedestrian crossing.',
    location: 'Vidya Mandir Cross, 12th Main',
    ward: WARDS[2],
    coordinates: { lat: 12.9784, lng: 77.6408 },
  },
  {
    label: 'Deep Highway Pothole',
    title: 'Deep crater pothole on outer ring highway ramp',
    description:
      'A 3-foot wide deep asphalt pothole filled with rainwater is causing sudden swerves and near-accidents for commuters on the highway ramp.',
    location: 'Ring Road Eastbound Flyover Ramp',
    ward: WARDS[5],
    coordinates: { lat: 12.9177, lng: 77.6238 },
  },
  {
    label: 'Overflowing Market Garbage',
    title: 'Overflowing municipal garbage bins at Central Market',
    description:
      'Two large community waste containers have been overflowing for 3 days, blocking the footpath with rotting vegetable waste and strong odor.',
    location: 'Central Market North Arcade',
    ward: WARDS[1],
    coordinates: { lat: 12.9652, lng: 77.5795 },
  },
];

function createSamplePngDataUri(label: string, accent: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, 24, 592, 312);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 592, 312);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FIELD PHOTO', 320, 160);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px sans-serif';
  ctx.fillText(label, 320, 210);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText('CivicResolve Verified PNG Preview', 320, 250);

  return canvas.toDataURL('image/png');
}

export function ReportIssueForm({
  currentUser,
  onIssueCreated,
  onSwitchToTrack,
  onUpvoteExisting,
}: ReportIssueFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [ward, setWard] = useState<string>('Auto-Detected Municipal Zone');
  const [coordinates, setCoordinates] = useState({ lat: 12.9716, lng: 77.5946 });
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'locked' | 'error'>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [userCategory, setUserCategory] = useState('auto');
  const [reporterName, setReporterName] = useState(currentUser?.name ?? '');
  const [reporterContact, setReporterContact] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<CivicIssue | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [upvotedDupId, setUpvotedDupId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.name && !reporterName.trim()) {
      setReporterName(currentUser.name);
    }
  }, [currentUser, reporterName]);

  const handleCopyTicketId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const applyPreset = (preset: (typeof DEMO_PRESETS)[number]) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setLocation(preset.location);
    setWard(preset.ward);
    setCoordinates(preset.coordinates);
    setGpsStatus('idle');
    setGpsAccuracy(null);
    setGpsMessage(null);
    setUserCategory('auto');
    setAnalysis(null);
    setDuplicates([]);
    setErrorMessage(null);
    setSubmittedTicket(null);
  };

  const handleDetectGps = () => {
    setIsLocating(true);
    setGpsStatus('locating');
    setGpsMessage('Acquiring high-accuracy GPS signal & resolving street address...');
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setIsLocating(false);
      setGpsStatus('error');
      setGpsMessage('GPS geolocation is not supported in this browser. Please enter your street or landmark manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const accuracy = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;

        setCoordinates({ lat, lng });
        setGpsAccuracy(accuracy);

        // Reverse-geocode live GPS coordinates to a real street & locality address
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
              lat
            )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
            {
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            }
          );

          if (res.ok) {
            const data = (await res.json()) as {
              display_name?: string;
              address?: Record<string, string | undefined>;
            };
            const addr = data.address || {};
            const street =
              [addr.house_number, addr.road || addr.pedestrian || addr.amenity || addr.building]
                .filter(Boolean)
                .join(' ') || '';
            const locality =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city_district ||
              addr.quarter ||
              addr.village ||
              addr.town ||
              '';
            const city = addr.city || addr.town || addr.state_district || '';

            const formatted = [street, locality, city].filter(Boolean).join(', ');
            if (formatted.length >= 3) {
              setLocation(formatted);
            } else if (data.display_name) {
              setLocation(data.display_name.split(',').slice(0, 3).join(',').trim());
            } else {
              setLocation(`GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            }

            setWard(locality || city || 'GPS Located Zone');
            setGpsStatus('locked');
            setGpsMessage('Live street address & coordinates resolved via GPS');
            return;
          }
        } catch {
          // Reverse-geocoding unavailable or timed out; keep exact GPS coordinates cleanly
        } finally {
          clearTimeout(timer);
          setIsLocating(false);
        }

        if (!location.trim()) {
          setLocation(`GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        setWard('GPS Located Zone');
        setGpsStatus('locked');
        setGpsMessage('GPS coordinates locked');
      },
      (err) => {
        setIsLocating(false);
        setGpsStatus('error');
        setGpsAccuracy(null);
        if (err.code === 1) {
          setGpsMessage(
            'Location permission denied. Enable browser location access or type your street/landmark manually.'
          );
        } else if (err.code === 3) {
          setGpsMessage('GPS signal timed out. Move near an open area or type your location manually.');
        } else {
          setGpsMessage('Unable to detect GPS coordinates right now. Please type your location manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Only PNG, JPEG, or WebP images are permitted.');
      return;
    }
    if (file.size > 1_400_000) {
      setErrorMessage('Please upload an image smaller than 1.4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setErrorMessage(null);
    if (title.trim().length < 5 || description.trim().length < 10) {
      setErrorMessage('Enter a descriptive title (5+ chars) and description (10+ chars) to run AI triage.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          location,
          userCategory,
          imageBase64: imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to analyze issue.');
      } else {
        setAnalysis(data.analysis);
        setDuplicates(data.duplicates || []);
      }
    } catch {
      setErrorMessage('Network error while contacting Gemini triage endpoint.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSubmittedTicket(null);

    if (title.trim().length < 5 || description.trim().length < 10 || location.trim().length < 3) {
      setErrorMessage('Please fill in Title (5+ chars), Description (10+ chars), and Location (3+ chars).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          location,
          ward,
          coordinates,
          userCategory,
          imageUrl,
          reporterName: reporterName.trim() || 'Concerned Citizen',
          reporterContact: reporterContact.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit civic issue.');
      } else {
        setSubmittedTicket(data.issue);
        setAnalysis(data.issue.aiAnalysis);
        onIssueCreated(data.issue);
        setTitle('');
        setDescription('');
        setLocation('');
        setWard('Auto-Detected Municipal Zone');
        setGpsStatus('idle');
        setGpsAccuracy(null);
        setGpsMessage(null);
        setImageUrl(undefined);
        setDuplicates([]);
      }
    } catch {
      setErrorMessage('Network error while submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Demo Presets */}
      <section
        aria-label="Quick demo complaint presets"
        className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-blue-950">
              1-Click Demo Scenarios (Pre-fill &amp; Test AI Classification)
            </h2>
          </div>
          <span className="text-xs text-blue-700">Click any scenario to auto-fill</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="focus-ring rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {submittedTicket && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold">
                Issue Logged Successfully — Ticket {submittedTicket.id}
              </h3>
              <p className="mt-1 text-sm text-emerald-900">
                Routed to <strong>{submittedTicket.department}</strong> as{' '}
                <strong>{submittedTicket.priority}</strong> priority (Urgency Score{' '}
                {submittedTicket.urgencyScore}/100).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyTicketId(submittedTicket.id)}
              className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              {copiedId ? (
                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedId ? 'Copied!' : 'Copy Ticket ID'}</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchToTrack(submittedTicket.id)}
              className="focus-ring shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Track Live Status
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Citizen Report Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7"
          noValidate
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900">Report a Civic Issue</h2>
            <p className="mt-1 text-sm text-slate-600">
              Describe the problem below. Google Gemini AI will automatically detect the category,
              urgency level, and responsible municipal department.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="issue-title" className="block text-sm font-semibold text-slate-800">
              Issue Title <span className="text-red-600">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setAnalysis(null);
              }}
              placeholder="e.g., Large pothole near Main Market bus stop"
              className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="issue-description" className="block text-sm font-semibold text-slate-800">
              Detailed Description <span className="text-red-600">*</span>
            </label>
            <textarea
              id="issue-description"
              required
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setAnalysis(null);
              }}
              placeholder="Describe what happened, how long it has persisted, and any safety risks to pedestrians, vehicles, or nearby facilities..."
              className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="issue-location" className="block text-sm font-semibold text-slate-800">
                Street / Landmark Location <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={isLocating}
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-60"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isLocating ? 'Locating Address...' : 'Detect My GPS'}</span>
              </button>
            </div>

            <div className="relative">
              <MapPin
                className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="issue-location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Click 'Detect My GPS' to auto-fill street address, or type landmark manually..."
                className="focus-ring w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Live GPS Verification Strip */}
            {gpsStatus === 'locating' && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                <span>{gpsMessage}</span>
              </div>
            )}

            {gpsStatus === 'locked' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    GPS Locked{gpsAccuracy ? ` (±${gpsAccuracy}m)` : ''}
                  </span>
                  <span className="font-medium">{gpsMessage}</span>
                  <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-emerald-200">
                    {coordinates.lat}, {coordinates.lng}
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                >
                  <span>Verify Pin on Maps</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            )}

            {gpsStatus === 'error' && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{gpsMessage}</span>
              </div>
            )}

            {gpsStatus === 'idle' && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  Coordinates: <strong className="font-mono text-slate-700">{coordinates.lat}, {coordinates.lng}</strong>
                  {ward !== 'Auto-Detected Municipal Zone' ? ` · Zone: ${ward}` : ''}
                </span>
                <span>Auto-resolves street address &amp; locality via high-accuracy GPS</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="issue-category" className="block text-sm font-semibold text-slate-800">
                Category (Optional)
              </label>
              <select
                id="issue-category"
                value={userCategory}
                onChange={(e) => setUserCategory(e.target.value)}
                className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="auto">Auto-Detect with Gemini AI (Recommended)</option>
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reporter-name" className="block text-sm font-semibold text-slate-800">
                Your Name (Optional)
              </label>
              <input
                id="reporter-name"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Concerned Citizen"
                className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reporter-contact" className="block text-sm font-semibold text-slate-800">
              Email or Phone for Updates (Optional)
            </label>
            <input
              id="reporter-contact"
              type="text"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              placeholder="citizen@example.com or +91 98xxx xxxxx"
              className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Photo Attachment */}
          <div>
            <span className="block text-sm font-semibold text-slate-800">
              Evidence Photo (Optional)
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50">
                <Upload className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const png = createSamplePngDataUri('Road Damage Evidence #01', '#f59e0b');
                  if (png) setImageUrl(png);
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Attach Sample Photo</span>
              </button>
            </div>

            {imageUrl && (
              <div className="relative mt-3 inline-block overflow-hidden rounded-xl border border-slate-200">
                <img
                  src={imageUrl}
                  alt="Uploaded civic issue preview"
                  className="h-32 w-56 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  aria-label="Remove attached photo"
                  className="focus-ring absolute right-2 top-2 rounded-full bg-slate-900/80 p-1 text-white hover:bg-slate-900"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || isSubmitting}
              className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:opacity-60"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isAnalyzing ? 'Analyzing with Gemini...' : 'Analyze with Gemini AI'}</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isAnalyzing}
              className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSubmitting ? 'Submitting & Routing...' : 'Submit Civic Report'}</span>
            </button>
          </div>
        </form>

        {/* Live AI Preview & Duplicate Guard */}
        <aside className="space-y-5 lg:col-span-5" aria-label="AI Classification Preview">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">AI Triage Preview</h2>
                  <p className="text-xs text-slate-500">Powered by Google Gemini</p>
                </div>
              </div>
              {analysis && <EngineBadge engine={analysis.engine} />}
            </div>

            {!analysis ? (
              <div className="py-10 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  No AI preview generated yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Select a 1-click preset or fill out the complaint, then click{' '}
                  <strong>Analyze with Gemini AI</strong> to inspect category, priority, urgency
                  score, and department routing before submitting.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PriorityBadge priority={analysis.priority} />
                  <span className="text-xs font-semibold text-slate-600">
                    AI Confidence: {Math.round(analysis.confidence * 100)}%
                  </span>
                </div>

                {/* Urgency Score Meter */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">Public Urgency Score</span>
                    <span className="text-slate-900">{analysis.urgencyScore} / 100</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        analysis.urgencyScore >= 80
                          ? 'bg-red-600'
                          : analysis.urgencyScore >= 60
                            ? 'bg-amber-500'
                            : analysis.urgencyScore >= 35
                              ? 'bg-blue-600'
                              : 'bg-slate-500'
                      }`}
                      style={{ width: `${analysis.urgencyScore}%` }}
                    />
                  </div>
                </div>

                <dl className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">
                      Detected Category
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-slate-900">{analysis.category}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">
                      Recommended Department
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-blue-900">
                      {analysis.department}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">
                      Target Resolution SLA
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-800">
                      {analysis.estimatedResolutionSla}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-2.5 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">AI Summary: </span>
                    {analysis.aiSummary}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Impact Assessment: </span>
                    {analysis.impactAssessment}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Suggested Crew Action: </span>
                    {analysis.suggestedAction}
                  </div>
                </div>

                {analysis.detectedKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {analysis.detectedKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duplicate Guard */}
          {duplicates.length > 0 && (
            <div
              role="region"
              aria-label="Potential duplicate complaints"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Similar Active Issue Nearby ({duplicates.length})
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-900">
                    Upvote an existing ticket to boost dispatch urgency instead of creating a
                    duplicate.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <span>{dup.id}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          {dup.status}
                        </span>
                      </div>
                      <p className="truncate text-xs font-medium text-slate-700">{dup.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{dup.location}</p>
                    </div>
                    <button
                      type="button"
                      disabled={upvotedDupId === dup.id}
                      onClick={async () => {
                        await onUpvoteExisting(dup.id);
                        setUpvotedDupId(dup.id);
                      }}
                      className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-60"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{upvotedDupId === dup.id ? 'Boosted' : '+1 Boost'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
