import { MonthlyHarmonizationDataset } from '../types';
import { IhkCompleteDataset } from '../types/ihk';
import { HpbsDataset } from '../types/hpbs';
import { setClientSavedTimestamp } from './versionCheck';
import {
  migrateHarmonizationDatasets,
  migrateIhkDataset,
  migrateHpbsDataset,
} from './schemaMigration';

/**
 * Service to interact with the backend server API for persisting
 * and publishing harmonization, IHK, and HPBS datasets across sessions and devices.
 * Integrates schema validation & migration for 100% backward compatibility and zero data loss.
 */

const ANTI_CACHE_HEADERS: HeadersInit = {
  Accept: 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function getAlternativeApiUrl(path: string): string | null {
  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;
  if (origin.includes('ais-pre-')) {
    return origin.replace('ais-pre-', 'ais-dev-') + path;
  }
  return null;
}

// Fetch published harmonization datasets
export async function fetchPublishedDatasets(): Promise<{
  datasets: MonthlyHarmonizationDataset[];
  lastUpdated?: string;
} | null> {
  let primaryResult: { datasets: MonthlyHarmonizationDataset[]; lastUpdated?: string } | null = null;
  try {
    const res = await fetch(`/api/datasets?_t=${Date.now()}`, {
      headers: ANTI_CACHE_HEADERS,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.datasets) && data.datasets.length > 0) {
        primaryResult = {
          datasets: migrateHarmonizationDatasets(data.datasets),
          lastUpdated: data.lastUpdated,
        };
      }
    }
  } catch (err) {
    console.warn('[API] Could not reach /api/datasets:', err);
  }

  // Cross-environment fallback: if running on shared preview (ais-pre-), also check live dev instance
  const altUrl = getAlternativeApiUrl('/api/datasets');
  if (altUrl) {
    try {
      const altRes = await fetch(`${altUrl}?_t=${Date.now()}`, {
        headers: ANTI_CACHE_HEADERS,
        cache: 'no-store',
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData.success && Array.isArray(altData.datasets) && altData.datasets.length > 0) {
          const migratedAlt = migrateHarmonizationDatasets(altData.datasets);
          if (!primaryResult || migratedAlt.length > primaryResult.datasets.length) {
            return {
              datasets: migratedAlt,
              lastUpdated: altData.lastUpdated,
            };
          }
          if (
            primaryResult.lastUpdated &&
            altData.lastUpdated &&
            new Date(altData.lastUpdated) > new Date(primaryResult.lastUpdated)
          ) {
            return {
              datasets: migratedAlt,
              lastUpdated: altData.lastUpdated,
            };
          }
        }
      }
    } catch (_) {}
  }

  return primaryResult;
}

// Save/Publish harmonization datasets to server
export async function savePublishedDatasets(
  datasets: MonthlyHarmonizationDataset[]
): Promise<boolean> {
  let success = false;
  const migrated = migrateHarmonizationDatasets(datasets);
  try {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({ datasets: migrated }),
    });
    if (res.ok) {
      const data = await res.json();
      success = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('harmonization', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist harmonization datasets to server:', err);
  }

  // Also sync to dev instance if running in shared preview
  const altUrl = getAlternativeApiUrl('/api/datasets');
  if (altUrl) {
    try {
      fetch(altUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasets: migrated }),
      }).catch(() => {});
    } catch (_) {}
  }

  return success;
}

// Granular Note Saving to central cloud database
export async function saveHarmonizationNote(
  monthId: string,
  commodityId: string,
  regionId: string,
  note: string
): Promise<boolean> {
  let success = false;
  try {
    const res = await fetch('/api/harmonization-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({ monthId, commodityId, regionId, note }),
    });
    if (res.ok) {
      const data = await res.json();
      success = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('harmonization', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist harmonization note to server:', err);
  }

  const altUrl = getAlternativeApiUrl('/api/harmonization-notes');
  if (altUrl) {
    try {
      fetch(altUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthId, commodityId, regionId, note }),
      }).catch(() => {});
    } catch (_) {}
  }

  return success;
}

// Fetch published IHK dataset
export async function fetchPublishedIhkDataset(): Promise<{
  ihkDataset: IhkCompleteDataset;
  lastUpdated?: string;
} | null> {
  let primaryResult: { ihkDataset: IhkCompleteDataset; lastUpdated?: string } | null = null;
  try {
    const res = await fetch(`/api/ihk-datasets?_t=${Date.now()}`, {
      headers: ANTI_CACHE_HEADERS,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.ihkDataset && data.ihkDataset.regions) {
        primaryResult = {
          ihkDataset: migrateIhkDataset(data.ihkDataset),
          lastUpdated: data.lastUpdated,
        };
      }
    }
  } catch (err) {
    console.warn('[API] Could not reach /api/ihk-datasets:', err);
  }

  // Cross-environment fallback: check live dev instance if on preview
  const altUrl = getAlternativeApiUrl('/api/ihk-datasets');
  if (altUrl) {
    try {
      const altRes = await fetch(`${altUrl}?_t=${Date.now()}`, {
        headers: ANTI_CACHE_HEADERS,
        cache: 'no-store',
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData.success && altData.ihkDataset && altData.ihkDataset.regions) {
          const migratedAlt = migrateIhkDataset(altData.ihkDataset);
          if (
            !primaryResult ||
            (altData.lastUpdated && primaryResult.lastUpdated && new Date(altData.lastUpdated) > new Date(primaryResult.lastUpdated))
          ) {
            return {
              ihkDataset: migratedAlt,
              lastUpdated: altData.lastUpdated,
            };
          }
        }
      }
    } catch (_) {}
  }

  return primaryResult;
}

