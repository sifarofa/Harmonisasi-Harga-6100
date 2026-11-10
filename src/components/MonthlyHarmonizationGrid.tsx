import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Edit2,
  Factory,
  Filter,
  Home,
  Layers,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  Sprout,
  Store,
  Truck,
} from 'lucide-react';
import { CommodityRecord, MonthlyHarmonizationDataset, PriceLevel, PriceStatus, RegionInfo } from '../types';
import { computeOverallStatus, getStatusBadgeStyle } from '../utils/analysis';
import { DataPaginationBar } from './DataPaginationBar';

// Helper to detect whether price levels are unaligned for a given set of 4 levels
export const detectUnalignedLevels = (statuses: {
  pDesa: PriceStatus;
  kDesa: PriceStatus;
  pb: PriceStatus;
  k: PriceStatus;
}): {
  isUnaligned: boolean;
  unalignedLevels: Set<'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'>;
  activeCount: number;
  reason: string;
} => {
  const norm = (s: PriceStatus): 'NAIK' | 'TURUN' | 'STABIL' | null => {
    if (s === 'NAIK' || s === 'TURUN' || s === 'STABIL') return s;
    return null;
  };

  const active: { level: 'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'; status: 'NAIK' | 'TURUN' | 'STABIL' }[] = [];
  const sPDesa = norm(statuses.pDesa);
  const sKDesa = norm(statuses.kDesa);
  const sPb = norm(statuses.pb);
  const sK = norm(statuses.k);

  if (sPDesa) active.push({ level: 'produsen_desa', status: sPDesa });
  if (sKDesa) active.push({ level: 'konsumen_desa', status: sKDesa });
  if (sPb) active.push({ level: 'perdagangan_besar', status: sPb });
  if (sK) active.push({ level: 'konsumen', status: sK });

  if (active.length < 2) {
    return { isUnaligned: false, unalignedLevels: new Set(), activeCount: active.length, reason: '' };
  }

  const distinctStatuses = Array.from(new Set(active.map((a) => a.status)));
  if (distinctStatuses.length <= 1) {
    return { isUnaligned: false, unalignedLevels: new Set(), activeCount: active.length, reason: '' };
  }

  const counts: Record<string, number> = { NAIK: 0, TURUN: 0, STABIL: 0 };
  active.forEach((a) => counts[a.status]++);

  let maxCount = 0;
  let dominantStatus = '';
  Object.entries(counts).forEach(([st, cnt]) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantStatus = st;
    }
  });

  const isTied = Object.values(counts).filter((c) => c === maxCount).length > 1;
  const unalignedLevels = new Set<'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'>();

  active.forEach((a) => {
    if (isTied || a.status !== dominantStatus) {
      unalignedLevels.add(a.level);
    }
  });

  const levelLabels: Record<string, string> = {
    produsen_desa: 'Produsen (HD)',
    konsumen_desa: 'Kons. Desa (HKD)',
    perdagangan_besar: 'Dagang Besar (HPB)',
    konsumen: 'Konsumen (HK)',
  };

  const reason = `Level tidak selaras: ${active.map((a) => `${levelLabels[a.level]}: ${a.status}`).join(' vs ')}`;

  return {
    isUnaligned: true,
    unalignedLevels,
    activeCount: active.length,
    reason,
  };
};

// Helper to extract 4-tier statuses for Kalbar (Provinsi)
export const getKalbarStatuses = (comm: CommodityRecord): {
  pDesa: PriceStatus;
  kDesa: PriceStatus;
  pb: PriceStatus;
  k: PriceStatus;
} => {
  const pDesa: PriceStatus =
    comm.overallProdusenDesaStatus ||
    comm.overallProdusenStatus ||
    comm.overallStatus ||
    computeOverallStatus(comm.regions, 'produsen_desa');

  const kDesa: PriceStatus =
    comm.overallKonsumenDesaStatus ||
    comm.overallStatus ||
    computeOverallStatus(comm.regions, 'konsumen_desa');

  const pb: PriceStatus =
    comm.overallPerdaganganBesarStatus ||
    comm.overallGrosirStatus ||
    comm.overallStatus ||
    computeOverallStatus(comm.regions, 'perdagangan_besar');

  const k: PriceStatus =
    comm.overallKonsumenStatus ||
    comm.overallStatus ||
    computeOverallStatus(comm.regions, 'konsumen');

  return { pDesa, kDesa, pb, k };
};

// Helper to extract 4-tier statuses for a specific region (strictly preserves KOSONG/NIHIL)
export const getRegionStatuses = (regData: any): {
  pDesa: PriceStatus;
  kDesa: PriceStatus;
  pb: PriceStatus;
  k: PriceStatus;
} => {
  if (!regData || regData.hasCommodity === false) {
    return { pDesa: 'KOSONG', kDesa: 'KOSONG', pb: 'KOSONG', k: 'KOSONG' };
  }

  const cleanStatus = (st: any): PriceStatus => {
    if (!st || st === 'KOSONG' || st === '-' || st === '--' || st === '0' || st === 'NIHIL') return 'KOSONG';
    if (st === 'STABIL') return 'STABIL';
    if (st === 'NAIK') return 'NAIK';
    if (st === 'TURUN') return 'TURUN';
    return st;
  };

  const pDesa: PriceStatus = cleanStatus(regData.produsenDesaStatus ?? regData.produsenStatus ?? (regData.status === 'KOSONG' ? 'KOSONG' : undefined));
  const kDesa: PriceStatus = cleanStatus(regData.konsumenDesaStatus ?? (regData.status === 'KOSONG' ? 'KOSONG' : undefined));
  const pb: PriceStatus = cleanStatus(regData.perdaganganBesarStatus ?? regData.grosirStatus ?? (regData.status === 'KOSONG' ? 'KOSONG' : undefined));
  const k: PriceStatus = cleanStatus(regData.konsumenStatus ?? regData.status);

  return { pDesa, kDesa, pb, k };
};

