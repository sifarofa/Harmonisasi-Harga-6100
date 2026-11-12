import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
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

const LOCAL_STORAGE_KEY = STORAGE_KEYS.HARMONIZATION;
const IHK_STORAGE_KEY = STORAGE_KEYS.IHK;
const HPBS_STORAGE_KEY = STORAGE_KEYS.HPBS;
const OWNER_STORAGE_KEY = 'harmonisasi_is_owner';
const PORTAL_AUTH_KEY = 'seharga_portal_auth_user';
const OWNER_EMAIL = 'sifarofatunnisa24@gmail.com';

// Ensures HPBS dataset always has complete routine monthly periods (Jan s/d Ags 2026) and no zero-price/empty rows
function normalizeHpbsDataset(raw: any): HpbsDataset {
  if (!raw || !Array.isArray(raw.records) || raw.records.length === 0) {
    return generateInitialHpbsDataset();
  }
  const cleanRecords = filterValidHpbsRecords(raw.records);
  if (cleanRecords.length === 0) {
    return generateInitialHpbsDataset();
  }
  const activePeriodId = raw.activePeriodId || '2026-09';
  let periods = raw.periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    periods = generatePeriodsFromRecords(cleanRecords, activePeriodId);
  } else {
    periods = periods.map((p: any) => ({
      ...p,
      records: filterValidHpbsRecords(p.records),
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
function persistHpbsDatasetLocally(dataset: HpbsDataset, hasUserEdits = true, customTimestamp?: number) {
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
    savePersistentItem(HPBS_STORAGE_KEY, toSave, hasUserEdits, 1, customTimestamp);
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
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
    if (datasets.length > 0) {
      return datasets[datasets.length - 1].id;
    }
    return '2026-09';
  });
  // Institutional Portal User State
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(PORTAL_AUTH_KEY) || sessionStorage.getItem(PORTAL_AUTH_KEY);
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

  // Manual or on-demand multi-device synchronization
  const handleManualSync = async () => {
    try {
      showPublishToast('🔄 Mengambil data terbaru dari server & menyinkronkan...', 'info');
      const [harmRes, ihkRes, hpbsRes] = await Promise.all([
        fetchPublishedDatasets(),
        fetchPublishedIhkDataset(),
        fetchPublishedHpbsDataset(),
      ]);

      let syncUpdated = false;

      // Harmonisasi
      if (harmRes && harmRes.datasets && harmRes.datasets.length > 0) {
        const sorted = harmRes.datasets.sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        );
        const serverTime = harmRes.lastUpdated ? new Date(harmRes.lastUpdated).getTime() : Date.now();
        setDatasets(sorted);
        await savePersistentItem(STORAGE_KEYS.HARMONIZATION, sorted, false, 1, serverTime);
        const latestMonthId = sorted[sorted.length - 1].id;
        setSelectedMonthId(latestMonthId);
        syncUpdated = true;
      }

      // IHK (Analisis RH Stabil IHK)
      if (ihkRes && ihkRes.ihkDataset && ihkRes.ihkDataset.regions) {
        const serverTime = ihkRes.lastUpdated ? new Date(ihkRes.lastUpdated).getTime() : Date.now();
        setIhkDataset(ihkRes.ihkDataset);
        await savePersistentItem(STORAGE_KEYS.IHK, ihkRes.ihkDataset, false, 1, serverTime);
        syncUpdated = true;
      }

      // HPBS
      if (hpbsRes && hpbsRes.dataset && Array.isArray(hpbsRes.dataset.records)) {
        const normalized = normalizeHpbsDataset(hpbsRes.dataset);
        const serverTime = hpbsRes.lastUpdated ? new Date(hpbsRes.lastUpdated).getTime() : Date.now();
        setHpbsDataset(normalized);
        persistHpbsDatasetLocally(normalized, false, serverTime);
        syncUpdated = true;
      }

      if (hasNewVersion) {
        forceRefresh();
      } else {
        showPublishToast(
          syncUpdated
            ? '✓ Data terbaru dari server berhasil disinkronkan ke perangkat ini!'
            : '✓ Data sudah sinkron dengan server.',
          'success'
        );
      }
    } catch (e) {
      console.warn('Manual sync error:', e);
      forceRefresh();
    }
  };

  // Smart Sync & Persistence Engine: Initial Mount
  useEffect(() => {
    let isMounted = true;
    async function initAndSyncData() {
      try {
        // Step 1: Read locally stored data from IndexedDB
        const [localHarm, localIhk, localHpbs] = await Promise.all([
          loadPersistentItem<MonthlyHarmonizationDataset[]>(STORAGE_KEYS.HARMONIZATION),
          loadPersistentItem<IhkCompleteDataset>(STORAGE_KEYS.IHK),
          loadPersistentItem<HpbsDataset>(STORAGE_KEYS.HPBS),
        ]);

        if (!isMounted) return;

        // Populate local state immediately if local storage has valid data so page loads instantly
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
        if (localHpbs?.data && Array.isArray(localHpbs.data.records) && localHpbs.data.records.length > 0) {
          setHpbsDataset(normalizeHpbsDataset(localHpbs.data));
        }

        // Step 2: Query server datasets
        const [harmRes, ihkRes, hpbsRes] = await Promise.all([
          fetchPublishedDatasets(),
          fetchPublishedIhkDataset(),
          fetchPublishedHpbsDataset(),
        ]);

        if (!isMounted) return;

        // Step 3: Server-Authoritative Multi-Device Synchronization

        // --- HARMONISASI ---
        const serverHarmTime = harmRes?.lastUpdated ? new Date(harmRes.lastUpdated).getTime() : 0;
        const localHarmTime = localHarm?.lastModified || 0;

        if (harmRes && Array.isArray(harmRes.datasets) && harmRes.datasets.length > 0) {
          const sorted = harmRes.datasets.sort((a, b) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
          );
          const serverLatest = sorted[sorted.length - 1]?.id || '';
          const localLatest = Array.isArray(localHarm?.data) && localHarm.data.length > 0
            ? localHarm.data[localHarm.data.length - 1]?.id || ''
            : '';
          const localHasLatest = Array.isArray(localHarm?.data) && localHarm.data.some((d: any) => d.id === serverLatest);

          // Server wins if:
          // 1. Local has no data or is empty
          // 2. Local does not have the server's latest month (e.g. 2026-09)
          // 3. Server has more months than local
          // 4. Server latest month is newer than local latest month
          // 5. Local has no user edits
          // 6. Server timestamp is newer
          const serverWins =
            !localHarm?.data ||
            localHarm.data.length === 0 ||
            !localHasLatest ||
            sorted.length > localHarm.data.length ||
            serverLatest > localLatest ||
            !localHarm.hasUserEdits ||
            serverHarmTime > localHarmTime;

          if (serverWins) {
            setDatasets(sorted);
            await savePersistentItem(STORAGE_KEYS.HARMONIZATION, sorted, false, 1, serverHarmTime || Date.now());
            setSelectedMonthId((curr) => {
              const exists = sorted.some((d) => d.id === curr);
              if (!exists || (serverLatest && curr < serverLatest)) {
                return serverLatest;
              }
              return curr;
            });
          } else {
            // Local edits are strictly newer than server
            const localSorted = [...localHarm.data].sort((a: any, b: any) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
            setDatasets(localSorted);
            if (localSorted.length >= sorted.length && localSorted.some((d: any) => d.id === serverLatest)) {
              savePublishedDatasets(localSorted);
            }
          }
        } else if (localHarm?.data && Array.isArray(localHarm.data) && localHarm.data.length > 0) {
          const localSorted = [...localHarm.data].sort((a: any, b: any) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
          setDatasets(localSorted);
          savePublishedDatasets(localSorted);
        }

        // --- IHK (Analisis RH Stabil IHK) ---
        const serverIhkTime = ihkRes?.lastUpdated ? new Date(ihkRes.lastUpdated).getTime() : 0;
        const localIhkTime = localIhk?.lastModified || 0;

        if (ihkRes && ihkRes.ihkDataset && ihkRes.ihkDataset.regions && Object.keys(ihkRes.ihkDataset.regions).length > 0) {
          const serverWins =
            !localIhk?.data ||
            !localIhk.data.regions ||
            !localIhk.hasUserEdits ||
            serverIhkTime > localIhkTime;

          if (serverWins) {
            setIhkDataset(ihkRes.ihkDataset);
            await savePersistentItem(STORAGE_KEYS.IHK, ihkRes.ihkDataset, false, 1, serverIhkTime || Date.now());
          } else {
            setIhkDataset(localIhk.data);
            savePublishedIhkDataset(localIhk.data);
          }
        } else if (localIhk?.data && localIhk.data.regions && Object.keys(localIhk.data.regions).length > 0) {
          setIhkDataset(localIhk.data);
          savePublishedIhkDataset(localIhk.data);
        }

        // --- HPBS (Analisis RH SHPB) ---
        const serverHpbsTime = hpbsRes?.lastUpdated ? new Date(hpbsRes.lastUpdated).getTime() : 0;
        const localHpbsTime = localHpbs?.lastModified || 0;

        if (hpbsRes && hpbsRes.dataset && Array.isArray(hpbsRes.dataset.records) && hpbsRes.dataset.records.length > 0) {
          const normalized = normalizeHpbsDataset(hpbsRes.dataset);
          const localCount = localHpbs?.data?.records?.length || 0;
          // Server wins if:
          // 1. Server has full dataset (> 500 records) while local has fewer/dummy records
          // 2. Local has no data or no user edits
          // 3. Server timestamp is newer
          const serverWins =
            !localHpbs?.data ||
            !Array.isArray(localHpbs.data.records) ||
            normalized.records.length > localCount ||
            !localHpbs.hasUserEdits ||
            serverHpbsTime > localHpbsTime;

          if (serverWins) {
            setHpbsDataset(normalized);
            persistHpbsDatasetLocally(normalized, false, serverHpbsTime || Date.now());
          } else {
            const locNorm = normalizeHpbsDataset(localHpbs.data);
            setHpbsDataset(locNorm);
            if (locNorm.records.length >= normalized.records.length) {
              savePublishedHpbsDataset(locNorm);
            }
          }
        } else if (localHpbs?.data && Array.isArray(localHpbs.data.records) && localHpbs.data.records.length > 500) {
          const locNorm = normalizeHpbsDataset(localHpbs.data);
          setHpbsDataset(locNorm);
          savePublishedHpbsDataset(locNorm);
        }
      } catch (err) {
        console.warn('[App] Smart persistence sync error:', err);
      }
    }

    initAndSyncData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateHpbsDataset = (newDataset: HpbsDataset) => {
    setHpbsDataset(newDataset);
    persistHpbsDatasetLocally(newDataset, true);
    savePublishedHpbsDataset(newDataset).then((ok) => {
      if (ok) {
        showPublishToast('✓ Data Relatif Harga (V-HPBS) berhasil disimpan permanen!');
      }
    });
  };

  const handleResetHpbsDataset = () => {
    const initial = generateInitialHpbsDataset();
    setHpbsDataset(initial);
    persistHpbsDatasetLocally(initial, false);
    resetServerHpbsDataset().then(() => {
      showPublishToast('✓ Data V-HPBS telah direset ke data awal resmi.', 'info');
    });
  };

  const handleSaveIhkDataset = (newDataset: IhkCompleteDataset) => {
    setIhkDataset(newDataset);
    savePersistentItem(STORAGE_KEYS.IHK, newDataset, true);
    // Automatically publish to server so published link & other users immediately see updated data
    savePublishedIhkDataset(newDataset).then((ok) => {
      if (ok) {
        showPublishToast('✓ File IHK berhasil diunggah & disimpan permanen!');
      }
    });
  };

  const handleResetIhkDataset = () => {
    const initial = generateInitialIhkDataset();
    setIhkDataset(initial);
    savePersistentItem(STORAGE_KEYS.IHK, initial, false);
    resetServerIhkDataset().then(() => {
      showPublishToast('✓ Data IHK telah direset ke data awal resmi.', 'info');
    });
  };

  const handleOpenIhkFileManager = (tab: 'import' | 'template' | 'export' | 'manage' = 'import') => {
    setIhkModalState({ isOpen: true, tab });
  };

  // Active dataset object (defaults to selected month or latest available month)
  const activeDataset =
    datasets.find((d) => d.id === selectedMonthId) ||
    (datasets.length > 0 ? datasets[datasets.length - 1] : null);

  // Handlers with automatic persistent storage & server publishing
  const handleUpdateDataset = (updated: MonthlyHarmonizationDataset) => {
    const next = datasets.map((d) => (d.id === updated.id ? updated : d));
    setDatasets(next);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, next, true);
    savePublishedDatasets(next).then((ok) => {
      if (ok) {
        showPublishToast('✓ Perubahan status komoditas berhasil disimpan & dipublikasikan ke semua device!');
      }
    });
  };

  const handleAddMonth = (newDataset: MonthlyHarmonizationDataset) => {
    const filtered = datasets.filter((d) => d.id !== newDataset.id);
    const combined = [...filtered, newDataset].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    setDatasets(combined);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, combined, true);
    setSelectedMonthId(newDataset.id);
    setActiveTab('grid');

    savePublishedDatasets(combined).then((ok) => {
      if (ok) {
        showPublishToast(`✓ Periode ${newDataset.monthLabel} berhasil ditambahkan & disimpan permanen!`);
      }
    });
  };

  const handleImportDatasets = (incoming: MonthlyHarmonizationDataset | MonthlyHarmonizationDataset[], replaceAll: boolean = false) => {
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
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, combined, true);

    // Select the first imported dataset or newly added month
    setSelectedMonthId(list[0].id);
    setActiveTab('grid');

    // Automatically publish to server so everyone viewing the published app gets the updated data
    savePublishedDatasets(combined).then((ok) => {
      if (ok) {
        showPublishToast(
          `✓ Data ${list.length} periode berhasil diunggah & disimpan secara permanen!`
        );
      }
    });
  };

  const handleDeleteMonth = (monthId: string) => {
    const remaining = datasets.filter((d) => d.id !== monthId);
    if (selectedMonthId === monthId) {
      setSelectedMonthId(remaining[0]?.id || '');
    }
    setDatasets(remaining);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, remaining, true);
    savePublishedDatasets(remaining).then(() => {
      showPublishToast('✓ Perubahan penghapusan data telah diperbarui.');
    });
  };

  const handleDeleteMonths = (monthIds: string[]) => {
    const idSet = new Set(monthIds);
    const remaining = datasets.filter((d) => !idSet.has(d.id));
    if (idSet.has(selectedMonthId)) {
      setSelectedMonthId(remaining[0]?.id || '');
    }
    setDatasets(remaining);
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, remaining, true);
    savePublishedDatasets(remaining).then(() => {
      showPublishToast('✓ Perubahan penghapusan data telah diperbarui.');
    });
  };

  const handleClearAllDatasets = () => {
    setDatasets([]);
    setSelectedMonthId('');
    savePersistentItem(STORAGE_KEYS.HARMONIZATION, [], true);
    savePublishedDatasets([]);
  };

  const handleResetData = () => {
    if (window.confirm('Reset semua data kembali ke rekap standar awal? Perubahan manual akan dikembalikan.')) {
      const initial = generateInitialDatasets();
      setDatasets(initial);
      setSelectedMonthId(initial[0].id);
      savePersistentItem(STORAGE_KEYS.HARMONIZATION, initial, false);
      resetServerDatasets().then(() => {
        showPublishToast('✓ Data harmonisasi telah direset ke rekap awal resmi.', 'info');
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
      localStorage.removeItem(PORTAL_AUTH_KEY);
      sessionStorage.removeItem(PORTAL_AUTH_KEY);
      localStorage.removeItem(OWNER_STORAGE_KEY);
    } catch {}
    showPublishToast('Sesi telah diakhiri. Silakan masuk kembali melalui Portal Instansi.', 'info');
  };

  // Render Portal Login Landing Page if user has not authenticated
  if (!authUser) {
    return <PortalLoginPage onLogin={handlePortalLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Fixed Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasets={datasets}
        isOwner={isOwner}
        ownerEmail={OWNER_EMAIL}
        authUser={authUser}
        onLogout={handlePortalLogout}
        onOpenOwnerAuth={(actionName) => requireOwner(actionName || 'Akses Owner', () => {})}
        onLogoutOwner={handleLogoutOwner}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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

      {/* Main Content Area Column (Permanently Fixed Wide Sidebar on desktop) */}
      <div
        className="transition-all duration-300 ease-in-out lg:pl-72 flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen"
      >
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          datasets={datasets}
          isOwner={isOwner}
          ownerEmail={OWNER_EMAIL}
          authUser={authUser}
          onLogout={handlePortalLogout}
          onOpenOwnerAuth={(actionName) => requireOwner(actionName || 'Akses Owner', () => {})}
          onLogoutOwner={handleLogoutOwner}
          onToggleSidebarMobile={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
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
            showPublishToast(
              `✓ Berhasil mengganti seluruh dataset! Data default bawaan telah dihapus dan digantikan dengan ${newRecords.length} data pedagang dari file Anda.`
            );
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
            showPublishToast(
              `✓ Berhasil menambahkan ${newRecords.length} data pedagang ke periode ${targetLabel}!`
            );
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

      {/* Floating Server Publication Notification Toast */}
      {publishToast && (
        <div
          className="fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-start gap-3 animate-in slide-in-from-bottom-3 duration-200"
          role="status"
        >
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white mb-0.5 flex items-center gap-1.5">
              <span>Status Publikasi Data</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
          setIsSidebarMobileOpen(false);
        }}
        onOpenSidebar={() => setIsSidebarMobileOpen(true)}
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