// Save/Publish IHK dataset to server
export async function savePublishedIhkDataset(
  ihkDataset: IhkCompleteDataset
): Promise<boolean> {
  let success = false;
  const migrated = migrateIhkDataset(ihkDataset);
  try {
    const res = await fetch('/api/ihk-datasets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({ ihkDataset: migrated }),
    });
    if (res.ok) {
      const data = await res.json();
      success = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('ihk', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist IHK dataset to server:', err);
  }

  // Cross-environment sync
  const altUrl = getAlternativeApiUrl('/api/ihk-datasets');
  if (altUrl) {
    try {
      fetch(altUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihkDataset: migrated }),
      }).catch(() => {});
    } catch (_) {}
  }

  return success;
}

// Reset server datasets
export async function resetServerDatasets(): Promise<boolean> {
  try {
    const res = await fetch('/api/reset-data', {
      method: 'POST',
      headers: ANTI_CACHE_HEADERS,
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Failed to reset server datasets:', err);
    return false;
  }
}

// Reset server IHK dataset
export async function resetServerIhkDataset(): Promise<boolean> {
  try {
    const res = await fetch('/api/reset-ihk', {
      method: 'POST',
      headers: ANTI_CACHE_HEADERS,
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Failed to reset server IHK dataset:', err);
    return false;
  }
}

// Fetch published HPBS dataset
export async function fetchPublishedHpbsDataset(): Promise<{
  dataset: HpbsDataset;
  lastUpdated?: string;
} | null> {
  let primaryResult: { dataset: HpbsDataset; lastUpdated?: string } | null = null;
  try {
    const res = await fetch(`/api/hpbs-datasets?_t=${Date.now()}`, {
      headers: ANTI_CACHE_HEADERS,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dataset && Array.isArray(data.dataset.records)) {
        primaryResult = {
          dataset: migrateHpbsDataset(data.dataset),
          lastUpdated: data.lastUpdated,
        };
      }
    }
  } catch (err) {
    console.warn('[API] Could not reach /api/hpbs-datasets:', err);
  }

  // Cross-environment fallback: check live dev instance if on preview
  const altUrl = getAlternativeApiUrl('/api/hpbs-datasets');
  if (altUrl) {
    try {
      const altRes = await fetch(`${altUrl}?_t=${Date.now()}`, {
        headers: ANTI_CACHE_HEADERS,
        cache: 'no-store',
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData.success && altData.dataset && Array.isArray(altData.dataset.records)) {
          const migratedAlt = migrateHpbsDataset(altData.dataset);
          if (
            !primaryResult ||
            migratedAlt.records.length > primaryResult.dataset.records.length ||
            (altData.lastUpdated && primaryResult.lastUpdated && new Date(altData.lastUpdated) > new Date(primaryResult.lastUpdated))
          ) {
            return {
              dataset: migratedAlt,
              lastUpdated: altData.lastUpdated,
            };
          }
        }
      }
    } catch (_) {}
  }

  return primaryResult;
}

// Save/Publish HPBS dataset to server
export async function savePublishedHpbsDataset(
  dataset: HpbsDataset
): Promise<boolean> {
  let success = false;
  const migrated = migrateHpbsDataset(dataset);
  try {
    // Send complete dataset with periods and commodity notes so multiple months are preserved across sessions
    const payload: Partial<HpbsDataset> = {
      periodTitle: migrated.periodTitle,
      records: migrated.records,
      activePeriodId: migrated.activePeriodId || '2026-09',
      periods: migrated.periods,
      commodityNotes: migrated.commodityNotes || {},
      lastUpdated: migrated.lastUpdated || new Date().toISOString(),
      version: migrated.version,
    };
    const res = await fetch('/api/hpbs-datasets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({ dataset: payload }),
    });
    if (res.ok) {
      const data = await res.json();
      success = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('hpbs', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist HPBS dataset to server:', err);
  }

  // Cross-environment sync
  const altUrl = getAlternativeApiUrl('/api/hpbs-datasets');
  if (altUrl) {
    try {
      fetch(altUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: migrated }),
      }).catch(() => {});
    } catch (_) {}
  }

  return success;
}

// Reset server HPBS dataset
export async function resetServerHpbsDataset(): Promise<boolean> {
  try {
    const res = await fetch('/api/reset-hpbs', { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.error('[API] Failed to reset server HPBS dataset:', err);
    return false;
  }
}

// Push/sync all datasets to server in one go
export async function syncAllDatasetsToServer(payload: {
  datasets?: MonthlyHarmonizationDataset[];
  ihkDataset?: IhkCompleteDataset;
  hpbsDataset?: HpbsDataset;
}): Promise<boolean> {
  const promises: Promise<boolean>[] = [];
  if (payload.datasets && payload.datasets.length > 0) {
    promises.push(savePublishedDatasets(payload.datasets));
  }
  if (payload.ihkDataset) {
    promises.push(savePublishedIhkDataset(payload.ihkDataset));
  }
  if (payload.hpbsDataset) {
    promises.push(savePublishedHpbsDataset(payload.hpbsDataset));
  }
  const results = await Promise.all(promises);
  return results.length > 0 ? results.every(Boolean) : true;
}

