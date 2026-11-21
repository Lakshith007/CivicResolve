'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationPickerMapProps {
  coordinates: Coordinates;
  onSelectLocation: (coords: Coordinates) => void;
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

export function LocationPickerMap({
  coordinates,
  onSelectLocation,
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelectLocation);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [manualLat, setManualLat] = useState(String(coordinates.lat));
  const [manualLng, setManualLng] = useState(String(coordinates.lng));

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    setManualLat(String(coordinates.lat));
    setManualLng(String(coordinates.lng));
  }, [coordinates.lat, coordinates.lng]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

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
          const initialPos = { lat: coordinates.lat, lng: coordinates.lng };
          const map = new window.google.maps.Map(containerRef.current, {
            center: initialPos,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: 'greedy',
          });

          const marker = new window.google.maps.Marker({
            position: initialPos,
            map,
            draggable: true,
            title: 'Drag or click map to set issue location',
            animation: window.google.maps.Animation?.DROP,
          });

          map.addListener('click', (e: any) => {
            if (!e?.latLng) return;
            const lat = Number(e.latLng.lat().toFixed(5));
            const lng = Number(e.latLng.lng().toFixed(5));
            marker.setPosition({ lat, lng });
            onSelectRef.current({ lat, lng });
          });

          marker.addListener('dragend', (e: any) => {
            if (!e?.latLng) return;
            const lat = Number(e.latLng.lat().toFixed(5));
            const lng = Number(e.latLng.lng().toFixed(5));
            onSelectRef.current({ lat, lng });
          });

          mapRef.current = map;
          markerRef.current = marker;
        }

        if (isMounted) {
          setMapLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('[LocationPickerMap] Notice:', err);
        if (isMounted) setMapError(true);
      });

    return () => {
      isMounted = false;
      if (window.google?.maps?.event) {
        if (markerRef.current) {
          window.google.maps.event.clearInstanceListeners(markerRef.current);
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        if (mapRef.current) {
          window.google.maps.event.clearInstanceListeners(mapRef.current);
          mapRef.current = null;
        }
      }
    };
    // Initial mount setup only; external coordinate updates sync via effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Sync marker & center when external coordinates change (e.g., Detect My GPS or Presets)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !markerRef.current) return;
    const nextPos = { lat: coordinates.lat, lng: coordinates.lng };
    markerRef.current.setPosition(nextPos);
    mapRef.current.panTo(nextPos);
  }, [mapLoaded, coordinates.lat, coordinates.lng]);

  const handleApplyManual = () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return;
    }
    onSelectLocation({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
    });
  };

  if (mapError) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          <span>Interactive Map Unavailable — Enter Pin Coordinates Directly</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Configure <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to
          enable interactive map clicking, or enter custom GPS coordinates below.
        </p>
        <div className="mt-2.5 flex flex-wrap items-end gap-2">
          <div className="min-w-[110px] flex-1">
            <label htmlFor="manual-lat" className="block text-[10px] font-semibold text-slate-600">
              Latitude (-90 to 90)
            </label>
            <input
              id="manual-lat"
              type="number"
              step="0.00001"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="min-w-[110px] flex-1">
            <label htmlFor="manual-lng" className="block text-[10px] font-semibold text-slate-600">
              Longitude (-180 to 180)
            </label>
            <input
              id="manual-lng"
              type="number"
              step="0.00001"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyManual}
            className="focus-ring rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Apply Coordinates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner">
      {!mapLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-100 text-xs font-medium text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-blue-700" aria-hidden="true" />
          <span>Loading interactive Google Map picker...</span>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" aria-label="Interactive issue location map" />

      {/* Compact Floating Instruction Badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
        <Navigation className="h-3 w-3 text-blue-700" aria-hidden="true" />
        <span>Click anywhere on the map or drag the pin to select the exact issue spot</span>
      </div>
    </div>
  );
}
