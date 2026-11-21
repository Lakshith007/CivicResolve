export interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleMapsMouseEvent {
  latLng?: {
    lat: () => number;
    lng: () => number;
  };
}

export interface GoogleMapInstance {
  panTo: (latLng: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBoundsInstance) => void;
  addListener: (eventName: string, handler: (event: GoogleMapsMouseEvent) => void) => void;
}

export interface GoogleMarkerInstance {
  setMap: (map: GoogleMapInstance | null) => void;
  setPosition: (latLng: GoogleLatLngLiteral) => void;
  setAnimation: (animation: unknown) => void;
  addListener: (eventName: string, handler: (event: GoogleMapsMouseEvent) => void) => void;
}

export interface GoogleLatLngBoundsInstance {
  extend: (latLng: GoogleLatLngLiteral) => void;
}

export interface GoogleMapsNamespace {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
  LatLngBounds: new () => GoogleLatLngBoundsInstance;
  Point: new (x: number, y: number) => unknown;
  Animation?: {
    BOUNCE?: unknown;
    DROP?: unknown;
  };
  event?: {
    clearInstanceListeners: (instance: object) => void;
  };
  importLibrary?: (name: string) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace;
    };
    gm_authFailure?: () => void;
    __googleMapsLoadingPromise?: Promise<void>;
    __googleMapsAuthFailed?: boolean;
    __googleMapsAuthFailureListeners?: Set<() => void>;
  }
}

function registerAuthFailureInterceptor(onImmediateFail?: () => void): void {
  if (typeof window === 'undefined') return;
  if (!window.__googleMapsAuthFailureListeners) {
    window.__googleMapsAuthFailureListeners = new Set();
  }

  const prevHandler = window.gm_authFailure;
  if (!(prevHandler as { __civicWrapped?: boolean } | undefined)?.__civicWrapped) {
    const wrapped = () => {
      window.__googleMapsAuthFailed = true;
      window.__googleMapsLoadingPromise = undefined;
      window.__googleMapsAuthFailureListeners?.forEach((listener) => {
        try {
          listener();
        } catch {
          // Ignore subscriber errors
        }
      });
      if (typeof prevHandler === 'function') {
        prevHandler();
      }
    };
    (wrapped as { __civicWrapped?: boolean }).__civicWrapped = true;
    window.gm_authFailure = wrapped;
  }

  if (window.__googleMapsAuthFailed && onImmediateFail) {
    onImmediateFail();
  }
}

async function ensureRequiredLibrariesLoaded(): Promise<void> {
  const maps = window.google?.maps;
  if (!maps) return;
  if (maps.Map && maps.Marker && maps.LatLngBounds) return;

  if (typeof maps.importLibrary === 'function') {
    await Promise.all([
      maps.importLibrary('maps'),
      maps.importLibrary('marker'),
      maps.importLibrary('core'),
    ]);
  }
}

export function subscribeGoogleMapsAuthFailure(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  registerAuthFailureInterceptor();
  window.__googleMapsAuthFailureListeners?.add(listener);
  if (window.__googleMapsAuthFailed) {
    listener();
  }
  return () => {
    window.__googleMapsAuthFailureListeners?.delete(listener);
  };
}

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.__googleMapsAuthFailed) {
    return Promise.reject(new Error('Google Maps authentication failed.'));
  }

  registerAuthFailureInterceptor();

  if (window.google?.maps?.Map && window.google?.maps?.Marker) {
    return Promise.resolve();
  }
  if (window.__googleMapsLoadingPromise) {
    return window.__googleMapsLoadingPromise;
  }

  window.__googleMapsLoadingPromise = new Promise<void>((resolve, reject) => {
    const unsubscribe = subscribeGoogleMapsAuthFailure(() => {
      unsubscribe();
      reject(new Error('Google Maps authentication failure (gm_authFailure).'));
    });

    const finalize = async () => {
      try {
        await ensureRequiredLibrariesLoaded();
        if (window.__googleMapsAuthFailed || !window.google?.maps?.Map) {
          throw new Error('Google Maps API unavailable after script load.');
        }
        unsubscribe();
        resolve();
      } catch (err) {
        unsubscribe();
        window.__googleMapsLoadingPromise = undefined;
        reject(err);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps) {
        void finalize();
        return;
      }
      existing.addEventListener('load', () => void finalize(), { once: true });
      existing.addEventListener(
        'error',
        (e) => {
          unsubscribe();
          window.__googleMapsLoadingPromise = undefined;
          reject(e);
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => void finalize();
    script.onerror = (err) => {
      unsubscribe();
      window.__googleMapsLoadingPromise = undefined;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}
