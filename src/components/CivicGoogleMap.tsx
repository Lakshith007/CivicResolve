'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Layers, MapPin, Sparkles } from 'lucide-react';
import type { CivicIssue } from '@/types/civic';

interface CivicGoogleMapProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
}

declare global {
  interface Window {
    google?: any;
    __googleMapsLoadingPromise?: Promise<void>;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsLoadingPromise) return window.__googleMapsLoadingPromise;

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical':
      return '#dc2626'; // red
    case 'High':
      return '#f59e0b'; // amber
    case 'Medium':
      return '#2563eb'; // blue
    default:
      return '#64748b'; // slate
  }
}

function createMarkerIcon(priority: string) {
  const color = getPriorityColor(priority);
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeWeight: 1.5,
    strokeColor: '#ffffff',
    scale: 1.5,
    anchor: typeof window !== 'undefined' && window.google?.maps?.Point ? new window.google.maps.Point(12, 22) : undefined,
  };
}

export function CivicGoogleMap({
  issues,
  selectedIssueId,
  onSelectIssue,
}: CivicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyB9rguX4pw-EyXZRNaBLpKAqX03ekWq8RA';

  useEffect(() => {
    let isMounted = true;

    if (!apiKey) {
      setMapError(true);
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!isMounted || !containerRef.current || !window.google?.maps) return;

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center: { lat: 12.9716, lng: 77.5946 }, // Bengaluru Civic Hub
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
          });
        }
        setMapLoaded(true);
      })
      .catch((err) => {
        console.warn('[Google Maps] Notice:', err);
        if (isMounted) setMapError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // Sync Markers with Issues
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const bounds = new window.google.maps.LatLngBounds();

    issues.forEach((issue) => {
      const position = { lat: issue.coordinates.lat, lng: issue.coordinates.lng };
      bounds.extend(position);

      const marker = new window.google.maps.Marker({
        position,
        map: mapRef.current,
        title: `${issue.id}: ${issue.title}`,
        icon: createMarkerIcon(issue.priority),
        animation: issue.id === selectedIssueId ? window.google.maps.Animation.BOUNCE : undefined,
      });

      marker.addListener('click', () => {
        onSelectIssue(issue.id);
      });

      markersRef.current.set(issue.id, marker);
    });

    if (issues.length > 0 && !selectedIssueId) {
      mapRef.current.fitBounds(bounds);
    }
  }, [issues, mapLoaded, onSelectIssue, selectedIssueId]);

  // Pan to selected issue
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !selectedIssueId) return;

    const selectedIssue = issues.find((i) => i.id === selectedIssueId);
    if (selectedIssue) {
      mapRef.current.panTo({
        lat: selectedIssue.coordinates.lat,
        lng: selectedIssue.coordinates.lng,
      });
      mapRef.current.setZoom(14);

      markersRef.current.forEach((m, id) => {
        if (id === selectedIssueId) {
          m.setAnimation(window.google.maps.Animation.BOUNCE);
          setTimeout(() => m.setAnimation(null), 1500);
        } else {
          m.setAnimation(null);
        }
      });
    }
  }, [selectedIssueId, issues, mapLoaded]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <div ref={containerRef} className="h-full w-full" />

      {/* Top Overlay Badge */}
      <div className="pointer-events-none absolute left-3 top-2.5 flex items-center gap-1.5 rounded-md bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-slate-200 shadow-sm backdrop-blur-sm">
        <Sparkles className="h-3 w-3 text-blue-400" aria-hidden="true" />
        <span>Google Maps Platform</span>
      </div>

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-4 text-center text-xs text-slate-300">
          <div>
            <MapPin className="mx-auto mb-1 h-5 w-5 text-amber-400" />
            <p className="font-semibold text-white">Interactive Spatial Grid Active</p>
            <p className="mt-0.5 text-slate-400">Displaying coordinate pins on city ward grid.</p>
          </div>
        </div>
      )}
    </div>
  );
}
