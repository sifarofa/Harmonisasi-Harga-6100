import { MonthlyHarmonizationDataset } from '../types';
import { IhkCompleteDataset } from '../types/ihk';
import { HpbsDataset } from '../types/hpbs';
import { setClientSavedTimestamp } from './versionCheck';
import {
  migrateHarmonizationDatasets,
  migrateIhkDataset,
  migrateHpbsDataset,
} from './schemaMigration';
import {
  supabase,
  upsertWilayahDataset,
  getCurrentUserRegionKode,
  formatKodeKabKota,
} from '../lib/supabaseClient';

/**
 * Service to interact with Supabase centralized cloud database (Single Source of Truth)
 * and the backend server API for persisting and synchronizing harmonization, IHK, and HPBS
 * datasets across sessions, roles, and devices in real-time.
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

// Fetch published harmonization datasets (Supabase with server fallback)
export async function fetchPublishedDatasets(
  kodeKabKota?: string
): Promise<{
  datasets: MonthlyHarmonizationDataset[];
  lastUpdated?: string;
} | null> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());

  // 1. Supabase Cloud First (Single Source of Truth - newest updated_at wins)
  try {
    const allowedKodes = targetKode === '61.00' ? ['61.00'] : [targetKode, '61.00'];
    const { data, error } = await supabase
      .from('wilayah_datasets')
      .select('*')
      .eq('dataset_type', 'harmonisasi')
      .in('kode_kabkota', allowedKodes)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && Array.isArray(data.payload) && data.payload.length > 0) {
      return {
        datasets: migrateHarmonizationDatasets(data.payload),
        lastUpdated: data.updated_at,
      };
    }
  } catch (supaErr) {
    console.debug('[Supabase API] Failed to fetch harmonization:', supaErr);
  }

  // 2. Server API Fallback
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

  // Cross-environment fallback
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
        }
      }
    } catch (_) {}
  }

  return primaryResult;
}

// Save/Publish harmonization datasets to Supabase and server
export async function savePublishedDatasets(
  datasets: MonthlyHarmonizationDataset[],
  kodeKabKota?: string,
  options?: { skipSupabase?: boolean }
): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  const migrated = migrateHarmonizationDatasets(datasets);

  // 1. Centralized Supabase UPSERT
  let supaSuccess = Boolean(options?.skipSupabase);
  if (!options?.skipSupabase) {
    try {
      supaSuccess = await upsertWilayahDataset(targetKode, 'harmonisasi', migrated);
    } catch (supaErr) {
      console.warn('[Supabase API] savePublishedDatasets error:', supaErr);
    }
  }

  // 2. Server persistence fallback
  let serverSuccess = false;
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
      serverSuccess = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('harmonization', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist harmonization datasets to server:', err);
  }

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

  return supaSuccess || serverSuccess;
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

  return success;
}

// Fetch published IHK dataset (Supabase with server fallback)
export async function fetchPublishedIhkDataset(
  kodeKabKota?: string
): Promise<{
  ihkDataset: IhkCompleteDataset;
  lastUpdated?: string;
} | null> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());

  // 1. Supabase Cloud First (newest updated_at wins)
  try {
    const allowedKodes = targetKode === '61.00' ? ['61.00'] : [targetKode, '61.00'];
    const { data, error } = await supabase
      .from('wilayah_datasets')
      .select('*')
      .eq('dataset_type', 'ihk')
      .in('kode_kabkota', allowedKodes)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && data.payload && data.payload.regions) {
      return {
        ihkDataset: migrateIhkDataset(data.payload),
        lastUpdated: data.updated_at,
      };
    }
  } catch (supaErr) {
    console.debug('[Supabase API] Failed to fetch IHK from Supabase:', supaErr);
  }

  // 2. Server API Fallback
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

  return primaryResult;
}

// Save/Publish IHK dataset to Supabase and server
export async function savePublishedIhkDataset(
  ihkDataset: IhkCompleteDataset,
  kodeKabKota?: string,
  options?: { skipSupabase?: boolean }
): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  const migrated = migrateIhkDataset(ihkDataset);

  // 1. Supabase Cloud UPSERT
  let supaSuccess = Boolean(options?.skipSupabase);
  if (!options?.skipSupabase) {
    try {
      supaSuccess = await upsertWilayahDataset(targetKode, 'ihk', migrated);
    } catch (supaErr) {
      console.warn('[Supabase API] savePublishedIhkDataset error:', supaErr);
    }
  }

  // 2. Server persistence fallback
  let serverSuccess = false;
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
      serverSuccess = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('ihk', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist IHK dataset to server:', err);
  }

  return supaSuccess || serverSuccess;
}

// Reset server datasets
export async function resetServerDatasets(kodeKabKota?: string): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  try {
    await supabase
      .from('wilayah_datasets')
      .delete()
      .eq('kode_kabkota', targetKode)
      .eq('dataset_type', 'harmonisasi');
  } catch (_) {}

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
export async function resetServerIhkDataset(kodeKabKota?: string): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  try {
    await supabase
      .from('wilayah_datasets')
      .delete()
      .eq('kode_kabkota', targetKode)
      .eq('dataset_type', 'ihk');
  } catch (_) {}

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

// Fetch published HPBS dataset (Supabase with server fallback)
export async function fetchPublishedHpbsDataset(
  kodeKabKota?: string
): Promise<{
  dataset: HpbsDataset;
  lastUpdated?: string;
} | null> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());

  // 1. Supabase Cloud First (SHPB/HPBS is unified province-wide — always pick newest updated_at across devices)
  try {
    const { data, error } = await supabase
      .from('wilayah_datasets')
      .select('*')
      .eq('dataset_type', 'hpbs')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && data.payload && (Array.isArray(data.payload.records) || Array.isArray(data.payload.periods))) {
      return {
        dataset: migrateHpbsDataset(data.payload),
        lastUpdated: data.updated_at,
      };
    }
  } catch (supaErr) {
    console.debug('[Supabase API] Failed to fetch HPBS from Supabase:', supaErr);
  }

  // 2. Server API Fallback
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

  return primaryResult;
}

// Save/Publish HPBS dataset to Supabase and server
export async function savePublishedHpbsDataset(
  dataset: HpbsDataset,
  kodeKabKota?: string,
  options?: { skipSupabase?: boolean }
): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  const migrated = migrateHpbsDataset(dataset);

  const payload: Partial<HpbsDataset> = {
    periodTitle: migrated.periodTitle,
    records: migrated.records,
    activePeriodId: migrated.activePeriodId || '2026-09',
    periods: migrated.periods,
    commodityNotes: migrated.commodityNotes || {},
    lastUpdated: migrated.lastUpdated || new Date().toISOString(),
    version: migrated.version,
  };

  // 1. Supabase Cloud UPSERT
  let supaSuccess = Boolean(options?.skipSupabase);
  if (!options?.skipSupabase) {
    try {
      supaSuccess = await upsertWilayahDataset(targetKode, 'hpbs', payload);
    } catch (supaErr) {
      console.warn('[Supabase API] savePublishedHpbsDataset error:', supaErr);
    }
  }

  // 2. Server persistence fallback
  let serverSuccess = false;
  try {
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
      serverSuccess = !!data.success;
      if (data.lastUpdated) {
        setClientSavedTimestamp('hpbs', data.lastUpdated);
      }
    }
  } catch (err) {
    console.error('[API] Failed to persist HPBS dataset to server:', err);
  }

  return supaSuccess || serverSuccess;
}

// Reset server HPBS dataset
export async function resetServerHpbsDataset(kodeKabKota?: string): Promise<boolean> {
  const targetKode = formatKodeKabKota(kodeKabKota || getCurrentUserRegionKode());
  try {
    await supabase
      .from('wilayah_datasets')
      .delete()
      .eq('kode_kabkota', targetKode)
      .eq('dataset_type', 'hpbs');
  } catch (_) {}

  try {
    const res = await fetch('/api/reset-hpbs', { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.error('[API] Failed to reset server HPBS dataset:', err);
    return false;
  }
}

// Push/sync all datasets to Supabase and server in one go
export async function syncAllDatasetsToServer(
  payload: {
    datasets?: MonthlyHarmonizationDataset[];
    ihkDataset?: IhkCompleteDataset;
    hpbsDataset?: HpbsDataset;
  },
  kodeKabKota?: string
): Promise<boolean> {
  const promises: Promise<boolean>[] = [];
  if (payload.datasets && payload.datasets.length > 0) {
    promises.push(savePublishedDatasets(payload.datasets, kodeKabKota));
  }
  if (payload.ihkDataset) {
    promises.push(savePublishedIhkDataset(payload.ihkDataset, kodeKabKota));
  }
  if (payload.hpbsDataset) {
    promises.push(savePublishedHpbsDataset(payload.hpbsDataset, kodeKabKota));
  }
  const results = await Promise.all(promises);
  return results.length > 0 ? results.every(Boolean) : true;
}
