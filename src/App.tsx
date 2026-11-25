import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { DashboardOverview } from './components/DashboardOverview';
import { DataManagementModal } from './components/DataManagementModal';
import { IhkConsumerAnalysisView } from './components/IhkConsumerAnalysisView';
import { IhkDataManagementModal } from './components/IhkDataManagementModal';
import { HpbsAnalysisView } from './components/HpbsAnalysisView';
import { HpbsImportModal } from './components/HpbsImportModal';
import { MonthlyHarmonizationGrid } from './components/MonthlyHarmonizationGrid';
import { Navbar, TabType } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { OwnerAuthModal } from './components/OwnerAuthModal';
import { PriceLevelHarmonizationView } from './components/PriceLevelHarmonizationView';
import { UnifiedFilterBar } from './components/UnifiedFilterBar';
import { PortalLoginPage } from './components/PortalLoginPage';
import { UserManagementModal } from './components/UserManagementModal';
import { DEFAULT_REGIONS, generateInitialDatasets } from './data/initialData';
import { generateInitialIhkDataset } from './data/initialIhkData';
import { generateInitialHpbsDataset, generatePeriodsFromRecords } from './data/initialHpbsData';
import { MonthlyHarmonizationDataset, PriceLevel, RegionInfo, AuthUser } from './types';
import { IhkCompleteDataset } from './types/ihk';
import { HpbsDataset, HpbsMonthlyPeriod } from './types/hpbs';
import { exportHarmonizationToExcel } from './utils/analysis';
import {
  aggregateHpbsData,
  downloadHpbsTemplateExcel,
  exportHpbsAnalysisToExcel,
  filterValidHpbsRecords,
} from './utils/hpbsAnalysis';
import { useAutoUpdate } from './utils/versionCheck';
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner';
import { MobileBottomNav } from './components/MobileBottomNav';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import {
  savePersistentItem,
  loadPersistentItem,
  getInitialSyncState,
  STORAGE_KEYS,
} from './utils/persistentStorage';
import {
  fetchPublishedDatasets,
  fetchPublishedHpbsDataset,
  fetchPublishedIhkDataset,
  resetServerDatasets,
  resetServerHpbsDataset,
  resetServerIhkDataset,
  savePublishedDatasets,
  savePublishedHpbsDataset,
  savePublishedIhkDataset,
} from './utils/apiService';
import {
  supabase,
  upsertWilayahDataset,
  upsertWilayahDatasetDetailed,
  loadWilayahDatasetsFromSupabase,
  loadHpbsFromRecordsTable,
  fetchLatestWilayahTimestamps,
  fetchSingleWilayahDataset,
  syncHarmonisasiToSupabase,
  syncIhkToSupabase,
  syncHpbsToSupabase,
  deleteHarmonisasiPeriodFromSupabase,
  deleteHpbsPeriodFromSupabase,
  WilayahDatasetRow,
  DatasetType,
  formatKodeKabKota,
} from './lib/supabase';

const LOCAL_STORAGE_KEY = STORAGE_KEYS.HARMONIZATION;
const IHK_STORAGE_KEY = STORAGE_KEYS.IHK;
const HPBS_STORAGE_KEY = STORAGE_KEYS.HPBS;
const OWNER_STORAGE_KEY = 'harmonisasi_is_owner';
const PORTAL_AUTH_KEY = 'seharga_portal_auth_user';
const OWNER_EMAIL = 'sifarofatunnisa24@gmail.com';

// Ensures HPBS dataset always has complete routine monthly periods and preserves intentionally empty periods
function normalizeHpbsDataset(raw: any): HpbsDataset {
  if (!raw || typeof raw !== 'object') {
    return generateInitialHpbsDataset();
  }
  const hasRawPeriods = Array.isArray(raw.periods) && raw.periods.length > 0;
  const cleanRecords = Array.isArray(raw.records) ? filterValidHpbsRecords(raw.records) : [];
  if (cleanRecords.length === 0 && !hasRawPeriods) {
    return generateInitialHpbsDataset();
  }
  const activePeriodId = raw.activePeriodId || (hasRawPeriods ? raw.periods[raw.periods.length - 1].id : '2026-09');
  let periods = raw.periods;
  if (!hasRawPeriods) {
    periods = generatePeriodsFromRecords(cleanRecords, activePeriodId);
  } else {
    periods = periods.map((p: any) => ({
      ...p,
      records: Array.isArray(p.records) ? filterValidHpbsRecords(p.records) : [],
    }));
  }
  return {
    ...raw,
    records: cleanRecords,
    activePeriodId,
    periods,
  };
}

// Safely persists HPBS dataset to persistent storage including routine monthly periods
function persistHpbsDatasetLocally(
  dataset: HpbsDataset,
  hasUserEdits = true,
  customTimestamp?: number,
  skipCloudSync: boolean = true
) {
  try {
    const toSave = {
      periodTitle: dataset.periodTitle,
      records: dataset.records,
      activePeriodId: dataset.activePeriodId || '2026-09',
      periods: dataset.periods,
      commodityNotes: dataset.commodityNotes,
      lastUpdated: dataset.lastUpdated || new Date().toISOString(),
      version: dataset.version,
    };
    savePersistentItem(HPBS_STORAGE_KEY, toSave, hasUserEdits, 1, customTimestamp, skipCloudSync);
  } catch (err: any) {
    console.warn('[PersistentStorage] Failed to save HPBS:', err);
  }
}

