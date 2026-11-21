'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import type { CivicIssue } from '@/types/civic';
import {
  loadGoogleMapsScript,
  subscribeGoogleMapsAuthFailure,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
} from '@/lib/googleMapsLoader';

interface CivicGoogleMapProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  includeResolved?: boolean;
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
    anchor:
      typeof window !== 'undefined' && window.google?.maps?.Point
        ? new window.google.maps.Point(12, 22)
        : undefined,
  };
}

export function CivicGoogleMap({
  issues,
  selectedIssueId,
  onSelectIssue,
  includeResolved = false,
}: CivicGoogleMapProps) {
  const activeIssues = useMemo(
    () => (includeResolved ? issues : issues.filter((issue) => issue.status !== 'Resolved')),
    [issues, includeResolved]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<Map<string, GoogleMarkerInstance>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

  useEffect(() => {
    let isMounted = true;

    if (!apiKey) {
      setMapError(true);
      return;
    }

    const unsubscribeAuth = subscribeGoogleMapsAuthFailure(() => {
      if (isMounted) setMapError(true);
    });

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!isMounted || !containerRef.current || !window.google?.maps) return;

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center: { lat: 11.0168, lng: 76.9558 }, // Coimbatore Civic Hub
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
      unsubscribeAuth();
    };
  }, [apiKey]);

  // Sync Markers with Issues
  useEffect(() => {
    const maps = window.google?.maps;
    const mapInstance = mapRef.current;
    if (!mapLoaded || !mapInstance || !maps) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const bounds = new maps.LatLngBounds();

    activeIssues.forEach((issue) => {
      const position = { lat: issue.coordinates.lat, lng: issue.coordinates.lng };
      bounds.extend(position);

      const marker = new maps.Marker({
        position,
        map: mapInstance,
        title: `${issue.id}: ${issue.title}`,
        icon: createMarkerIcon(issue.priority),
        animation: issue.id === selectedIssueId ? maps.Animation?.BOUNCE : undefined,
      });

      marker.addListener('click', () => {
        onSelectIssue(issue.id);
      });

      markersRef.current.set(issue.id, marker);
    });

    if (activeIssues.length > 0 && !selectedIssueId) {
      if (activeIssues.length === 1) {
        mapInstance.panTo({
          lat: activeIssues[0].coordinates.lat,
          lng: activeIssues[0].coordinates.lng,
        });
        mapInstance.setZoom(14);
      } else {
        mapInstance.fitBounds(bounds);
      }
    }
  }, [activeIssues, mapLoaded, onSelectIssue, selectedIssueId]);

  // Pan to selected issue
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !selectedIssueId) return;

    const selectedIssue = activeIssues.find((i) => i.id === selectedIssueId);
    if (selectedIssue) {
      mapRef.current.panTo({
        lat: selectedIssue.coordinates.lat,
        lng: selectedIssue.coordinates.lng,
      });
      mapRef.current.setZoom(14);

      markersRef.current.forEach((m, id) => {
        if (id === selectedIssueId) {
          m.setAnimation(window.google?.maps?.Animation?.BOUNCE);
          setTimeout(() => m.setAnimation(null), 1500);
        } else {
          m.setAnimation(null);
        }
      });
    }
  }, [selectedIssueId, activeIssues, mapLoaded]);

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
            <MapPin className="mx-auto mb-1 h-5 w-5 text-amber-400" aria-hidden="true" />
            <p className="font-semibold text-white">Interactive Spatial Grid Active</p>
            <p className="mt-0.5 text-slate-300">Displaying coordinate pins on city ward grid.</p>
          </div>
        </div>
      )}
    </div>
  );
}