// Reusable 4-tier micro-badge cell component for comfortable, readable view across Kalbar and Kab/Kota
const FourLevelStatusCell: React.FC<{
  pDesaStatus: PriceStatus;
  kDesaStatus: PriceStatus;
  pbStatus: PriceStatus;
  kStatus: PriceStatus;
  onToggle?: (level: 'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen') => void;
  isKalbar?: boolean;
  regionName?: string;
  unalignedLevels?: Set<'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'>;
  isUnaligned?: boolean;
  unalignedReason?: string;
}> = ({
  pDesaStatus,
  kDesaStatus,
  pbStatus,
  kStatus,
  onToggle,
  isKalbar = false,
  regionName,
  unalignedLevels,
  isUnaligned = false,
  unalignedReason,
}) => {
  const levels = [
    {
      id: 'produsen_desa' as const,
      num: '1',
      code: 'HD',
      name: 'Produsen Desa',
      status: pDesaStatus,
      tagClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      tooltip: '1. Produsen Perdesaan (Petani / HD / HPG)',
    },
    {
      id: 'konsumen_desa' as const,
      num: '2',
      code: 'HKD',
      name: 'Konsumen Desa',
      status: kDesaStatus,
      tagClass: 'bg-amber-100 text-amber-800 border-amber-300',
      tooltip: '2. Konsumen Perdesaan (Warung / Pasar Desa / HKD)',
    },
    {
      id: 'perdagangan_besar' as const,
      num: '3',
      code: 'HPB',
      name: 'Dagang Besar',
      status: pbStatus,
      tagClass: 'bg-blue-100 text-blue-800 border-blue-300',
      tooltip: '3. Perdagangan Besar (Grosir / Distributor / HPB)',
    },
    {
      id: 'konsumen' as const,
      num: '4',
      code: 'HK',
      name: 'Konsumen',
      status: kStatus,
      tagClass: 'bg-rose-100 text-rose-800 border-rose-300',
      tooltip: '4. Konsumen Eceran (Pasar Kota / HK)',
    },
  ];

  return (
    <div
      className={`flex flex-col gap-1 p-1 min-w-[114px] rounded-lg transition-colors ${
        isUnaligned
          ? 'bg-amber-50/40 border border-amber-200/80 shadow-2xs'
          : isKalbar
          ? 'bg-emerald-50/50'
          : ''
      }`}
      title={isUnaligned ? unalignedReason : undefined}
    >
      {levels.map((lvl) => {
        const badge = getStatusBadgeStyle(lvl.status);
        const isNaik = lvl.status === 'NAIK';
        const isTurun = lvl.status === 'TURUN';
        const isStabil = lvl.status === 'STABIL';
        const isLevelUnaligned = unalignedLevels?.has(lvl.id);

        return (
          <button
            key={lvl.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(lvl.id);
            }}
            className={`group flex items-center justify-between px-1.5 py-1 rounded border text-[10px] transition-all cursor-pointer select-none active:scale-95 ${badge.bg} ${badge.border} hover:shadow-2xs ${
              isLevelUnaligned
                ? 'ring-1.5 ring-amber-400/90 border-amber-300/90 bg-amber-50/80 font-bold shadow-2xs'
                : ''
            }`}
            title={`${regionName ? regionName + ' - ' : ''}${lvl.tooltip}: ${badge.label}.${
              isLevelUnaligned ? ' [Arah pergerakan harga tidak selaras]' : ''
            } Klik untuk rotasi status.`}
          >
            {/* Level Tag Pill */}
            <span className={`px-1 py-0.2 rounded font-mono font-bold text-[9px] border shrink-0 ${lvl.tagClass}`}>
              {lvl.code}
            </span>

            {/* Status indicator with icon */}
            <span className="font-extrabold tracking-tight shrink-0 flex items-center gap-1 text-[10px]">
              {isNaik && <span className="text-rose-600 font-black text-[9px]">▲</span>}
              {isTurun && <span className="text-blue-600 font-black text-[9px]">▼</span>}
              {isStabil && <span className="text-emerald-600 text-[8px]">●</span>}
              <span>{badge.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

interface MonthlyHarmonizationGridProps {
  dataset: MonthlyHarmonizationDataset;
  regions: RegionInfo[];
  selectedRegionId?: string;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
  onUpdateDataset: (updatedDataset: MonthlyHarmonizationDataset) => void;
  onSelectCommodity: (commodityId: string) => void;
}

export const MonthlyHarmonizationGrid: React.FC<MonthlyHarmonizationGridProps> = ({
  dataset,
  regions,
  selectedRegionId = 'all',
  selectedPriceLevel = 'all',
  setSelectedPriceLevel,
  onUpdateDataset,
  onSelectCommodity,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelViewMode, setLevelViewMode] = useState<
    'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen' | 'all_levels'
  >(selectedPriceLevel === 'all' ? 'konsumen' : selectedPriceLevel);

  // Dynamic drafts for commodity notes to allow instant typing, filter-switching, and explicit Save
  const [commodityNoteDrafts, setCommodityNoteDrafts] = useState<Record<string, string>>({});
  const [savedNoteCommodityId, setSavedNoteCommodityId] = useState<string | null>(null);

  // Sync drafts whenever active dataset or selectedRegionId filter changes
  React.useEffect(() => {
    const drafts: Record<string, string> = {};
    dataset.commodities.forEach((c) => {
      if (selectedRegionId && selectedRegionId !== 'all') {
        drafts[c.id] = c.regions?.[selectedRegionId]?.catatan ?? c.catatan ?? c.notes ?? '';
      } else {
        drafts[c.id] = c.catatan ?? c.notes ?? '';
      }
    });
    setCommodityNoteDrafts(drafts);
  }, [dataset.id, dataset.commodities, selectedRegionId]);

  // Synchronize when parent selectedPriceLevel prop changes
  React.useEffect(() => {
    if (selectedPriceLevel === 'all') {
      setLevelViewMode('all_levels');
    } else {
      setLevelViewMode(selectedPriceLevel);
    }
  }, [selectedPriceLevel]);

  const handleLevelChange = (newLevel: 'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen' | 'all_levels') => {
    setLevelViewMode(newLevel);
    setGridPage(1);
    if (setSelectedPriceLevel) {
      if (newLevel === 'all_levels') {
        setSelectedPriceLevel('all');
      } else {
        setSelectedPriceLevel(newLevel);
      }
    }
  };

  // Sorting state for table columns
  const [gridSortCol, setGridSortCol] = useState<string>('no');
  const [gridSortDir, setGridSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination state for harmonization table
  const [gridPage, setGridPage] = useState<number>(1);
  const [gridPageSize, setGridPageSize] = useState<number | 'all'>(50);

  const handleGridSort = (col: string) => {
    if (gridSortCol === col) {
      setGridSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setGridSortCol(col);
      setGridSortDir('asc');
    }
  };

  // Filtered and sorted commodities for active dataset
  const filteredCommodities = useMemo(() => {
    const list = dataset.commodities.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || String(c.no).includes(search);
      const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
      let matchStatus = true;
      if (statusFilter !== 'all') {
        if (levelViewMode === 'all_levels') {
          const { pDesa, kDesa, pb, k } = getKalbarStatuses(c);
          matchStatus =
            pDesa === statusFilter ||
            kDesa === statusFilter ||
            pb === statusFilter ||
            k === statusFilter ||
            c.overallStatus === statusFilter;
        } else {
          const { pDesa, kDesa, pb, k } = getKalbarStatuses(c);
          let checkStatus: PriceStatus = 'STABIL';
          if (levelViewMode === 'produsen_desa') {
            checkStatus = pDesa;
          } else if (levelViewMode === 'konsumen_desa') {
            checkStatus = kDesa;
          } else if (levelViewMode === 'perdagangan_besar') {
            checkStatus = pb;
          } else {
            checkStatus = k;
          }
          matchStatus = checkStatus === statusFilter;
        }
      }
      return matchSearch && matchCat && matchStatus;
    });

    return list.sort((a, b) => {
      const mult = gridSortDir === 'asc' ? 1 : -1;
      const statusWeight: Record<string, number> = {
        NAIK: 4,
        STABIL: 3,
        TURUN: 2,
        KOSONG: 1,
        '-': 1,
      };

      if (gridSortCol === 'no') {
        return (a.no - b.no) * mult;
      }
      if (gridSortCol === 'name') {
        return a.name.localeCompare(b.name) * mult;
      }
      if (gridSortCol === 'catatan') {
        const noteA = commodityNoteDrafts[a.id] ?? a.catatan ?? a.notes ?? '';
        const noteB = commodityNoteDrafts[b.id] ?? b.catatan ?? b.notes ?? '';
        return noteA.localeCompare(noteB) * mult;
      }
      if (gridSortCol === 'kalbar') {
        const kalA = getKalbarStatuses(a);
        const kalB = getKalbarStatuses(b);
        let sA: PriceStatus = kalA.k;
        let sB: PriceStatus = kalB.k;
        if (levelViewMode === 'produsen_desa') {
          sA = kalA.pDesa;
          sB = kalB.pDesa;
        } else if (levelViewMode === 'konsumen_desa') {
          sA = kalA.kDesa;
          sB = kalB.kDesa;
        } else if (levelViewMode === 'perdagangan_besar') {
          sA = kalA.pb;
          sB = kalB.pb;
        } else if (levelViewMode === 'all_levels') {
          const uA = detectUnalignedLevels(kalA).isUnaligned ? 10 : 0;
          const uB = detectUnalignedLevels(kalB).isUnaligned ? 10 : 0;
          if (uA !== uB) return (uA - uB) * mult;
        }
        const diff = (statusWeight[sA] || 0) - (statusWeight[sB] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }

      // Specific region column sorting
      const regDataA = a.regions?.[gridSortCol];
      const regDataB = b.regions?.[gridSortCol];
      const stA = getRegionStatuses(regDataA);
      const stB = getRegionStatuses(regDataB);
      let sA: PriceStatus = stA.k;
      let sB: PriceStatus = stB.k;
      if (levelViewMode === 'produsen_desa') {
        sA = stA.pDesa;
        sB = stB.pDesa;
      } else if (levelViewMode === 'konsumen_desa') {
        sA = stA.kDesa;
        sB = stB.kDesa;
      } else if (levelViewMode === 'perdagangan_besar') {
        sA = stA.pb;
        sB = stB.pb;
      } else if (levelViewMode === 'all_levels') {
        const uA = detectUnalignedLevels(stA).isUnaligned ? 10 : 0;
        const uB = detectUnalignedLevels(stB).isUnaligned ? 10 : 0;
        if (uA !== uB) return (uA - uB) * mult;
      }
      const diff = (statusWeight[sA] || 0) - (statusWeight[sB] || 0);
      return (diff !== 0 ? diff : a.no - b.no) * mult;
    });
  }, [dataset.commodities, search, selectedCategory, statusFilter, levelViewMode, gridSortCol, gridSortDir, commodityNoteDrafts]);

  // Paginated commodities for active view
  const paginatedCommodities = useMemo(() => {
    if (gridPageSize === 'all') return filteredCommodities;
    const size = Number(gridPageSize);
    const start = (gridPage - 1) * size;
    return filteredCommodities.slice(start, start + size);
  }, [filteredCommodities, gridPage, gridPageSize]);

  // Categories list
  const categories = useMemo(() => {
    const s = new Set<string>();
    dataset.commodities.forEach((c) => s.add(c.category));
    return Array.from(s);
  }, [dataset]);

  // Quick stats for this month (reflecting Kalbar aggregate at active view mode)
  const monthStats = useMemo(() => {
    let naik = 0;
    let turun = 0;
    let stabil = 0;
    let kosong = 0;

    dataset.commodities.forEach((c) => {
      const { pDesa, kDesa, pb, k } = getKalbarStatuses(c);
      let st: PriceStatus = 'STABIL';
      if (levelViewMode === 'produsen_desa') {
        st = pDesa;
      } else if (levelViewMode === 'konsumen_desa') {
        st = kDesa;
      } else if (levelViewMode === 'perdagangan_besar') {
        st = pb;
      } else {
        st = k;
      }

      if (st === 'NAIK') naik++;
      else if (st === 'TURUN') turun++;
      else if (st === 'STABIL') stabil++;
      else if (st === 'KOSONG' || st === '-' || st === '0') kosong++;
    });

    return {
      total: dataset.commodities.length,
      naik,
      turun,
      stabil,
      kosong,
    };
  }, [dataset, levelViewMode]);

  // Handle cell status toggle (STABIL -> NAIK -> TURUN -> KOSONG (-) -> STABIL)
  const handleToggleStatus = (
    commodityId: string,
    regionId: string,
    specificLevel?: 'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'
  ) => {
    const targetLevel = specificLevel || (levelViewMode === 'all_levels' ? 'konsumen' : levelViewMode);

    const updatedCommodities = dataset.commodities.map((comm) => {
      if (comm.id !== commodityId) return comm;

      const regData = comm.regions?.[regionId] || {};
      let current: PriceStatus = 'STABIL';

      if (targetLevel === 'produsen_desa') {
        current = regData.produsenDesaStatus || regData.produsenStatus || (regData.status === 'KOSONG' ? 'KOSONG' : regData.status || 'STABIL');
      } else if (targetLevel === 'konsumen_desa') {
        current = regData.konsumenDesaStatus || (regData.status === 'KOSONG' ? 'KOSONG' : regData.status || 'STABIL');
      } else if (targetLevel === 'perdagangan_besar') {
        current = regData.perdaganganBesarStatus || regData.grosirStatus || (regData.status === 'KOSONG' ? 'KOSONG' : regData.status || 'STABIL');
      } else {
        current = regData.konsumenStatus || regData.status || 'STABIL';
      }

      let nextStatus: PriceStatus = 'STABIL';
      if (current === 'STABIL') nextStatus = 'NAIK';
      else if (current === 'NAIK') nextStatus = 'TURUN';
      else if (current === 'TURUN') nextStatus = 'KOSONG';
      else nextStatus = 'STABIL';

      const updatedRegData = { ...regData };

      if (targetLevel === 'produsen_desa') {
        updatedRegData.produsenDesaStatus = nextStatus;
        updatedRegData.produsenStatus = nextStatus;
      } else if (targetLevel === 'konsumen_desa') {
        updatedRegData.konsumenDesaStatus = nextStatus;
      } else if (targetLevel === 'perdagangan_besar') {
        updatedRegData.perdaganganBesarStatus = nextStatus;
        updatedRegData.grosirStatus = nextStatus;
      } else {
        updatedRegData.status = nextStatus;
        updatedRegData.konsumenStatus = nextStatus;
      }

      // Sync master status and hasCommodity flag
      if (nextStatus === 'KOSONG') {
        if (targetLevel === 'konsumen') {
          updatedRegData.status = 'KOSONG';
        }
      } else {
        updatedRegData.hasCommodity = true;
      }

      const updatedRegions = {
        ...comm.regions,
        [regionId]: updatedRegData,
      };

      const newOverall = computeOverallStatus(updatedRegions);

      return {
        ...comm,
        regions: updatedRegions,
        overallStatus: newOverall,
        overallProdusenDesaStatus: computeOverallStatus(updatedRegions, 'produsen_desa'),
        overallKonsumenDesaStatus: computeOverallStatus(updatedRegions, 'konsumen_desa'),
        overallPerdaganganBesarStatus: computeOverallStatus(updatedRegions, 'perdagangan_besar'),
        overallKonsumenStatus: computeOverallStatus(updatedRegions, 'konsumen'),
      };
    });

    onUpdateDataset({
      ...dataset,
      updatedAt: new Date().toISOString(),
      commodities: updatedCommodities,
    });
  };

  // Direct toggle for Kalbar (Provinsi) aggregate status
  const handleToggleKalbarStatus = (
    commodityId: string,
    specificLevel?: 'produsen_desa' | 'konsumen_desa' | 'perdagangan_besar' | 'konsumen'
  ) => {
    const targetLevel = specificLevel || (levelViewMode === 'all_levels' ? 'konsumen' : levelViewMode);

    const updatedCommodities = dataset.commodities.map((comm) => {
      if (comm.id !== commodityId) return comm;

      const { pDesa, kDesa, pb, k } = getKalbarStatuses(comm);
      let current: PriceStatus = 'STABIL';
      if (targetLevel === 'produsen_desa') current = pDesa;
      else if (targetLevel === 'konsumen_desa') current = kDesa;
      else if (targetLevel === 'perdagangan_besar') current = pb;
      else current = k;

      let nextStatus: PriceStatus = 'STABIL';
      if (current === 'STABIL') nextStatus = 'NAIK';
      else if (current === 'NAIK') nextStatus = 'TURUN';
      else if (current === 'TURUN') nextStatus = 'KOSONG';
      else nextStatus = 'STABIL';

      const updated = { ...comm };
      if (targetLevel === 'produsen_desa') {
        updated.overallProdusenDesaStatus = nextStatus;
        updated.overallProdusenStatus = nextStatus;
      } else if (targetLevel === 'konsumen_desa') {
        updated.overallKonsumenDesaStatus = nextStatus;
      } else if (targetLevel === 'perdagangan_besar') {
        updated.overallPerdaganganBesarStatus = nextStatus;
        updated.overallGrosirStatus = nextStatus;
      } else {
        updated.overallKonsumenStatus = nextStatus;
        updated.overallStatus = nextStatus;
      }

      return updated;
    });

    onUpdateDataset({
      ...dataset,
      updatedAt: new Date().toISOString(),
      commodities: updatedCommodities,
    });
  };

  // Save direct notes/catatan for a commodity with region/filter dynamic awareness
  const handleSaveCommodityNote = (commodityId: string) => {
    const noteToSave = (commodityNoteDrafts[commodityId] ?? '').trim();

    const updatedCommodities = dataset.commodities.map((comm) => {
      if (comm.id !== commodityId) return comm;

      if (selectedRegionId && selectedRegionId !== 'all') {
        const existingReg = comm.regions?.[selectedRegionId] || { status: 'STABIL' };
        return {
          ...comm,
          regions: {
            ...comm.regions,
            [selectedRegionId]: {
              ...existingReg,
              catatan: noteToSave,
            },
          },
        };
      } else {
        return {
          ...comm,
          catatan: noteToSave,
          notes: noteToSave,
        };
      }
    });

    onUpdateDataset({
      ...dataset,
      updatedAt: new Date().toISOString(),
      commodities: updatedCommodities,
    });

    setSavedNoteCommodityId(commodityId);
    setTimeout(() => {
      setSavedNoteCommodityId(null);
    }, 2000);
  };

  // Direct draft updater
  const handleDraftNoteChange = (commodityId: string, value: string) => {
    setCommodityNoteDrafts((prev) => ({
      ...prev,
      [commodityId]: value,
    }));
  };

  // Quick bulk set status for all regions of a commodity
  const handleSetAllRegions = (commodityId: string, status: PriceStatus) => {
    const updatedCommodities = dataset.commodities.map((comm) => {
      if (comm.id !== commodityId) return comm;

      const updatedRegions: Record<string, any> = {};
      regions.forEach((r) => {
        const existing = comm.regions?.[r.id] || {};
        updatedRegions[r.id] = {
          ...existing,
          status,
          produsenDesaStatus: status,
          konsumenDesaStatus: status,
          perdaganganBesarStatus: status,
          konsumenStatus: status,
          produsenStatus: status,
          grosirStatus: status,
          hasCommodity: status !== 'KOSONG' && status !== '-',
        };
      });

      return {
        ...comm,
        regions: updatedRegions,
        overallStatus: status,
        overallProdusenDesaStatus: status,
        overallKonsumenDesaStatus: status,
        overallPerdaganganBesarStatus: status,
        overallKonsumenStatus: status,
        overallProdusenStatus: status,
        overallGrosirStatus: status,
      };
    });

    onUpdateDataset({
      ...dataset,
      updatedAt: new Date().toISOString(),
      commodities: updatedCommodities,
    });
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Month Header Banner with summary chips */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Tabel Harmonisasi: {dataset.monthLabel}
              </h2>
              <span className="text-xs px-2 py-0.5 bg-slate-100 font-medium text-slate-600 rounded">
                {dataset.commodities.length} Komoditas Terdata
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih level harga di bawah. Klik sel wilayah untuk rotasi status (STABIL &rarr; NAIK &rarr; TURUN &rarr; <span className="font-mono font-semibold text-slate-700">-</span> Nihil).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>{monthStats.naik} NAIK</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{monthStats.turun} TURUN</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{monthStats.stabil} STABIL</span>
            </div>
            {monthStats.kosong > 0 && (
              <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg">
                <span className="font-mono font-bold">-</span>
                <span>{monthStats.kosong} Nihil</span>
              </div>
            )}
          </div>
        </div>

        {/* Level View Mode Selector & Filter bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* 4 Level Tabs */}
            <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              <button
                id="tab-level-produsen-desa"
                onClick={() => handleLevelChange('produsen_desa')}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  levelViewMode === 'produsen_desa'
                    ? 'bg-white text-emerald-950 shadow-2xs font-bold border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="1. Harga Produsen Perdesaan (Petani/Peternak - HD)"
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Produsen (HD)</span>
              </button>

              <button
                id="tab-level-konsumen-desa"
                onClick={() => handleLevelChange('konsumen_desa')}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  levelViewMode === 'konsumen_desa'
                    ? 'bg-white text-amber-950 shadow-2xs font-bold border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="2. Harga Konsumen Perdesaan (Warung/Pasar Desa - HKD)"
              >
                <Home className="w-3.5 h-3.5 text-amber-600" />
                <span>2. Kons. Desa (HKD)</span>
              </button>

              <button
                id="tab-level-perdagangan-besar"
                onClick={() => handleLevelChange('perdagangan_besar')}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  levelViewMode === 'perdagangan_besar'
                    ? 'bg-white text-blue-950 shadow-2xs font-bold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="3. Harga Perdagangan Besar (Grosir/Distributor - HPB)"
              >
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>3. Dagang Besar (HPB)</span>
              </button>

              <button
                id="tab-level-konsumen"
                onClick={() => handleLevelChange('konsumen')}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  levelViewMode === 'konsumen'
                    ? 'bg-white text-rose-950 shadow-2xs font-bold border border-rose-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="4. Harga Konsumen Eceran Kota (HK)"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-rose-600" />
                <span>4. Konsumen (HK)</span>
              </button>

              <button
                id="tab-level-all"
                onClick={() => handleLevelChange('all_levels')}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  levelViewMode === 'all_levels'
                    ? 'bg-white text-purple-950 shadow-2xs font-bold border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan 4 Level Sekaligus di Setiap Sel Kalbar & Kab/Kota"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>4 Level Bersama</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-search-grid"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setGridPage(1);
                }}
                placeholder="Cari komoditas..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36 sm:w-44"
              />
            </div>

            {/* Category */}
            <select
              id="select-category-grid"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setGridPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              id="select-status-grid"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setGridPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="NAIK">Hanya NAIK</option>
              <option value="TURUN">Hanya TURUN</option>
              <option value="STABIL">Hanya STABIL</option>
              <option value="KOSONG">Hanya Nihil (-)</option>
            </select>
          </div>

          <div className="text-xs text-slate-500">
            Menampilkan <strong>{filteredCommodities.length}</strong> dari {dataset.commodities.length} komoditas
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[680px]">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-800 text-white uppercase text-[11px] tracking-wider sticky top-0 z-20 select-none">
              <tr>
                <th
                  onClick={() => handleGridSort('no')}
                  className="py-2.5 px-3 text-center border-r border-slate-700 sticky left-0 bg-slate-800 z-30 w-12 cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan nomor urut"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No.</span>
                    <ArrowUpDown className={`w-3 h-3 ${gridSortCol === 'no' ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} />
                  </div>
                </th>
                <th
                  onClick={() => handleGridSort('name')}
                  className="py-2.5 px-4 border-r border-slate-700 sticky left-12 bg-slate-800 z-30 min-w-[200px] cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan nama komoditas"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Komoditas</span>
                    <ArrowUpDown className={`w-3 h-3 ${gridSortCol === 'name' ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} />
                  </div>
                </th>
                {/* Kalbar Provincial Column Header */}
                <th
                  onClick={() => handleGridSort('kalbar')}
                  className="py-2.5 px-3 text-center border-r-2 border-emerald-500/50 bg-slate-800 z-20 min-w-[125px] text-white cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan status harga Kalbar"
                >
                  <div className="flex items-center justify-center gap-1.5 font-bold tracking-wide text-emerald-400">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Kalbar</span>
                    <ArrowUpDown className={`w-3 h-3 ${gridSortCol === 'kalbar' ? 'text-emerald-300 font-bold' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-[9.5px] font-medium normal-case text-emerald-200">
                    {levelViewMode === 'all_levels' ? '(Semua 4 Level)' : '(Status Agregat)'}
                  </div>
                </th>
                {regions.map((reg) => (
                  <th
                    key={reg.id}
                    onClick={() => handleGridSort(reg.id)}
                    className="py-2.5 px-2.5 text-center border-r border-slate-700 bg-slate-800 whitespace-nowrap min-w-[105px] cursor-pointer hover:bg-slate-700 transition-colors"
                    title={`Klik untuk mengurutkan berdasarkan status ${reg.name}`}
                  >
                    <div className="flex items-center justify-center gap-1 font-semibold text-slate-100">
                      <span>{reg.name}</span>
                      <ArrowUpDown className={`w-3 h-3 ${gridSortCol === reg.id ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-[9.5px] font-normal normal-case text-slate-400">
                      {reg.type === 'Kota' ? 'Kota' : 'Kabupaten'}
                    </div>
                  </th>
                ))}
                <th
                  onClick={() => handleGridSort('catatan')}
                  className="py-2.5 px-3 text-left border-r border-slate-700 min-w-[240px] cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan catatan"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <span>
                        Catatan {selectedRegionId && selectedRegionId !== 'all' ? `(${regions.find((r) => r.id === selectedRegionId)?.name || selectedRegionId})` : '(Kalbar)'}
                      </span>
                      <ArrowUpDown className={`w-3 h-3 ${gridSortCol === 'catatan' ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-normal lowercase tracking-normal">
                      dinamis + simpan
                    </span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center min-w-[120px]">
                  Aksi Cepat
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {paginatedCommodities.map((comm) => {
                const kalbarStatuses = getKalbarStatuses(comm);
                const kalbarUnaligned = detectUnalignedLevels(kalbarStatuses);

                return (
                  <tr key={comm.id} className="hover:bg-slate-50 transition-colors">
                    {/* No */}
                    <td className="py-2 px-3 text-center font-bold text-slate-400 border-r border-slate-200 sticky left-0 bg-white z-10">
                      {comm.no}
                    </td>

                    {/* Commodity Name */}
                    <td className="py-2 px-4 border-r border-slate-200 sticky left-12 bg-white z-10 shadow-2xs">
                      <div
                        onClick={() => onSelectCommodity(comm.id)}
                        className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer transition-colors"
                      >
                        {comm.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {comm.category} • {comm.unit || 'Satuan'}
                      </div>
                    </td>

                    {/* Kalbar (Status Umum / Agregat) - Symmetrical with regional columns */}
                    {levelViewMode === 'all_levels' ? (
                      <td className="py-1 px-1 text-center border-r-2 border-emerald-300/80 bg-emerald-50/25">
                        <FourLevelStatusCell
                          pDesaStatus={kalbarStatuses.pDesa}
                          kDesaStatus={kalbarStatuses.kDesa}
                          pbStatus={kalbarStatuses.pb}
                          kStatus={kalbarStatuses.k}
                          onToggle={(lvl) => handleToggleKalbarStatus(comm.id, lvl)}
                          isKalbar={true}
                          regionName="Prov. Kalbar"
                          isUnaligned={kalbarUnaligned.isUnaligned}
                          unalignedLevels={kalbarUnaligned.unalignedLevels}
                          unalignedReason={kalbarUnaligned.reason}
                        />
                      </td>
                    ) : (
                      (() => {
                        let kalbarSt: PriceStatus = 'STABIL';
                        let levelName = 'Konsumen (HK)';
                        if (levelViewMode === 'produsen_desa') {
                          kalbarSt = kalbarStatuses.pDesa;
                          levelName = 'Produsen Desa (HD)';
                        } else if (levelViewMode === 'konsumen_desa') {
                          kalbarSt = kalbarStatuses.kDesa;
                          levelName = 'Konsumen Desa (HKD)';
                        } else if (levelViewMode === 'perdagangan_besar') {
                          kalbarSt = kalbarStatuses.pb;
                          levelName = 'Dagang Besar (HPB)';
                        } else {
                          kalbarSt = kalbarStatuses.k;
                          levelName = 'Harga Konsumen (HK)';
                        }

                        const kalbarBadge = getStatusBadgeStyle(kalbarSt);
                        const isNaik = kalbarSt === 'NAIK';
                        const isTurun = kalbarSt === 'TURUN';
                        const isStabil = kalbarSt === 'STABIL';
                        const isLevelUnaligned = kalbarUnaligned.isUnaligned && kalbarUnaligned.unalignedLevels.has(levelViewMode);

                        return (
                          <td
                            onClick={() => handleToggleKalbarStatus(comm.id, levelViewMode)}
                            title={`Kalbar ${levelName}: ${kalbarBadge.label}.${
                              kalbarUnaligned.isUnaligned ? ` [Arah tidak selaras dengan level lainnya]` : ''
                            } Klik untuk rotasi status.`}
                            className={`py-1.5 px-2 text-center border-r-2 border-emerald-300/80 cursor-pointer select-none transition-colors ${
                              isLevelUnaligned
                                ? 'bg-amber-50/40 hover:bg-amber-100/50'
                                : 'bg-emerald-50/25 hover:bg-emerald-100/50'
                            }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center gap-1 w-full py-1 px-1.5 rounded-md text-[10px] font-extrabold border text-center transition-transform active:scale-95 shadow-2xs ${kalbarBadge.bg} ${kalbarBadge.border} ${
                                isLevelUnaligned ? 'ring-1.5 ring-amber-400/90 border-amber-300/90 bg-amber-50/80 font-bold shadow-2xs' : ''
                              }`}
                            >
                              {isNaik && <span className="text-rose-600 font-black text-[9px]">▲</span>}
                              {isTurun && <span className="text-blue-600 font-black text-[9px]">▼</span>}
                              {isStabil && <span className="text-emerald-600 text-[8px]">●</span>}
                              <span>{kalbarBadge.label}</span>
                            </span>
                          </td>
                        );
                      })()
                    )}

                    {/* Regional columns */}
                    {regions.map((reg) => {
                      const regData = comm.regions?.[reg.id];
                      const regStatuses = getRegionStatuses(regData);
                      const regUnaligned = detectUnalignedLevels(regStatuses);

                      if (levelViewMode === 'all_levels') {
                        return (
                          <td
                            key={`${comm.id}-${reg.id}`}
                            className="py-1 px-1 text-center border-r border-slate-200"
                          >
                            <FourLevelStatusCell
                              pDesaStatus={regStatuses.pDesa}
                              kDesaStatus={regStatuses.kDesa}
                              pbStatus={regStatuses.pb}
                              kStatus={regStatuses.k}
                              onToggle={(lvl) => handleToggleStatus(comm.id, reg.id, lvl)}
                              isKalbar={false}
                              regionName={reg.name}
                              isUnaligned={regUnaligned.isUnaligned}
                              unalignedLevels={regUnaligned.unalignedLevels}
                              unalignedReason={regUnaligned.reason}
                            />
                          </td>
                        );
                      }

                      // Single Level View
                      let st: PriceStatus = 'STABIL';
                      if (levelViewMode === 'produsen_desa') st = regStatuses.pDesa;
                      else if (levelViewMode === 'konsumen_desa') st = regStatuses.kDesa;
                      else if (levelViewMode === 'perdagangan_besar') st = regStatuses.pb;
                      else st = regStatuses.k;

                      const badge = getStatusBadgeStyle(st);
                      const isNaik = st === 'NAIK';
                      const isTurun = st === 'TURUN';
                      const isStabil = st === 'STABIL';
                      const isLevelUnaligned = regUnaligned.isUnaligned && regUnaligned.unalignedLevels.has(levelViewMode);

                      return (
                        <td
                          key={`${comm.id}-${reg.id}`}
                          onClick={() => handleToggleStatus(comm.id, reg.id, levelViewMode)}
                          title={`${reg.name}: ${badge.label}.${
                            regUnaligned.isUnaligned ? ` [Arah tidak selaras dengan level lainnya]` : ''
                          } Klik untuk rotasi status.`}
                          className={`py-1.5 px-2 text-center border-r border-slate-200 cursor-pointer select-none transition-colors ${
                            isLevelUnaligned
                              ? 'bg-amber-50/40 hover:bg-amber-100/50'
                              : 'hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center gap-1 w-full py-1 px-1.5 rounded-md text-[10px] font-bold border text-center transition-transform active:scale-95 ${badge.bg} ${badge.border} ${
                              isLevelUnaligned
                                ? 'ring-1.5 ring-amber-400/90 border-amber-300/90 bg-amber-50/80 font-bold shadow-2xs'
                                : ''
                            }`}
                          >
                            {isNaik && <span className="text-rose-600 font-black text-[9px]">▲</span>}
                            {isTurun && <span className="text-blue-600 font-black text-[9px]">▼</span>}
                            {isStabil && <span className="text-emerald-600 text-[8px]">●</span>}
                            <span>{badge.label}</span>
                          </span>
                        </td>
                      );
                    })}

                    {/* Catatan / Keterangan Input with explicit Save Button */}
                    <td className="py-1 px-2 border-r border-slate-200 min-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={commodityNoteDrafts[comm.id] ?? ''}
                          onChange={(e) => handleDraftNoteChange(comm.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveCommodityNote(comm.id);
                            }
                          }}
                          placeholder={
                            selectedRegionId && selectedRegionId !== 'all'
                              ? `Catatan ${regions.find((r) => r.id === selectedRegionId)?.name || 'Wilayah'}...`
                              : 'Tulis catatan komoditas...'
                          }
                          className="flex-1 text-xs px-2.5 py-1 bg-slate-50/70 hover:bg-white focus:bg-white text-slate-800 rounded-md border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400 placeholder:italic"
                          title={`Catatan untuk ${comm.name} (${selectedRegionId && selectedRegionId !== 'all' ? (regions.find((r) => r.id === selectedRegionId)?.name || selectedRegionId) : 'Kalbar Agregat'}). Tekan Enter atau klik Simpan.`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCommodityNote(comm.id)}
                          title="Simpan Catatan Komoditas (Enter)"
                          className={`p-1.5 rounded-md border text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                            savedNoteCommodityId === comm.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          {savedNoteCommodityId === comm.id ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Quick Action buttons */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleSetAllRegions(comm.id, 'STABIL')}
                          title="Set Semua Wilayah: STABIL"
                          className="px-1.5 py-0.5 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 font-medium cursor-pointer"
                        >
                          All S
                        </button>
                        <button
                          onClick={() => handleSetAllRegions(comm.id, 'NAIK')}
                          title="Set Semua Wilayah: NAIK"
                          className="px-1.5 py-0.5 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 font-medium cursor-pointer"
                        >
                          All N
                        </button>
                        <button
                          onClick={() => handleSetAllRegions(comm.id, 'TURUN')}
                          title="Set Semua Wilayah: TURUN"
                          className="px-1.5 py-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 font-medium cursor-pointer"
                        >
                          All T
                        </button>
                        <button
                          onClick={() => handleSetAllRegions(comm.id, 'KOSONG')}
                          title="Set Semua Wilayah: NIHIL (-)"
                          className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-300 font-mono font-bold cursor-pointer"
                        >
                          -
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar for Harmonization Table */}
        {filteredCommodities.length > 0 && (
          <DataPaginationBar
            currentPage={gridPage}
            totalItems={filteredCommodities.length}
            pageSize={gridPageSize}
            onPageChange={setGridPage}
            onPageSizeChange={setGridPageSize}
            pageSizeOptions={[25, 50, 100, 'all']}
            itemLabel="komoditas harmonisasi"
          />
        )}
      </div>

      {/* Visual Guide & Legend */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold text-slate-800 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            4 Level Rantai Pasok:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span><strong>1. Prod</strong>: Produsen Perdesaan (HPG)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span><strong>2. K.Desa</strong>: Konsumen Perdesaan (HKD)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span><strong>3. PB</strong>: Perdagangan Besar (HPB)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span><strong>4. HK</strong>: Harga Konsumen (HK)</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 text-[11px]">
          <span className="text-slate-500 font-medium">Rotasi Status:</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">STABIL</span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">NAIK</span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">TURUN</span>
          <span>&rarr;</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300 font-bold font-mono">- Nihil</span>
        </div>
      </div>
    </div>
  );
};
