/**
 * Persistent Storage Engine using browser IndexedDB with localStorage fallback.
 * Solves browser 5MB storage limits, prevents data loss when app features update,
 * and maintains edit flags so newer local user data is never overwritten by stale server defaults.
 */

import {
  upsertWilayahDataset,
  getCurrentUserRegionKode,
  supabase,
  DatasetType,
} from '../lib/supabaseClient';

const DB_NAME = 'HarmonisasiKalbar_AppDB';
const DB_VERSION = 1;
const STORE_NAME = 'datasets_store';

export const STORAGE_KEYS = {
  HARMONIZATION: 'kalbar_harmonization_datasets',
  IHK: 'kalbar_ihk_dataset',
  HPBS: 'kalbar_hpbs_dataset_v3',
  META: 'kalbar_app_metadata',
} as const;

export function mapStorageKeyToDatasetType(key: string): DatasetType | null {
  if (key === STORAGE_KEYS.HARMONIZATION) return 'harmonisasi';
  if (key === STORAGE_KEYS.IHK) return 'ihk';
  if (key === STORAGE_KEYS.HPBS) return 'hpbs';
  return null;
}

export const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_KEYS.HARMONIZATION]: 'harmonisasi_commodity_datasets_v1',
  [STORAGE_KEYS.IHK]: 'ihk_consumer_datasets_v1',
  [STORAGE_KEYS.HPBS]: 'hpbs_commodity_datasets_v1',
};

export interface StoredItem<T> {
  key: string;
  data: T;
  lastModified: number; // Date.now() timestamp
  hasUserEdits: boolean;
  version: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[PersistentStorage] Failed to open IndexedDB, using fallback:', request.error);
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Save data securely to IndexedDB and sync a lightweight copy/timestamp to localStorage.
 */
export async function savePersistentItem<T>(
  key: string,
  data: T,
  hasUserEdits: boolean = true,
  version: number = 1,
  customTimestamp?: number
): Promise<boolean> {
  const timestamp = customTimestamp || Date.now();
  const item: StoredItem<T> = {
    key,
    data,
    lastModified: timestamp,
    hasUserEdits,
    version,
  };

  let idbSuccess = false;
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    idbSuccess = true;
  } catch (err) {
    console.debug('[PersistentStorage] IDB put failed, continuing to localStorage:', err);
  }

  // Also save in localStorage as backup (with quota protection)
  try {
    const payload = JSON.stringify(item);
    localStorage.setItem(key, payload);
    localStorage.setItem(`${key}_timestamp`, String(timestamp));
    localStorage.setItem(`${key}_edited`, hasUserEdits ? 'true' : 'false');
  } catch (lsErr) {
    // If quota exceeded, at least store metadata in localStorage so we know IDB has newer edits
    try {
      localStorage.setItem(`${key}_timestamp`, String(timestamp));
      localStorage.setItem(`${key}_edited`, hasUserEdits ? 'true' : 'false');
    } catch (_) {}
  }

  // Centralized Cloud Backend: Automatically upsert to Supabase table `wilayah_datasets`
  const datasetType = mapStorageKeyToDatasetType(key);
  if (datasetType && hasUserEdits) {
    const regionKode = getCurrentUserRegionKode();
    upsertWilayahDataset(regionKode, datasetType, data).catch((supaErr) => {
      console.warn(`[PersistentStorage] Supabase upsert failed for ${regionKode}/${datasetType}:`, supaErr);
    });
  }

  return idbSuccess;
}

/**
 * Retrieve data from IndexedDB, falling back to localStorage if IDB is not ready.
 */