export default function App() {
  const [datasets, setDatasets] = useState<MonthlyHarmonizationDataset[]>(() => {
    const initialFallback = generateInitialDatasets().sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    try {
      const stored = getInitialSyncState<MonthlyHarmonizationDataset[]>(
        STORAGE_KEYS.HARMONIZATION,
        initialFallback
      );
      if (Array.isArray(stored.data) && stored.data.length > 0 && stored.data.some((p: any) => p.year >= 2026)) {
        return stored.data.sort((a: any, b: any) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
      }
    } catch (e) {
      console.error('Failed to load datasets from sync state:', e);
    }
    return initialFallback;
  });

  const [regions] = useState<RegionInfo[]>(DEFAULT_REGIONS);
  const [activeTab, setActiveTab] = useState<TabType>('price_levels');
  const [navOrientation, setNavOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
    if (datasets.length > 0) {
      return datasets[datasets.length - 1].id;
    }
    return '2026-09';
  });
  // Institutional Portal User State (Reads from sessionStorage as Single Source of Auth Session)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const stored =
        sessionStorage.getItem('seharga_auth_user') ||
        sessionStorage.getItem(PORTAL_AUTH_KEY) ||
        sessionStorage.getItem('seharga_portal_auth_user') ||
        localStorage.getItem('seharga_auth_user') ||
        localStorage.getItem(PORTAL_AUTH_KEY) ||
        localStorage.getItem('seharga_portal_auth_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse portal auth user:', e);
    }
    return null;
  });

  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(PORTAL_AUTH_KEY) || sessionStorage.getItem(PORTAL_AUTH_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role === 'admin_kabkota' && parsed.regionId) {
          return parsed.regionId;
        }
      }
    } catch {}
    return 'all';
  });
  const [selectedPriceLevel, setSelectedPriceLevel] = useState<PriceLevel | 'all'>('all');
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>('c_7'); // Default to Cabai Rawit (No. 7)

  // Owner Access Control State (Provinsi has full owner privileges)
  const [isOwner, setIsOwner] = useState<boolean>(() => {
    try {
      const portalUser = localStorage.getItem(PORTAL_AUTH_KEY) || sessionStorage.getItem(PORTAL_AUTH_KEY);
      if (portalUser) {
        const parsed = JSON.parse(portalUser);
        if (parsed && parsed.role === 'admin_provinsi') return true;
      }
      return localStorage.getItem(OWNER_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [ownerAuthModalOpen, setOwnerAuthModalOpen] = useState<boolean>(false);
  const [pendingOwnerAction, setPendingOwnerAction] = useState<(() => void) | null>(null);
  const [pendingActionName, setPendingActionName] = useState<string>('');

  // Modal controls
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add_month' | 'import' | 'export' | 'manage_months';
  }>({
    isOpen: false,
    mode: 'add_month',
  });

  // Persistent Backup & Storage Health Modal
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);

  // User Management Modal (Admin Provinsi & Admin Kab/Kota)
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);

  // Supabase Centralized Real-Time Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Tersinkron dengan Supabase Cloud');
  const lastKnownSupaTimestampsRef = useRef<Partial<Record<DatasetType, string>>>({});

  // IHK Consumer Dataset State (Terpisah dari dataset harmonisasi)
  const [ihkDataset, setIhkDataset] = useState<IhkCompleteDataset>(() => {
    const fallback = generateInitialIhkDataset();
    try {
      const stored = getInitialSyncState<IhkCompleteDataset>(STORAGE_KEYS.IHK, fallback);
      if (stored.data && stored.data.regions && Object.keys(stored.data.regions).length > 0) {
        return stored.data;
      }
    } catch (e) {
      console.error('Failed to load IHK dataset from sync state:', e);
    }
    return fallback;
  });

  const [ihkModalState, setIhkModalState] = useState<{
    isOpen: boolean;
    tab: 'import' | 'template' | 'export' | 'manage';
  }>({
    isOpen: false,
    tab: 'import',
  });

  // HPBS Relatif Harga Dataset State (Level Pedagang 14 Kab/Kota)
  const [hpbsDataset, setHpbsDataset] = useState<HpbsDataset>(() => {
    const fallback = generateInitialHpbsDataset();
    try {
      const stored = getInitialSyncState<HpbsDataset>(STORAGE_KEYS.HPBS, fallback);
      if (stored.data && Array.isArray(stored.data.records) && stored.data.records.length > 0) {
        return normalizeHpbsDataset(stored.data);
      }
    } catch (e) {
      console.error('Failed to load HPBS dataset from sync state:', e);
    }
    return fallback;
  });

  const [isHpbsImportModalOpen, setIsHpbsImportModalOpen] = useState<boolean>(false);
  const [hpbsSubTab, setHpbsSubTab] = useState<'agregat_kalbar' | 'matriks_wilayah' | 'responden_detail' | 'series_stabilitas'>('agregat_kalbar');

  // Toast Notification for Server Publishing
  const [publishToast, setPublishToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showPublishToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setPublishToast({ message, type });
    setTimeout(() => {
      setPublishToast((curr) => (curr?.message === message ? null : curr));
    }, 5500);
  };

  // Real-time Version Tracking & Automatic Multi-Device Data Sync
  const { hasNewVersion, serverVersionInfo, forceRefresh } = useAutoUpdate({
    onHarmonizationDataChanged: async () => {
      try {
        const res = await fetchPublishedDatasets();
        if (res && res.datasets && res.datasets.length > 0) {
          const sorted = res.datasets.sort((a, b) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
          );
          const serverTime = res.lastUpdated ? new Date(res.lastUpdated).getTime() : Date.now();
          setDatasets(sorted);
          await savePersistentItem(STORAGE_KEYS.HARMONIZATION, sorted, false, 1, serverTime);
          setSelectedMonthId((curr) => {
            const exists = sorted.some((d) => d.id === curr);
            return exists ? curr : sorted[sorted.length - 1].id;
          });
          showPublishToast('⚡ Data harmonisasi terupdate otomatis dari server / perangkat lain!', 'info');
        }
      } catch (e) {
        console.warn('Auto-update harmonization data error:', e);
      }
    },
    onIhkDataChanged: async () => {
      try {
        const res = await fetchPublishedIhkDataset();
        if (res && res.ihkDataset && res.ihkDataset.regions) {
          const serverTime = res.lastUpdated ? new Date(res.lastUpdated).getTime() : Date.now();
          setIhkDataset(res.ihkDataset);
          await savePersistentItem(STORAGE_KEYS.IHK, res.ihkDataset, false, 1, serverTime);
          showPublishToast('⚡ Data RH Stabil IHK terupdate otomatis dari server / perangkat lain!', 'info');
        }
      } catch (e) {
        console.warn('Auto-update IHK data error:', e);
      }
    },
    onHpbsDataChanged: async () => {
      try {
        const res = await fetchPublishedHpbsDataset();
        if (res && res.dataset && Array.isArray(res.dataset.records)) {
          const normalized = normalizeHpbsDataset(res.dataset);
          const serverTime = res.lastUpdated ? new Date(res.lastUpdated).getTime() : Date.now();
          setHpbsDataset(normalized);
          persistHpbsDatasetLocally(normalized, false, serverTime);
          showPublishToast('⚡ Data Relatif Harga (V-HPBS) terupdate otomatis dari server / perangkat lain!', 'info');
        }
      } catch (e) {
        console.warn('Auto-update HPBS data error:', e);
      }
    },
  });

  // Manual or on-demand multi-device synchronization from Supabase Cloud
  const handleManualSync = async () => {
    setSyncStatus('syncing');
    setSyncMessage('Mengambil data terbaru dari Supabase...');
    try {
      showPublishToast('🔄 Mengambil data terbaru dari Supabase Cloud & menyinkronkan...', 'info');
      const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
      const isProv = authUser?.role === 'admin_provinsi';

      const supaData = await loadWilayahDatasetsFromSupabase(
        userKode,
        isProv ? 'provinsi' : 'kabkota'
      );

      if (supaData.error) {
        setSyncStatus('error');
        setSyncMessage(`Gagal terhubung ke Supabase: ${supaData.error}`);
        showPublishToast(`⚠️ Gagal menyinkronkan dengan Supabase: ${supaData.error}`, 'error');
        return;
      }

      if (supaData.timestamps) {
        lastKnownSupaTimestampsRef.current = {
          ...lastKnownSupaTimestampsRef.current,
          ...supaData.timestamps,
        };
      }

      let syncUpdated = false;

      // Harmonisasi
      if (supaData.harmonisasiPayload && Array.isArray(supaData.harmonisasiPayload) && supaData.harmonisasiPayload.length > 0) {
        const sorted = [...supaData.harmonisasiPayload].sort((a: any, b: any) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        );
        const serverMs = supaData.timestamps?.harmonisasi
          ? new Date(supaData.timestamps.harmonisasi).getTime()
          : Date.now();
        setDatasets(sorted);
        await savePersistentItem(STORAGE_KEYS.HARMONIZATION, sorted, false, 1, serverMs, true);
        const latestMonthId = sorted[sorted.length - 1].id;
        setSelectedMonthId(latestMonthId);
        syncUpdated = true;
      }

      // IHK (Analisis RH Stabil IHK)
      if (supaData.ihkPayload && supaData.ihkPayload.regions && Object.keys(supaData.ihkPayload.regions).length > 0) {
        const serverMs = supaData.timestamps?.ihk
          ? new Date(supaData.timestamps.ihk).getTime()
          : Date.now();
        setIhkDataset(supaData.ihkPayload);
        await savePersistentItem(STORAGE_KEYS.IHK, supaData.ihkPayload, false, 1, serverMs, true);
        syncUpdated = true;
      }

      // HPBS (V-HPBS Grosir)
      if (
        supaData.hpbsPayload &&
        ((Array.isArray(supaData.hpbsPayload.records) && supaData.hpbsPayload.records.length > 0) ||
          (Array.isArray(supaData.hpbsPayload.periods) && supaData.hpbsPayload.periods.length > 0))
      ) {
        const normalized = normalizeHpbsDataset(supaData.hpbsPayload);
        const serverMs = supaData.timestamps?.hpbs
          ? new Date(supaData.timestamps.hpbs).getTime()
          : Date.now();
        setHpbsDataset(normalized);
        persistHpbsDatasetLocally(normalized, false, serverMs, true);
        syncUpdated = true;
      } else {
        const recoveredHpbs = await loadHpbsFromRecordsTable();
        if (recoveredHpbs) {
          const normalized = normalizeHpbsDataset(recoveredHpbs);
          setHpbsDataset(normalized);
          persistHpbsDatasetLocally(normalized, false, Date.now(), true);
          syncUpdated = true;
        }
      }

      setSyncStatus('synced');
      setSyncMessage('Tersinkron dengan Supabase Cloud');

      if (hasNewVersion) {
        forceRefresh();
      } else {
        showPublishToast(
          syncUpdated
            ? '✓ Data terbaru dari Supabase Cloud berhasil disinkronkan ke perangkat ini!'
            : '✓ Data sudah sinkron dengan database Supabase Cloud.',
          'success'
        );
      }
    } catch (e: any) {
      console.warn('Manual sync error:', e);
      setSyncStatus('error');
      setSyncMessage(e?.message || 'Gagal menyinkronkan dengan Supabase');
      showPublishToast(`⚠️ Gagal menyinkronkan: ${e?.message || 'Koneksi terganggu'}`, 'error');
    }
  };

  // Supabase Centralized Cloud Persistence, Realtime & Multi-Device Polling Engine
  useEffect(() => {
    if (!authUser) return;

    let isMounted = true;
    const userKode = formatKodeKabKota(authUser.regionCode || '61.00');
    const isProv = authUser.role === 'admin_provinsi';

    const applyRemoteDataset = async (
      type: DatasetType,
      payload: any,
      updatedAt: string | undefined,
      sourceKode: string,
      notifyLabel?: string
    ) => {
      if (!isMounted || !payload) return;
      const serverMs = updatedAt ? new Date(updatedAt).getTime() : Date.now();
      if (updatedAt) {
        lastKnownSupaTimestampsRef.current[type] = updatedAt;
      }

      if (type === 'harmonisasi' && Array.isArray(payload) && payload.length > 0) {
        const sorted = [...payload].sort((a: any, b: any) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        );
        setDatasets(sorted);
        await savePersistentItem(STORAGE_KEYS.HARMONIZATION, sorted, false, 1, serverMs, true);
        setSelectedMonthId((curr) => {
          const exists = sorted.some((d) => d.id === curr);
          return exists ? curr : sorted[sorted.length - 1].id;
        });
        if (notifyLabel) {
          showPublishToast(`⚡ Data Harmonisasi (${sourceKode}) ${notifyLabel}`, 'info');
        }
      } else if (type === 'ihk' && payload.regions && Object.keys(payload.regions).length > 0) {
        setIhkDataset(payload);
        await savePersistentItem(STORAGE_KEYS.IHK, payload, false, 1, serverMs, true);
        if (notifyLabel) {
          showPublishToast(`⚡ Data RH Stabil IHK (${sourceKode}) ${notifyLabel}`, 'info');
        }
      } else if (
        type === 'hpbs' &&
        ((Array.isArray(payload.records) && payload.records.length > 0) ||
          (Array.isArray(payload.periods) && payload.periods.length > 0))
      ) {
        const normalized = normalizeHpbsDataset(payload);
        setHpbsDataset(normalized);
        persistHpbsDatasetLocally(normalized, false, serverMs, true);
        if (notifyLabel) {
          showPublishToast(`⚡ Data Relatif Harga (V-HPBS) (${sourceKode}) ${notifyLabel}`, 'info');
        }
      }
    };

    async function syncFromSupabase() {
      setSyncStatus('syncing');
      setSyncMessage('Menyinkronkan data awal dengan Supabase...');
      try {
        // Step 1: Read locally cached data first for instant zero-latency UI load
        const [localHarm, localIhk, localHpbs] = await Promise.all([
          loadPersistentItem<MonthlyHarmonizationDataset[]>(STORAGE_KEYS.HARMONIZATION),
          loadPersistentItem<IhkCompleteDataset>(STORAGE_KEYS.IHK),
          loadPersistentItem<HpbsDataset>(STORAGE_KEYS.HPBS),
        ]);

        if (!isMounted) return;

        if (localHarm?.data && Array.isArray(localHarm.data) && localHarm.data.length > 0) {
          setDatasets(localHarm.data);
          setSelectedMonthId((curr) => {
            const exists = localHarm.data.some((d) => d.id === curr);
            return exists ? curr : localHarm.data[localHarm.data.length - 1].id;
          });
        }
        if (localIhk?.data && localIhk.data.regions && Object.keys(localIhk.data.regions).length > 0) {
          setIhkDataset(localIhk.data);
        }
        if (
          localHpbs?.data &&
          ((Array.isArray(localHpbs.data.records) && localHpbs.data.records.length > 0) ||
            (Array.isArray(localHpbs.data.periods) && localHpbs.data.periods.length > 0))
        ) {
          setHpbsDataset(normalizeHpbsDataset(localHpbs.data));
        }

        // Step 2: Query Supabase centralized database as Single Source of Truth
        const supaData = await loadWilayahDatasetsFromSupabase(
          userKode,
          isProv ? 'provinsi' : 'kabkota'
        );

        if (!isMounted) return;

        if (supaData.error) {
          setSyncStatus('error');
          setSyncMessage(`Koneksi Supabase bermasalah: ${supaData.error}`);
          return;
        }

        if (supaData.timestamps) {
          lastKnownSupaTimestampsRef.current = {
            ...lastKnownSupaTimestampsRef.current,
            ...supaData.timestamps,
          };
        }

        // --- 2a. Harmonisasi Dataset ---
        if (supaData.harmonisasiPayload && Array.isArray(supaData.harmonisasiPayload) && supaData.harmonisasiPayload.length > 0) {
          await applyRemoteDataset(
            'harmonisasi',
            supaData.harmonisasiPayload,
            supaData.timestamps?.harmonisasi,
            supaData.resolvedKodes?.harmonisasi || userKode
          );
        } else {
          const initialHarm = (localHarm?.data && Array.isArray(localHarm.data) && localHarm.data.length > 0)
            ? localHarm.data
            : generateInitialDatasets().sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
          setDatasets(initialHarm);
          await savePersistentItem(STORAGE_KEYS.HARMONIZATION, initialHarm, false, 1, Date.now(), true);
          const seedHarm = await upsertWilayahDatasetDetailed(
            userKode,
            'harmonisasi',
            initialHarm,
            authUser.agencyName || userKode
          );
          if (seedHarm.success) {
            lastKnownSupaTimestampsRef.current.harmonisasi = seedHarm.updatedAt;
          }
        }

        // --- 2b. IHK Dataset ---
        if (supaData.ihkPayload && supaData.ihkPayload.regions && Object.keys(supaData.ihkPayload.regions).length > 0) {
          await applyRemoteDataset(
            'ihk',
            supaData.ihkPayload,
            supaData.timestamps?.ihk,
            supaData.resolvedKodes?.ihk || userKode
          );
        } else {
          const initialIhk = (localIhk?.data && localIhk.data.regions && Object.keys(localIhk.data.regions).length > 0)
            ? localIhk.data
            : generateInitialIhkDataset();
          setIhkDataset(initialIhk);
          await savePersistentItem(STORAGE_KEYS.IHK, initialIhk, false, 1, Date.now(), true);
          const seedIhk = await upsertWilayahDatasetDetailed(
            userKode,
            'ihk',
            initialIhk,
            authUser.agencyName || userKode
          );
          if (seedIhk.success) {
            lastKnownSupaTimestampsRef.current.ihk = seedIhk.updatedAt;
          }
        }

        // --- 2c. HPBS (SHPB) Dataset ---
        if (
          supaData.hpbsPayload &&
          ((Array.isArray(supaData.hpbsPayload.records) && supaData.hpbsPayload.records.length > 0) ||
            (Array.isArray(supaData.hpbsPayload.periods) && supaData.hpbsPayload.periods.length > 0))
        ) {
          await applyRemoteDataset(
            'hpbs',
            supaData.hpbsPayload,
            supaData.timestamps?.hpbs,
            supaData.resolvedKodes?.hpbs || userKode
          );
        } else {
          // Try reconstructing from granular hpbs_pedagang_records before falling back to local/default seed
          const recoveredFromTable = await loadHpbsFromRecordsTable();
          const initialHpbs = recoveredFromTable
            ? normalizeHpbsDataset(recoveredFromTable)
            : localHpbs?.data &&
              ((Array.isArray(localHpbs.data.records) && localHpbs.data.records.length > 0) ||
                (Array.isArray(localHpbs.data.periods) && localHpbs.data.periods.length > 0))
            ? normalizeHpbsDataset(localHpbs.data)
            : generateInitialHpbsDataset();
          setHpbsDataset(initialHpbs);
          persistHpbsDatasetLocally(initialHpbs, false, Date.now(), true);
          const seedHpbs = await upsertWilayahDatasetDetailed(
            userKode,
            'hpbs',
            initialHpbs,
            authUser.agencyName || userKode
          );
          if (seedHpbs.success) {
            lastKnownSupaTimestampsRef.current.hpbs = seedHpbs.updatedAt;
          }
        }

        if (isMounted) {
          setSyncStatus('synced');
          setSyncMessage('Tersinkron dengan Supabase Cloud');
        }
      } catch (err: any) {
        console.warn('[App] Supabase sync error:', err);
        if (isMounted) {
          setSyncStatus('error');
          setSyncMessage(err?.message || 'Koneksi Supabase bermasalah');
        }
      }
    }

    syncFromSupabase();

    // Step 3: Attach Supabase Realtime (postgres_changes on table wilayah_datasets)
    const channelName = `realtime_wilayah_${userKode}_${Date.now()}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wilayah_datasets',
        },
        async (payload) => {
          if (!isMounted) return;
          const newRow = payload.new as WilayahDatasetRow;
          if (!newRow || !newRow.dataset_type) return;

          // HPBS/SHPB is unified across 14 Kab/Kota — sync across all roles/regions
          const isMatching =
            newRow.dataset_type === 'hpbs' ||
            isProv ||
            newRow.kode_kabkota === userKode ||
            newRow.kode_kabkota === '61.00';
          if (!isMatching) return;

          // Ignore echoes of our own writes
          if (
            newRow.updated_at &&
            lastKnownSupaTimestampsRef.current[newRow.dataset_type] === newRow.updated_at
          ) {
            return;
          }

          // Supabase Realtime truncates payloads > ~1MB; fetch full row if payload is missing
          let resolvedPayload = newRow.payload;
          let resolvedUpdatedAt = newRow.updated_at;
          if (!resolvedPayload) {
            const fullRow = await fetchSingleWilayahDataset(
              newRow.kode_kabkota,
              newRow.dataset_type
            );
            if (!fullRow || !fullRow.payload) return;
            resolvedPayload = fullRow.payload;
            resolvedUpdatedAt = fullRow.updated_at;
          }

          await applyRemoteDataset(
            newRow.dataset_type,
            resolvedPayload,
            resolvedUpdatedAt,
            newRow.kode_kabkota,
            'diperbarui real-time dari perangkat lain!'
          );
          if (isMounted) {
            setSyncStatus('synced');
            setSyncMessage('Tersinkron dengan Supabase Cloud');
          }
        }
      )
      .subscribe();

    // Step 4: Lightweight Supabase Metadata Polling + Window Focus/Visibility Sync
    // Guarantees cross-device sync even if Realtime publication is disabled or payload > 1MB
    let isPolling = false;
    const pollSupabaseUpdates = async () => {
      if (!isMounted || isPolling) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      isPolling = true;
      try {
        const metaRes = await fetchLatestWilayahTimestamps(
          userKode,
          isProv ? 'provinsi' : 'kabkota'
        );
        if (!isMounted || !metaRes.success) return;

        const types: DatasetType[] = ['hpbs', 'harmonisasi', 'ihk'];
        for (const t of types) {
          const remote = metaRes.latest[t];
          if (!remote || !remote.updatedAt) continue;

          const knownStr = lastKnownSupaTimestampsRef.current[t];
          const remoteMs = new Date(remote.updatedAt).getTime();
          const knownMs = knownStr ? new Date(knownStr).getTime() : 0;

          if (remoteMs > knownMs + 500) {
            const fullRow = await fetchSingleWilayahDataset(remote.kodeKabKota, t);
            if (fullRow && fullRow.payload && isMounted) {
              await applyRemoteDataset(
                t,
                fullRow.payload,
                fullRow.updated_at || remote.updatedAt,
                remote.kodeKabKota,
                'disinkronkan otomatis dari perangkat lain!'
              );
              setSyncStatus('synced');
              setSyncMessage('Tersinkron dengan Supabase Cloud');
            }
          }
        }
      } catch (pollErr) {
        console.debug('[App] Supabase poll notice:', pollErr);
      } finally {
        isPolling = false;
      }
    };

    const pollIntervalId = window.setInterval(pollSupabaseUpdates, 8000);
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        pollSupabaseUpdates();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      window.clearInterval(pollIntervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      supabase.removeChannel(realtimeChannel);
    };
  }, [authUser]);

  // Handlers with automatic Supabase UPSERT & multi-device sync
  const handleUpdateHpbsDataset = async (newDataset: HpbsDataset) => {
    setHpbsDataset(newDataset);
    persistHpbsDatasetLocally(newDataset, true, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');

    setSyncStatus('syncing');
    setSyncMessage('Menyinkronkan data V-HPBS ke Supabase...');
    try {
      const res = await syncHpbsToSupabase(newDataset, userKode);
      if (res.success) {
        if (res.updatedAt) {
          lastKnownSupaTimestampsRef.current.hpbs = res.updatedAt;
        }
        setSyncStatus('synced');
        setSyncMessage('Tersinkron dengan Supabase Cloud');
        showPublishToast('✓ Data Relatif Harga (V-HPBS) berhasil disimpan & tersinkron ke Supabase!');
      } else {
        setSyncStatus('error');
        setSyncMessage(`Gagal sinkron SHPB: ${res.error || 'Periksa koneksi/izin Supabase'}`);
        showPublishToast(
          `⚠️ Data tersimpan lokal, namun GAGAL sinkron ke Supabase: ${res.error || 'Periksa tabel/izin Supabase'}`,
          'error'
        );
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Koneksi ke Supabase gagal');
      showPublishToast(
        `⚠️ Gagal menyimpan V-HPBS ke Supabase: ${err?.message || 'Koneksi terganggu'}`,
        'error'
      );
    }
    savePublishedHpbsDataset(newDataset, userKode, { skipSupabase: true });
  };

  const handleResetHpbsDataset = async () => {
    const initial = generateInitialHpbsDataset();
    setHpbsDataset(initial);
    persistHpbsDatasetLocally(initial, false, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
    setSyncStatus('syncing');
    const res = await syncHpbsToSupabase(initial, userKode);
    if (res.success) {
      if (res.updatedAt) {
        lastKnownSupaTimestampsRef.current.hpbs = res.updatedAt;
      }
      setSyncStatus('synced');
      setSyncMessage('Tersinkron dengan Supabase Cloud');
      showPublishToast('✓ Data V-HPBS telah direset ke data awal resmi di Supabase.', 'info');
    } else {
      setSyncStatus('error');
      setSyncMessage(res.error || 'Gagal mereset data di Supabase');
      showPublishToast(`⚠️ Gagal mereset V-HPBS di Supabase: ${res.error || 'Error'}`, 'error');
    }
    resetServerHpbsDataset(userKode);
  };

  const handleSaveIhkDataset = async (newDataset: IhkCompleteDataset) => {
    setIhkDataset(newDataset);
    savePersistentItem(STORAGE_KEYS.IHK, newDataset, true, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');

    setSyncStatus('syncing');
    setSyncMessage('Menyinkronkan data IHK ke Supabase...');
    try {
      const res = await syncIhkToSupabase(newDataset, userKode);
      if (res.success) {
        if (res.updatedAt) {
          lastKnownSupaTimestampsRef.current.ihk = res.updatedAt;
        }
        setSyncStatus('synced');
        setSyncMessage('Tersinkron dengan Supabase Cloud');
        showPublishToast('✓ File IHK berhasil diunggah & disimpan ke Supabase!');
      } else {
        setSyncStatus('error');
        setSyncMessage(`Gagal sinkron IHK: ${res.error || 'Periksa koneksi/izin Supabase'}`);
        showPublishToast(
          `⚠️ Data IHK tersimpan lokal, namun GAGAL sinkron ke Supabase: ${res.error || 'Error'}`,
          'error'
        );
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Koneksi ke Supabase gagal');
      showPublishToast(`⚠️ Gagal menyimpan IHK ke Supabase: ${err?.message || 'Error'}`, 'error');
    }
    savePublishedIhkDataset(newDataset, userKode, { skipSupabase: true });
  };

  const handleResetIhkDataset = async () => {
    const initial = generateInitialIhkDataset();
    setIhkDataset(initial);
    savePersistentItem(STORAGE_KEYS.IHK, initial, false, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
    setSyncStatus('syncing');
    const res = await syncIhkToSupabase(initial, userKode);
    if (res.success) {
      if (res.updatedAt) {
        lastKnownSupaTimestampsRef.current.ihk = res.updatedAt;
      }
      setSyncStatus('synced');
      setSyncMessage('Tersinkron dengan Supabase Cloud');
      showPublishToast('✓ Data IHK telah direset ke data awal resmi di Supabase.', 'info');
    } else {
      setSyncStatus('error');
      setSyncMessage(res.error || 'Gagal mereset IHK di Supabase');
      showPublishToast(`⚠️ Gagal mereset IHK di Supabase: ${res.error || 'Error'}`, 'error');
    }
    resetServerIhkDataset(userKode);
  };

  const handleOpenIhkFileManager = (tab: 'import' | 'template' | 'export' | 'manage' = 'import') => {
    setIhkModalState({ isOpen: true, tab });
  };

  // Active dataset object (defaults to selected month or latest available month)
  const activeDataset =
    datasets.find((d) => d.id === selectedMonthId) ||
    (datasets.length > 0 ? datasets[datasets.length - 1] : null);

  // Handlers with automatic persistent storage & Supabase UPSERT
  const handleUpdateDataset = async (updated: MonthlyHarmonizationDataset) => {
    const next = datasets.map((d) => (d.id === updated.id ? updated : d));
    setDatasets(next);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, next, true, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');

    setSyncStatus('syncing');
    try {
      const res = await syncHarmonisasiToSupabase(next, userKode, regions);
      if (res.success) {
        if (res.updatedAt) {
          lastKnownSupaTimestampsRef.current.harmonisasi = res.updatedAt;
        }
        setSyncStatus('synced');
        setSyncMessage('Tersinkron dengan Supabase Cloud');
        showPublishToast('✓ Perubahan status komoditas berhasil disimpan ke Supabase & tersinkron real-time!');
      } else {
        setSyncStatus('error');
        setSyncMessage(`Gagal sinkron Harmonisasi: ${res.error || 'Error'}`);
        showPublishToast(`⚠️ Gagal sinkron ke Supabase: ${res.error || 'Error'}`, 'error');
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Koneksi ke Supabase gagal');
      showPublishToast(`⚠️ Gagal sinkron ke Supabase: ${err?.message || 'Error'}`, 'error');
    }
    savePublishedDatasets(next, userKode, { skipSupabase: true });
  };

  const handleAddMonth = async (newDataset: MonthlyHarmonizationDataset) => {
    const filtered = datasets.filter((d) => d.id !== newDataset.id);
    const combined = [...filtered, newDataset].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    setDatasets(combined);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, combined, true, 1, Date.now(), true);
    setSelectedMonthId(newDataset.id);
    setActiveTab('grid');

    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
    setSyncStatus('syncing');
    try {
      const res = await syncHarmonisasiToSupabase(combined, userKode, regions);
      if (res.success) {
        if (res.updatedAt) {
          lastKnownSupaTimestampsRef.current.harmonisasi = res.updatedAt;
        }
        setSyncStatus('synced');
        setSyncMessage('Tersinkron dengan Supabase Cloud');
        showPublishToast(`✓ Periode ${newDataset.monthLabel} berhasil ditambahkan & disimpan ke Supabase!`);
      } else {
        setSyncStatus('error');
        setSyncMessage(res.error || 'Gagal menyimpan periode ke Supabase');
        showPublishToast(`⚠️ Gagal sinkron ke Supabase: ${res.error || 'Error'}`, 'error');
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Koneksi ke Supabase gagal');
    }
    savePublishedDatasets(combined, userKode, { skipSupabase: true });
  };

  const handleImportDatasets = async (incoming: MonthlyHarmonizationDataset | MonthlyHarmonizationDataset[], replaceAll: boolean = false) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    if (list.length === 0) return;

    let combined: MonthlyHarmonizationDataset[];
    if (replaceAll) {
      combined = [...list];
    } else {
      const incomingIds = new Set(list.map((d) => d.id));
      const existingFiltered = datasets.filter((d) => !incomingIds.has(d.id));
      combined = [...existingFiltered, ...list];
    }
    combined.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    setDatasets(combined);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, combined, true, 1, Date.now(), true);
    setSelectedMonthId(list[0].id);
    setActiveTab('grid');

    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
    setSyncStatus('syncing');
    setSyncMessage(`Menyimpan ${list.length} periode ke Supabase...`);
    try {
      const res = await syncHarmonisasiToSupabase(combined, userKode, regions);
      if (res.success) {
        if (res.updatedAt) {
          lastKnownSupaTimestampsRef.current.harmonisasi = res.updatedAt;
        }
        setSyncStatus('synced');
        setSyncMessage('Tersinkron dengan Supabase Cloud');
        showPublishToast(
          `✓ Data ${list.length} periode berhasil diunggah & disimpan secara permanen ke Supabase!`
        );
      } else {
        setSyncStatus('error');
        setSyncMessage(res.error || 'Gagal mengunggah ke Supabase');
        showPublishToast(`⚠️ Gagal menyimpan ke Supabase: ${res.error || 'Error'}`, 'error');
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Koneksi ke Supabase gagal');
    }
    savePublishedDatasets(combined, userKode, { skipSupabase: true });
  };

  const handleDeleteMonth = async (monthId: string) => {
    const remaining = datasets.filter((d) => d.id !== monthId);
    if (selectedMonthId === monthId) {
      setSelectedMonthId(remaining[0]?.id || '');
    }
    setDatasets(remaining);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, remaining, true, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');

    setSyncStatus('syncing');
    await deleteHarmonisasiPeriodFromSupabase(monthId, userKode);
    const res = await upsertWilayahDatasetDetailed(
      userKode,
      'harmonisasi',
      remaining,
      authUser?.agencyName || userKode
    );
    if (res.success) {
      lastKnownSupaTimestampsRef.current.harmonisasi = res.updatedAt;
      setSyncStatus('synced');
      setSyncMessage('Tersinkron dengan Supabase Cloud');
      showPublishToast('✓ Perubahan penghapusan data telah diperbarui di Supabase.');
    } else {
      setSyncStatus('error');
      setSyncMessage(res.error || 'Gagal menghapus data di Supabase');
      showPublishToast(`⚠️ Gagal memperbarui penghapusan di Supabase: ${res.error || 'Error'}`, 'error');
    }
    savePublishedDatasets(remaining, userKode, { skipSupabase: true });
  };

  const handleDeleteMonths = async (monthIds: string[]) => {
    const idSet = new Set(monthIds);
    const remaining = datasets.filter((d) => !idSet.has(d.id));
    if (idSet.has(selectedMonthId)) {
      setSelectedMonthId(remaining[0]?.id || '');
    }
    setDatasets(remaining);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, remaining, true, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');

    setSyncStatus('syncing');
    for (const mId of monthIds) {
      await deleteHarmonisasiPeriodFromSupabase(mId, userKode);
    }
    const res = await upsertWilayahDatasetDetailed(
      userKode,
      'harmonisasi',
      remaining,
      authUser?.agencyName || userKode
    );
    if (res.success) {
      lastKnownSupaTimestampsRef.current.harmonisasi = res.updatedAt;
      setSyncStatus('synced');
      setSyncMessage('Tersinkron dengan Supabase Cloud');
      showPublishToast('✓ Perubahan penghapusan data telah diperbarui di Supabase.');
    } else {
      setSyncStatus('error');
      setSyncMessage(res.error || 'Gagal menghapus data di Supabase');
      showPublishToast(`⚠️ Gagal memperbarui penghapusan di Supabase: ${res.error || 'Error'}`, 'error');
    }
    savePublishedDatasets(remaining, userKode, { skipSupabase: true });
  };

  const handleClearAllDatasets = () => {
    setDatasets([]);
    setSelectedMonthId('');
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, [], true, 1, Date.now(), true);
    const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
    upsertWilayahDataset(userKode, 'harmonisasi', [], authUser?.agencyName || userKode);
    savePublishedDatasets([], userKode, { skipSupabase: true });
  };

  const handleResetData = () => {
    if (window.confirm('Reset semua data kembali ke rekap standar awal? Perubahan manual akan dikembalikan.')) {
      const initial = generateInitialDatasets();
      setDatasets(initial);
      setSelectedMonthId(initial[0].id);
      savePersistentItem(STORAGE_KEYS.HARMONIZATION, initial, false, 1, Date.now(), true);
      const userKode = formatKodeKabKota(authUser?.regionCode || '61.00');
      upsertWilayahDataset(userKode, 'harmonisasi', initial, authUser?.agencyName || userKode);
      resetServerDatasets(userKode).then(() => {
        showPublishToast('✓ Data harmonisasi telah direset ke rekap awal di Supabase.', 'info');
      });
    }
  };

  const handleSelectCommodity = (commodityId: string) => {
    setSelectedCommodityId(commodityId);
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Owner Authorization Helpers
  const requireOwner = (actionName: string, callback: () => void) => {
    if (isOwner) {
      callback();
    } else {
      setPendingActionName(actionName);
      setPendingOwnerAction(() => callback);
      setOwnerAuthModalOpen(true);
    }
  };

  const handleOwnerAuthSuccess = () => {
    setIsOwner(true);
    try {
      localStorage.setItem(OWNER_STORAGE_KEY, 'true');
    } catch (e) {
      console.error(e);
    }
    setOwnerAuthModalOpen(false);
    if (pendingOwnerAction) {
      const act = pendingOwnerAction;
      setPendingOwnerAction(null);
      act();
    }
  };

  const handleLogoutOwner = () => {
    setIsOwner(false);
    try {
      localStorage.removeItem(OWNER_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    if (modalState.isOpen && modalState.mode !== 'export') {
      setModalState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handlePortalLogin = (user: AuthUser) => {
    setAuthUser(user);
    if (user.role === 'admin_provinsi') {
      setSelectedRegionId('all');
      setIsOwner(true);
      try {
        localStorage.setItem(OWNER_STORAGE_KEY, 'true');
      } catch {}
      showPublishToast('Selamat Datang, Admin Provinsi! Akses konsolidasi 14 Kabupaten/Kota aktif.', 'success');
    } else {
      setSelectedRegionId(user.regionId);
      setIsOwner(false);
      try {
        localStorage.removeItem(OWNER_STORAGE_KEY);
      } catch {}
      showPublishToast(`Selamat Datang, ${user.agencyName || user.regionName}! Dashboard menyesuaikan wilayah Anda.`, 'success');
    }
  };

  const handlePortalLogout = () => {
    setAuthUser(null);
    setIsOwner(false);
    setSelectedRegionId('all');
    try {
      sessionStorage.removeItem('seharga_auth_user');
      sessionStorage.removeItem('seharga_portal_auth_user');
      sessionStorage.removeItem(PORTAL_AUTH_KEY);
      localStorage.removeItem('seharga_auth_user');
      localStorage.removeItem('seharga_portal_auth_user');
      localStorage.removeItem(PORTAL_AUTH_KEY);
      localStorage.removeItem(OWNER_STORAGE_KEY);
    } catch {}
    showPublishToast('Sesi telah diakhiri. Silakan masuk kembali melalui Portal Instansi.', 'info');
  };

  // Render Portal Login Landing Page if user has not authenticated
  if (!authUser) {
    return <PortalLoginPage onLogin={handlePortalLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] flex flex-row min-w-[1024px]">
      {/* Fixed Navigation Sidebar (Synchronized with PC layout, permanently fixed) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasets={datasets}
        isOwner={isOwner}
        ownerEmail={OWNER_EMAIL}
        authUser={authUser}
        onLogout={handlePortalLogout}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onOpenOwnerAuth={(actionName) => requireOwner(actionName || 'Akses Owner', () => {})}
        onLogoutOwner={handleLogoutOwner}
        isOpenMobile={false}
        onCloseMobile={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        hasNewVersion={hasNewVersion}
        onForceRefresh={handleManualSync}
        navOrientation="vertical"
        onToggleOrientation={() => {}}
        onOpenAddMonth={() => requireOwner('Tambah Bulan', () => setModalState({ isOpen: true, mode: 'add_month' }))}
        onOpenImport={() => requireOwner('Import File Excel', () => setModalState({ isOpen: true, mode: 'import' }))}
        onOpenManage={() => requireOwner('Kelola Data', () => setModalState({ isOpen: true, mode: 'manage_months' }))}
        onExportExcel={() => exportHarmonizationToExcel(datasets, regions)}
        onResetData={() => requireOwner('Reset Data Standar', handleResetData)}
        onOpenIhkFileManager={handleOpenIhkFileManager}
        onOpenHpbsImport={() => setIsHpbsImportModalOpen(true)}
        onExportHpbs={() => exportHpbsAnalysisToExcel(aggregateHpbsData(hpbsDataset.records), hpbsDataset.records)}
        onDownloadHpbsTemplate={() => downloadHpbsTemplateExcel(hpbsDataset.records)}
        onResetHpbs={() => requireOwner('Reset Data Standar V-HPBS', handleResetHpbsDataset)}
        hpbsSubTab={hpbsSubTab}
        onSelectHpbsSubTab={setHpbsSubTab}
      />

      {/* Main Content Area Column (Permanently Fixed Wide Sidebar synced like PC) */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-screen"
      >
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          datasets={datasets}
          isOwner={isOwner}
          ownerEmail={OWNER_EMAIL}
          authUser={authUser}
          onLogout={handlePortalLogout}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
          syncStatus={syncStatus}
          syncMessage={syncMessage}
          onOpenOwnerAuth={(actionName) => requireOwner(actionName || 'Akses Owner', () => {})}
          onLogoutOwner={handleLogoutOwner}
          onToggleSidebarMobile={() => {}}
          navOrientation="vertical"
          onToggleOrientation={() => {}}
          onOpenAddMonth={() => requireOwner('Tambah Bulan', () => setModalState({ isOpen: true, mode: 'add_month' }))}
          onOpenImport={() => requireOwner('Import File Excel', () => setModalState({ isOpen: true, mode: 'import' }))}
          onOpenManage={() => requireOwner('Kelola Data', () => setModalState({ isOpen: true, mode: 'manage_months' }))}
          onExportExcel={() => exportHarmonizationToExcel(datasets, regions)}
          onResetData={() => requireOwner('Reset Data Standar', handleResetData)}
          onOpenIhkFileManager={handleOpenIhkFileManager}
          onOpenHpbsImport={() => setIsHpbsImportModalOpen(true)}
          onExportHpbs={() => exportHpbsAnalysisToExcel(aggregateHpbsData(hpbsDataset.records), hpbsDataset.records)}
          onDownloadHpbsTemplate={() => downloadHpbsTemplateExcel(hpbsDataset.records)}
          onResetHpbs={() => requireOwner('Reset Data Standar V-HPBS', handleResetHpbsDataset)}
          hasNewVersion={hasNewVersion}
          onForceRefresh={handleManualSync}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
        />

        {/* Main Container Content */}
        <main className="flex-1 w-full px-3 sm:px-5 lg:px-8 pt-3 pb-24 lg:pb-12 space-y-4">
        {/* PUSAT FILTER SATU PINTU HARMONISASI (Hanya tampil pada tab harmonisasi 4 level, ringkasan, atau tabel wilayah) */}
        {activeTab !== 'ihk_consumer' && activeTab !== 'hpbs_rh' && datasets.length > 0 && (
          <UnifiedFilterBar
            datasets={datasets}
            regions={regions}
            selectedMonthId={selectedMonthId}
            setSelectedMonthId={setSelectedMonthId}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            selectedPriceLevel={selectedPriceLevel}
            setSelectedPriceLevel={setSelectedPriceLevel}
            authUser={authUser}
          />
        )}

        {/* View switching */}
        {activeTab === 'ihk_consumer' ? (
          <IhkConsumerAnalysisView
            ihkDataset={ihkDataset}
            onOpenFileManager={handleOpenIhkFileManager}
          />
        ) : activeTab === 'hpbs_rh' ? (
          <HpbsAnalysisView
            dataset={hpbsDataset}
            onUpdateDataset={handleUpdateHpbsDataset}
            onResetDataset={() => requireOwner('Reset Data Standar V-HPBS', handleResetHpbsDataset)}
            isOwner={isOwner}
            onRequireOwner={requireOwner}
            activeSubTab={hpbsSubTab}
            onSelectSubTab={setHpbsSubTab}
          />
        ) : datasets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-xs">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <span className="text-2xl font-bold">📊</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Database Belum Berisi Periode Bulan
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
              Data awal telah dikosongkan. Anda dapat mengunggah file Excel berformat bulanan (Januari s.d. September) atau menambahkan data secara mandiri.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => requireOwner('Import File Excel', () => setModalState({ isOpen: true, mode: 'import' }))}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Import File Excel (.xlsx / .csv)</span>
                {!isOwner && <span className="text-[10px] opacity-80">🔒</span>}
              </button>
              <button
                onClick={() => requireOwner('Tambah Bulan Manual', () => setModalState({ isOpen: true, mode: 'add_month' }))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>+ Tambah Bulan Manual</span>
                {!isOwner && <span className="text-[10px] opacity-80">🔒</span>}
              </button>
              <button
                onClick={() => requireOwner('Muat Data Standar', handleResetData)}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Muat Contoh Standar (Jan-Jun 2024)</span>
                {!isOwner && <span className="text-[10px] opacity-80">🔒</span>}
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'price_levels' && activeDataset && (
              <PriceLevelHarmonizationView
                currentDataset={activeDataset}
                allDatasets={datasets}
                regions={regions}
                selectedMonthId={selectedMonthId}
                onSelectMonth={setSelectedMonthId}
                selectedRegionId={selectedRegionId}
                selectedPriceLevel={selectedPriceLevel}
                setSelectedPriceLevel={setSelectedPriceLevel}
                onSelectCommodityForSeries={handleSelectCommodity}
                onExportExcel={() => exportHarmonizationToExcel(datasets, regions)}
                onUpdateDataset={handleUpdateDataset}
              />
            )}

            {activeTab === 'overview' && (
              <DashboardOverview
                datasets={datasets}
                regions={regions}
                selectedRegionId={selectedRegionId}
                selectedPriceLevel={selectedPriceLevel}
                setSelectedPriceLevel={setSelectedPriceLevel}
                onSelectCommodity={handleSelectCommodity}
              />
            )}

            {activeTab === 'grid' && activeDataset && (
              <MonthlyHarmonizationGrid
                dataset={activeDataset}
                regions={regions}
                selectedRegionId={selectedRegionId}
                selectedPriceLevel={selectedPriceLevel}
                setSelectedPriceLevel={setSelectedPriceLevel}
                onUpdateDataset={handleUpdateDataset}
                onSelectCommodity={handleSelectCommodity}
              />
            )}
          </>
        )}
      </main>

      {/* Footer info bar */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="w-full px-3 sm:px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Dashboard Harmonisasi & IHK Konsumen</span>
            <span>•</span>
            <span>Kalimantan Barat</span>
          </div>
          <div>
            Data: Harmonisasi ({datasets.length} bulan, 38 komoditas, 14 kab/kota) & IHK Konsumen (32 bulan Jan '24 - Ags '26, 46 komoditas, 5 kab/kota)
          </div>
        </div>
      </footer>
      </div>

      {/* Data Management Modal (Harmonisasi 4 Level) */}
      <DataManagementModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        mode={modalState.mode}
        datasets={datasets}
        regions={regions}
        isOwner={isOwner}
        onRequireOwner={requireOwner}
        onAddMonth={handleAddMonth}
        onImportDatasets={handleImportDatasets}
        onDeleteMonth={handleDeleteMonth}
        onDeleteMonths={handleDeleteMonths}
        onClearAllDatasets={handleClearAllDatasets}
        onResetData={handleResetData}
      />

      {/* IHK Dedicated Data Management Modal (File Manager Terpisah) */}
      <IhkDataManagementModal
        isOpen={ihkModalState.isOpen}
        onClose={() => setIhkModalState((prev) => ({ ...prev, isOpen: false }))}
        ihkDataset={ihkDataset}
        dataset={ihkDataset}
        onSaveIhkDataset={handleSaveIhkDataset}
        onSaveDataset={handleSaveIhkDataset}
        onResetIhkDataset={handleResetIhkDataset}
        onResetDefault={handleResetIhkDataset}
        initialTab={ihkModalState.tab}
      />

      {/* HPBS Dedicated Import Modal */}
      <HpbsImportModal
        isOpen={isHpbsImportModalOpen}
        onClose={() => setIsHpbsImportModalOpen(false)}
        sampleRecords={hpbsDataset.records}
        existingPeriods={hpbsDataset.periods?.map((p) => ({ id: p.id, label: p.label })) || []}
        activePeriodId={hpbsDataset.activePeriodId || '2026-09'}
        onImportSuccess={(rawNewRecords, detectedPeriod, mode = 'replace_all', customPeriodId, customPeriodLabel) => {
          const newRecords = filterValidHpbsRecords(rawNewRecords);
          const targetId = customPeriodId || hpbsDataset.activePeriodId || '2026-09';
          const targetLabel = customPeriodLabel || detectedPeriod || 'Data Unggahan';
          const targetShort = targetLabel.length > 8 ? targetLabel.slice(0, 8) : targetLabel;
          const targetComp = detectedPeriod
            ? `${detectedPeriod} vs Bulan Sebelumnya`
            : hpbsDataset.periodTitle || 'Bulan Berjalan vs Lalu';

          const newOrUpdatedPeriod: HpbsMonthlyPeriod = {
            id: targetId,
            label: targetLabel,
            shortLabel: targetShort,
            comparisonLabel: targetComp,
            records: newRecords,
            lastUpdated: new Date().toISOString(),
          };

          if (mode === 'replace_all') {
            // Ganti Seluruh Dataset: Hapus data default bawaan, gunakan hanya data file pengguna
            const cleanDataset: HpbsDataset = {
              periodTitle: targetComp,
              records: newRecords,
              activePeriodId: targetId,
              periods: [newOrUpdatedPeriod],
              lastUpdated: new Date().toISOString(),
              version: '2.1.0',
            };
            handleUpdateHpbsDataset(cleanDataset);
          } else {
            // Tambahkan ke dataset yang ada (simpan data periode lainnya)
            const basePeriods =
              hpbsDataset.periods && hpbsDataset.periods.length > 0
                ? hpbsDataset.periods
                : generatePeriodsFromRecords(newRecords, targetId);

            const existingIdx = basePeriods.findIndex((p) => p.id === targetId);
            let updatedPeriods: HpbsMonthlyPeriod[];
            if (existingIdx >= 0) {
              updatedPeriods = basePeriods.map((p, idx) =>
                idx === existingIdx ? newOrUpdatedPeriod : p
              );
            } else {
              updatedPeriods = [...basePeriods, newOrUpdatedPeriod].sort((a, b) =>
                a.id.localeCompare(b.id)
              );
            }

            handleUpdateHpbsDataset({
              ...hpbsDataset,
              periodTitle: targetComp,
              records: newRecords,
              activePeriodId: targetId,
              periods: updatedPeriods,
              lastUpdated: new Date().toISOString(),
            });
          }
        }}
      />

      {/* Backup & Restore / Database Resilience Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        datasets={datasets}
        ihkDataset={ihkDataset}
        hpbsDataset={hpbsDataset}
        onRestoreSuccess={(restored) => {
          if (restored.datasets && restored.datasets.length > 0) {
            setDatasets(restored.datasets);
            setSelectedMonthId(restored.datasets[restored.datasets.length - 1].id);
          }
          if (restored.ihkDataset) {
            setIhkDataset(restored.ihkDataset);
          }
          if (restored.hpbsDataset) {
            setHpbsDataset(normalizeHpbsDataset(restored.hpbsDataset));
          }
        }}
        onShowToast={showPublishToast}
      />

      {/* Owner Authentication Modal */}
      <OwnerAuthModal
        isOpen={ownerAuthModalOpen}
        onClose={() => {
          setOwnerAuthModalOpen(false);
          setPendingOwnerAction(null);
        }}
        onSuccess={handleOwnerAuthSuccess}
        targetActionName={pendingActionName}
      />

      {/* User Management Modal for Admin Provinsi & Admin Kab/Kota */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUser={authUser}
        onShowToast={showPublishToast}
      />

      {/* Floating Server Publication Notification Toast */}
      {publishToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-bottom-3 duration-200 ${
            publishToast.type === 'error'
              ? 'border-rose-500/60'
              : publishToast.type === 'info'
              ? 'border-sky-500/50'
              : 'border-emerald-500/40'
          }`}
          role="status"
        >
          <div
            className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
              publishToast.type === 'error'
                ? 'bg-rose-500/20 text-rose-400'
                : publishToast.type === 'info'
                ? 'bg-sky-500/20 text-sky-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {publishToast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white mb-0.5 flex items-center gap-1.5">
              <span>
                {publishToast.type === 'error' ? 'Peringatan Sinkronisasi' : 'Status Publikasi Data'}
              </span>
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  publishToast.type === 'error'
                    ? 'bg-rose-400'
                    : publishToast.type === 'info'
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
                }`}
              />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              {publishToast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPublishToast(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation for Quick Thumb Navigation on HP */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
        }}
        onOpenSidebar={() => {}}
        hasNewVersion={hasNewVersion}
        onForceRefresh={handleManualSync}
      />

      {/* Floating Auto-Update Notification Banner for All Devices */}
      <UpdateNotificationBanner
        hasNewVersion={hasNewVersion}
        version={serverVersionInfo?.version}
      />
    </div>
  );
}
