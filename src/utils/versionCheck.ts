import { useEffect, useRef, useState } from 'react';

export const APP_CLIENT_VERSION = '1.5.0';
export const APP_CLIENT_BUILD_TAG = 'v1.5.0-20260909';

export interface AppVersionInfo {
  version: string;
  buildId: string;
  bootTime: string;
  lastHarmonizationUpdated: string | null;
  lastIhkUpdated: string | null;
  lastHpbsUpdated?: string | null;
  serverTime: string;
}

function getAlternativeApiUrl(path: string): string | null {
  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;
  if (origin.includes('ais-pre-')) {
    return origin.replace('ais-pre-', 'ais-dev-') + path;
  }
  return null;
}

/**
 * Check the latest version info from the backend server
 */
export async function fetchServerVersion(): Promise<AppVersionInfo | null> {
  let primaryInfo: AppVersionInfo | null = null;
  try {
    const res = await fetch(`/api/app-version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    if (res.ok) {
      primaryInfo = await res.json();
    }
  } catch (err) {
    console.debug('[VersionCheck] Offline or could not fetch version:', err);
  }

  // Cross-environment check: If on preview, also query dev server
  const altUrl = getAlternativeApiUrl('/api/app-version');
  if (altUrl) {
    try {
      const altRes = await fetch(`${altUrl}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (altRes.ok) {
        const altInfo: AppVersionInfo = await altRes.json();
        if (!primaryInfo) {
          return altInfo;
        }
        // Merge newest timestamps
        const isAltHarmNewer = altInfo.lastHarmonizationUpdated && (!primaryInfo.lastHarmonizationUpdated || new Date(altInfo.lastHarmonizationUpdated) > new Date(primaryInfo.lastHarmonizationUpdated));
        const isAltIhkNewer = altInfo.lastIhkUpdated && (!primaryInfo.lastIhkUpdated || new Date(altInfo.lastIhkUpdated) > new Date(primaryInfo.lastIhkUpdated));
        const isAltHpbsNewer = altInfo.lastHpbsUpdated && (!primaryInfo.lastHpbsUpdated || new Date(altInfo.lastHpbsUpdated) > new Date(primaryInfo.lastHpbsUpdated));

        return {
          ...primaryInfo,
          lastHarmonizationUpdated: isAltHarmNewer ? altInfo.lastHarmonizationUpdated : primaryInfo.lastHarmonizationUpdated,
          lastIhkUpdated: isAltIhkNewer ? altInfo.lastIhkUpdated : primaryInfo.lastIhkUpdated,
          lastHpbsUpdated: isAltHpbsNewer ? altInfo.lastHpbsUpdated : primaryInfo.lastHpbsUpdated,
        };
      }
    } catch (_) {}
  }

  return primaryInfo;
}

/**
 * Force hard refresh that purges service workers, CacheStorage, and reloads with cache-busting timestamp
 */
export async function forceHardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        await caches.delete(key);
      }
    }
    sessionStorage.removeItem('last_reloaded_build');
  } catch (err) {
    console.warn('[VersionCheck] Error purging caches:', err);
  }

  // Force page reload bypassing HTTP cache
  const targetUrl = `${window.location.origin}${window.location.pathname}?_v=${Date.now()}`;
  window.location.replace(targetUrl);
}

export function setClientSavedTimestamp(type: 'harmonization' | 'ihk' | 'hpbs', timestamp: string) {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`client_saved_${type}`, timestamp);
    } catch (_) {}
  }
}

export function getClientSavedTimestamp(type: 'harmonization' | 'ihk' | 'hpbs'): string | null {
  if (typeof window !== 'undefined') {
    try {
      return sessionStorage.getItem(`client_saved_${type}`);
    } catch (_) {}
  }
  return null;
}

interface UseAutoUpdateOptions {
  onHarmonizationDataChanged?: () => void;
  onIhkDataChanged?: () => void;
  onHpbsDataChanged?: () => void;
}

/**
 * React hook that monitors server version and published data updates.
 * Fires checks on mount, tab visibility change (e.g. user unlocks phone/switches tab),
 * window focus, and background polling.
 */
