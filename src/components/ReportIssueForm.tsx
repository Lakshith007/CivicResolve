'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  MapPin,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  type AIAnalysisResult,
  type CivicIssue,
  type SessionUser,
} from '@/types/civic';
import { LocationPickerMap } from '@/components/LocationPickerMap';
import { DemoScenariosBar, type DemoScenario } from '@/components/citizen/DemoScenariosBar';
import {
  AiTriagePreviewCard,
  type DuplicateMatch,
} from '@/components/citizen/AiTriagePreviewCard';
import { PhotoEvidenceField } from '@/components/citizen/PhotoEvidenceField';

async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<{ address: string; zone: string; resolved: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
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
      const resolvedAddress =
        formatted.length >= 3
          ? formatted
          : data.display_name
          ? data.display_name.split(',').slice(0, 3).join(',').trim()
          : `GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      return {
        address: resolvedAddress,
        zone: locality || city || 'GPS Located Zone',
        resolved: true,
      };
    }
  } catch {
    // Offline or reverse-geocoding timed out
  } finally {
    clearTimeout(timer);
  }
  return {
    address: `GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    zone: 'GPS Located Zone',
    resolved: false,
  };
}

interface ReportIssueFormProps {
  currentUser?: SessionUser | null;
  onIssueCreated: (issue: CivicIssue) => void;
  onSwitchToTrack: (ticketId?: string) => void;
  onUpvoteExisting: (id: string) => Promise<void>;
}

/** Citizen issue reporting orchestrator with GPS/map pinning, image compression & Gemini AI triage preview. */
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
  const [coordinates, setCoordinates] = useState({ lat: 11.0168, lng: 76.9558 });
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
  const [showMapPicker, setShowMapPicker] = useState(false);
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

  const resetSecondaryState = () => {
    setGpsStatus('idle');
    setGpsAccuracy(null);
    setGpsMessage(null);
    setShowMapPicker(false);
    setUserCategory('auto');
    setDuplicates([]);
  };

  const applyPreset = (preset: DemoScenario) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setLocation(preset.location);
    setWard(preset.ward);
    setCoordinates(preset.coordinates);
    resetSecondaryState();
    setAnalysis(null);
    setErrorMessage(null);
    setSubmittedTicket(null);
  };

  const handleMapPick = async (coords: { lat: number; lng: number }) => {
    setCoordinates(coords);
    setGpsAccuracy(null);
    setGpsStatus('locating');
    setGpsMessage('Resolving street address for selected map pin...');
    setErrorMessage(null);

    const geo = await reverseGeocodeCoordinates(coords.lat, coords.lng);
    setLocation(geo.address);
    setWard(geo.zone);
    setGpsStatus('locked');
    setGpsMessage(
      geo.resolved ? 'Map pin selected & street address resolved' : 'Map pin coordinates locked'
    );
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

        const geo = await reverseGeocodeCoordinates(lat, lng);
        if (geo.resolved || !location.trim()) setLocation(geo.address);
        setWard(geo.zone);
        setGpsStatus('locked');
        setGpsMessage(
          geo.resolved ? 'Live street address & coordinates resolved via GPS' : 'GPS coordinates locked'
        );
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGpsStatus('error');
        setGpsAccuracy(null);
        if (err.code === 1) {
          setGpsMessage('Location permission denied. Enable browser location access or pick a spot on the map below.');
        } else if (err.code === 3) {
          setGpsMessage('GPS signal timed out. Use Pick on Map or type your location manually.');
        } else {
          setGpsMessage('Unable to detect GPS coordinates right now. Use Pick on Map or type your location manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
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
        body: JSON.stringify({ title, description, location, userCategory, imageBase64: imageUrl }),
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
        setCoordinates({ lat: 11.0168, lng: 76.9558 });
        setImageUrl(undefined);
        resetSecondaryState();
      }
    } catch {
      setErrorMessage('Network error while submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DemoScenariosBar onSelectPreset={applyPreset} />

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
        <form
          onSubmit={handleSubmit}
          className="min-w-0 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-6 lg:col-span-7"
          noValidate
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Report a Civic Issue</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
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

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-extrabold text-blue-800">
                1
              </span>
              <span>Issue Summary</span>
            </div>

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
                className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-500"
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
                className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-extrabold text-blue-800">
                2
              </span>
              <span>Location &amp; Coordinates</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="issue-location" className="block text-sm font-semibold text-slate-800">
                Street / Landmark Location <span className="text-red-600">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapPicker((prev) => !prev)}
                  aria-expanded={showMapPicker}
                  className={`focus-ring inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                    showMapPicker
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span>{showMapPicker ? 'Hide Map Picker' : 'Pick on Map'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={isLocating}
                  className="focus-ring inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-100 disabled:opacity-60"
                >
                  {isLocating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isLocating ? 'Locating Address...' : 'Detect My GPS'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <MapPin
                className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                aria-hidden="true"
              />
              <input
                id="issue-location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Click 'Pick on Map', 'Detect My GPS', or type street / landmark manually..."
                className="focus-ring w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 transition placeholder:text-slate-500"
              />
            </div>

            {showMapPicker && (
              <div className="pt-1">
                <LocationPickerMap coordinates={coordinates} onSelectLocation={handleMapPick} />
              </div>
            )}

            <div aria-live="polite" className="space-y-2">
              {gpsStatus === 'locating' && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                  <span>{gpsMessage}</span>
                </div>
              )}

              {gpsStatus === 'locked' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">
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
                    className="focus-ring inline-flex items-center gap-1 rounded font-semibold text-blue-700 hover:underline"
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
            </div>

            {gpsStatus === 'idle' && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  Coordinates: <strong className="font-mono text-slate-700">{coordinates.lat}, {coordinates.lng}</strong>
                  {ward !== 'Auto-Detected Municipal Zone' ? ` · Zone: ${ward}` : ''}
                </span>
                <span>Auto-resolves street address &amp; locality via high-accuracy GPS</span>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-extrabold text-blue-800">
                3
              </span>
              <span>Category, Contact &amp; Evidence</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="issue-category" className="block text-sm font-semibold text-slate-800">
                  Category (Optional)
                </label>
                <select
                  id="issue-category"
                  value={userCategory}
                  onChange={(e) => setUserCategory(e.target.value)}
                  className="focus-ring mt-1.5 w-full truncate rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-900 sm:text-sm"
                >
                  <option value="auto">Auto-Detect with Gemini AI (Recommended)</option>
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="reporter-name" className="block text-sm font-semibold text-slate-800">
                  Your Name (Optional)
                </label>
                <input
                  id="reporter-name"
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Concerned Citizen"
                  className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
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
                className="focus-ring mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>

          <PhotoEvidenceField
            imageUrl={imageUrl}
            onChangeImage={setImageUrl}
            onError={setErrorMessage}
          />

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || isSubmitting}
              className="focus-ring inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-950 transition hover:border-violet-400 hover:bg-violet-100 disabled:opacity-60"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4 text-violet-700" aria-hidden="true" />
              )}
              <span>{isAnalyzing ? 'Analyzing with Gemini...' : 'Analyze with Gemini AI'}</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isAnalyzing}
              className="focus-ring inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-60"
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

        <AiTriagePreviewCard
          analysis={analysis}
          duplicates={duplicates}
          isAnalyzing={isAnalyzing}
          upvotedDupId={upvotedDupId}
          onUpvoteDuplicate={async (id) => {
            await onUpvoteExisting(id);
            setUpvotedDupId(id);
          }}
        />
      </div>
    </div>
  );
}