export async function loadPersistentItem<T>(key: string): Promise<StoredItem<T> | null> {
  // 1. Try IndexedDB first (most complete and handles large sizes)
  try {
    const db = await getIDB();
    const result = await new Promise<StoredItem<T> | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result && result.data !== undefined) {
      return result;
    }
  } catch (err) {
    console.debug('[PersistentStorage] IDB get failed, trying localStorage:', err);
  }

  // 2. Fallback to localStorage (checks new key first, then legacy key)
  try {
    let raw = localStorage.getItem(key);
    if (!raw && LEGACY_KEYS[key]) {
      raw = localStorage.getItem(LEGACY_KEYS[key]);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data !== undefined) {
        return parsed as StoredItem<T>;
      }
      // If legacy raw format was saved directly:
      const timestamp = Number(localStorage.getItem(`${key}_timestamp`) || 0) || Date.now();
      const edited = localStorage.getItem(`${key}_edited`) === 'true';
      return {
        key,
        data: parsed as T,
        lastModified: timestamp,
        hasUserEdits: edited,
        version: 1,
      };
    }
  } catch (e) {
    console.warn('[PersistentStorage] LocalStorage read failed:', e);
  }

  // 3. Fallback to Supabase cloud if local cache is empty
  try {
    const datasetType = mapStorageKeyToDatasetType(key);
    if (datasetType) {
      const regionKode = getCurrentUserRegionKode();
      const { data, error } = await supabase
        .from('wilayah_datasets')
        .select('*')
        .eq('kode_kabkota', regionKode)
        .eq('dataset_type', datasetType)
        .maybeSingle();

      if (!error && data && data.payload) {
        return {
          key,
          data: data.payload as T,
          lastModified: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
          hasUserEdits: true,
          version: 1,
        };
      }
    }
  } catch (supaErr) {
    console.debug('[PersistentStorage] Supabase load fallback failed:', supaErr);
  }

  return null;
}

/**
 * Synchronous read from localStorage for instant React useState initializers.
 */
export function getInitialSyncState<T>(key: string, fallback: T): { data: T; hasUserEdits: boolean; lastModified: number } {
  if (typeof window === 'undefined') {
    return { data: fallback, hasUserEdits: false, lastModified: 0 };
  }

  try {
    let raw = localStorage.getItem(key);
    if (!raw && LEGACY_KEYS[key]) {
      raw = localStorage.getItem(LEGACY_KEYS[key]);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data !== undefined) {
        return {
          data: parsed.data as T,
          hasUserEdits: Boolean(parsed.hasUserEdits),
          lastModified: Number(parsed.lastModified) || 0,
        };
      }
      // Legacy raw data format:
      const timestamp = Number(localStorage.getItem(`${key}_timestamp`) || 0);
      const edited = localStorage.getItem(`${key}_edited`) === 'true';
      return {
        data: parsed as T,
        hasUserEdits: edited,
        lastModified: timestamp,
      };
    }
  } catch (e) {
    console.warn('[PersistentStorage] Sync get failed:', e);
  }

  return { data: fallback, hasUserEdits: false, lastModified: 0 };
}

/**
 * Creates a complete snapshot backup of all app data for export/download.
 */
export async function createFullAppBackup(): Promise<{
  backupDate: string;
  version: string;
  datasets: any;
  ihkDataset: any;
  hpbsDataset: any;
}> {
  const [harm, ihk, hpbs] = await Promise.all([
    loadPersistentItem(STORAGE_KEYS.HARMONIZATION),
    loadPersistentItem(STORAGE_KEYS.IHK),
    loadPersistentItem(STORAGE_KEYS.HPBS),
  ]);

  return {
    backupDate: new Date().toISOString(),
    version: '1.5.0',
    datasets: harm?.data || null,
    ihkDataset: ihk?.data || null,
    hpbsDataset: hpbs?.data || null,
  };
}

/**
 * Restores a complete snapshot backup into IndexedDB & localStorage.
 */
export async function restoreFullAppBackup(backupObj: any): Promise<{
  success: boolean;
  message: string;
  harmCount: number;
  ihkRegions: number;
  hpbsRecords: number;
}> {
  if (!backupObj || typeof backupObj !== 'object') {
    throw new Error('File cadangan tidak valid.');
  }

  let harmCount = 0;
  let ihkRegions = 0;
  let hpbsRecords = 0;

  if (Array.isArray(backupObj.datasets)) {
    await savePersistentItem(STORAGE_KEYS.HARMONIZATION, backupObj.datasets, true);
    harmCount = backupObj.datasets.length;
  }

  if (backupObj.ihkDataset && backupObj.ihkDataset.regions) {
    await savePersistentItem(STORAGE_KEYS.IHK, backupObj.ihkDataset, true);
    ihkRegions = Object.keys(backupObj.ihkDataset.regions).length;
  }

  if (backupObj.hpbsDataset && Array.isArray(backupObj.hpbsDataset.records)) {
    await savePersistentItem(STORAGE_KEYS.HPBS, backupObj.hpbsDataset, true);
    hpbsRecords = backupObj.hpbsDataset.records.length;
  }

  return {
    success: true,
    message: 'Cadangan data berhasil dipulihkan ke penyimpanan browser dan server!',
    harmCount,
    ihkRegions,
    hpbsRecords,
  };
}