export function useAutoUpdate({
  onHarmonizationDataChanged,
  onIhkDataChanged,
  onHpbsDataChanged,
}: UseAutoUpdateOptions = {}) {
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(APP_CLIENT_BUILD_TAG);
  const [hasNewVersion, setHasNewVersion] = useState<boolean>(false);
  const [serverVersionInfo, setServerVersionInfo] = useState<AppVersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const initialBuildIdRef = useRef<string | null>(null);
  const lastHarmonizationRef = useRef<string | null>(null);
  const lastIhkRef = useRef<string | null>(null);
  const lastHpbsRef = useRef<string | null>(null);

  const checkVersion = async () => {
    setIsChecking(true);
    const info = await fetchServerVersion();
    setIsChecking(false);
    setLastChecked(new Date());

    if (!info) return;

    setServerVersionInfo(info);

    // 1. Initial capture
    if (!initialBuildIdRef.current) {
      initialBuildIdRef.current = info.buildId;
      setCurrentBuildId(info.buildId);
    }

    // 2. Check for App/Feature Code Updates (Client vs Server mismatch or new build deployed)
    const isCodeOutdated =
      info.version !== APP_CLIENT_VERSION ||
      (initialBuildIdRef.current && info.buildId !== initialBuildIdRef.current);

    if (isCodeOutdated) {
      setHasNewVersion(true);
    } else {
      setHasNewVersion(false);
    }

    // 3. Check for Harmonization Dataset Updates on server (from another user/device)
    if (!lastHarmonizationRef.current) {
      lastHarmonizationRef.current = info.lastHarmonizationUpdated || null;
    } else if (
      info.lastHarmonizationUpdated &&
      info.lastHarmonizationUpdated !== lastHarmonizationRef.current
    ) {
      lastHarmonizationRef.current = info.lastHarmonizationUpdated;
      // Prevent reacting to our own saves:
      const mySaved = getClientSavedTimestamp('harmonization');
      if (info.lastHarmonizationUpdated !== mySaved) {
        console.log('[AutoUpdate] External server harmonization update detected, triggering sync');
        onHarmonizationDataChanged?.();
      }
    }

    // 4. Check for IHK Dataset Updates on server (from another user/device)
    if (!lastIhkRef.current) {
      lastIhkRef.current = info.lastIhkUpdated || null;
    } else if (
      info.lastIhkUpdated &&
      info.lastIhkUpdated !== lastIhkRef.current
    ) {
      lastIhkRef.current = info.lastIhkUpdated;
      const mySaved = getClientSavedTimestamp('ihk');
      if (info.lastIhkUpdated !== mySaved) {
        console.log('[AutoUpdate] External server IHK update detected, triggering sync');
        onIhkDataChanged?.();
      }
    }

    // 5. Check for HPBS Dataset Updates on server (from another user/device)
    if (!lastHpbsRef.current) {
      lastHpbsRef.current = info.lastHpbsUpdated || null;
    } else if (
      info.lastHpbsUpdated &&
      info.lastHpbsUpdated !== lastHpbsRef.current
    ) {
      lastHpbsRef.current = info.lastHpbsUpdated;
      const mySaved = getClientSavedTimestamp('hpbs');
      if (info.lastHpbsUpdated !== mySaved) {
        console.log('[AutoUpdate] External server HPBS update detected, triggering sync');
        onHpbsDataChanged?.();
      }
    }
  };

  useEffect(() => {
    // Initial check
    checkVersion();

    // Periodic check every 12 seconds for swift cross-device syncing
    const interval = setInterval(checkVersion, 12000);

    // Event listener when user switches back to browser or unlocks mobile phone
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    const handleFocus = () => {
      checkVersion();
    };

    const handleOnline = () => {
      checkVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // Real-Time Server-Sent Events (SSE) stream for instant sub-second multi-device sync
    let eventSource: EventSource | null = null;
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        eventSource = new EventSource('/api/live-sync');

        eventSource.onmessage = (e) => {
          try {
            if (!e.data || e.data.trim() === '') return;
            const data = JSON.parse(e.data);

            if (data.type === 'CONNECTED') {
              if (initialBuildIdRef.current && data.buildId && data.buildId !== initialBuildIdRef.current) {
                setHasNewVersion(true);
              }
            } else if (data.type === 'HARMONIZATION_UPDATED') {
              const mySaved = getClientSavedTimestamp('harmonization');
              if (data.lastUpdated && data.lastUpdated !== mySaved) {
                console.log('[SSE] Live harmonization update received from server');
                onHarmonizationDataChanged?.();
              }
            } else if (data.type === 'IHK_UPDATED') {
              const mySaved = getClientSavedTimestamp('ihk');
              if (data.lastUpdated && data.lastUpdated !== mySaved) {
                console.log('[SSE] Live IHK update received from server');
                onIhkDataChanged?.();
              }
            } else if (data.type === 'HPBS_UPDATED') {
              const mySaved = getClientSavedTimestamp('hpbs');
              if (data.lastUpdated && data.lastUpdated !== mySaved) {
                console.log('[SSE] Live HPBS update received from server');
                onHpbsDataChanged?.();
              }
            }
          } catch (parseErr) {
            console.debug('[SSE] Failed to parse SSE event message:', parseErr);
          }
        };

        eventSource.onerror = () => {
          // Keep polling active as resilient fallback
        };
      }
    } catch (sseErr) {
      console.debug('[SSE] EventSource unavailable, relying on polling fallback:', sseErr);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return {
    hasNewVersion,
    currentBuildId,
    serverVersionInfo,
    isChecking,
    lastChecked,
    checkVersion,
    forceRefresh: forceHardRefresh,
  };
}
