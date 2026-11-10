import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  LineChart,
  MapPin,
  Minus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  IHK_REGIONS,
  IhkCommodityItem,
  IhkComparisonResult,
  IhkCompleteDataset,
  IhkMonthOption,
  IhkRegionDataset,
  IhkRegionInfo,
  IhkStatus,
} from '../types/ihk';
import { calculateIhkStatus, exportIhkToExcel } from '../utils/ihkFileUtils';
import { DataPaginationBar } from './DataPaginationBar';

interface IhkConsumerAnalysisViewProps {
  ihkDataset: IhkCompleteDataset;
  onOpenFileManager: (tab?: 'import' | 'template' | 'export' | 'manage') => void;
}

export const IhkConsumerAnalysisView: React.FC<IhkConsumerAnalysisViewProps> = ({
  ihkDataset,
  onOpenFileManager,
}) => {
  // Region Selection: 'kalbar' (Provinsi Kalbar aggregate) or sheet id e.g. 'tidur6106'
  const [selectedRegionId, setSelectedRegionId] = useState<string>('kalbar');

  // Month Range Selection (Defaults: Jan 2024 and latest month available)
  const defaultStart = ihkDataset.availableMonths.find((m) => m.id === '2024-01')?.id || ihkDataset.availableMonths[0]?.id || '2024-01';
  const defaultEnd = ihkDataset.availableMonths.find((m) => m.id === '2026-09')?.id || ihkDataset.availableMonths.find((m) => m.id === '2026-08')?.id || ihkDataset.availableMonths[ihkDataset.availableMonths.length - 1]?.id || '2026-09';

  const [startMonthId, setStartMonthId] = useState<string>(defaultStart);
  const [endMonthId, setEndMonthId] = useState<string>(defaultEnd);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'NAIK' | 'TURUN' | 'STABIL'>('all');
  const [sortBy, setSortBy] = useState<
    'no_asc' | 'diff_desc' | 'diff_asc' | 'ihk_desc' | 'name_asc' | 'naik_desc' | 'turun_desc' | 'stabil_desc'
  >('no_asc');
  const [tolerancePercent, setTolerancePercent] = useState<number>(0.5); // ±0.5% for STABIL
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'charts'>('table');

  // Table pagination state
  const [ihkPage, setIhkPage] = useState<number>(1);
  const [ihkPageSize, setIhkPageSize] = useState<number | 'all'>(25);

  // Column click sorting state
  const [ihkSortCol, setIhkSortCol] = useState<string>('no');
  const [ihkSortDir, setIhkSortDir] = useState<'asc' | 'desc'>('asc');

  const handleIhkSort = (col: string) => {
    if (ihkSortCol === col) {
      setIhkSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setIhkSortCol(col);
      setIhkSortDir('asc');
    }
  };

  // Selected commodity for detailed time-series chart inspection
  const [inspectedCommodityCode, setInspectedCommodityCode] = useState<string | null>('0111001'); // Default BERAS

  // Is Kalbar Aggregate selected?
  const isKalbarSelected = selectedRegionId === 'kalbar';

  // Compute Kalbar composite dataset (merging all 5 kab/kota & all commodities)
  const kalbarDataset = useMemo<IhkRegionDataset>(() => {
    const commodityMap = new Map<string, {
      no: number;
      code: string;
      name: string;
      category?: string;
      monthlySums: Record<string, { sum: number; count: number }>;
    }>();

    const regionIds = Object.keys(ihkDataset.regions);

    regionIds.forEach((rId) => {
      const reg = ihkDataset.regions[rId];
      if (!reg?.items) return;

      reg.items.forEach((item) => {
        const key = item.code || item.name.toLowerCase().trim();
        if (!commodityMap.has(key)) {
          commodityMap.set(key, {
            no: item.no,
            code: item.code,
            name: item.name,
            category: item.category,
            monthlySums: {},
          });
        }

        const entry = commodityMap.get(key)!;
        if (!entry.category && item.category) {
          entry.category = item.category;
        }

        ihkDataset.availableMonths.forEach((m) => {
          const val = item.monthlyValues[m.id];
          if (val !== undefined && val !== null && !isNaN(val) && val > 0) {
            if (!entry.monthlySums[m.id]) {
              entry.monthlySums[m.id] = { sum: 0, count: 0 };
            }
            entry.monthlySums[m.id].sum += val;
            entry.monthlySums[m.id].count += 1;
          }
        });
      });
    });

    const items: IhkCommodityItem[] = Array.from(commodityMap.values())
      .sort((a, b) => a.no - b.no)
      .map((entry) => {
        const monthlyValues: Record<string, number> = {};
        ihkDataset.availableMonths.forEach((m) => {
          const rec = entry.monthlySums[m.id];
          if (rec && rec.count > 0) {
            monthlyValues[m.id] = Math.round((rec.sum / rec.count) * 100) / 100;
          } else {
            monthlyValues[m.id] = 0;
          }
        });

        return {
          no: entry.no,
          code: entry.code,
          name: entry.name,
          category: entry.category,
          monthlyValues,
        };
      });

    return {
      regionId: 'kalbar',
      sheetName: 'KALBAR',
      regionName: 'Provinsi Kalimantan Barat (Gabungan 5 Kab/Kota)',
      regionCode: '6100',
      items,
    };
  }, [ihkDataset]);

  // Active region dataset
  const activeRegionDataset = isKalbarSelected
    ? kalbarDataset
    : (ihkDataset.regions[selectedRegionId] || Object.values(ihkDataset.regions)[0]);

  const activeRegionMeta = isKalbarSelected
    ? {
        id: 'kalbar',
        name: 'Provinsi Kalimantan Barat',
        shortName: 'Kalbar',
        sheetName: 'Gabungan 5 Kab/Kota',
        code: '6100',
        type: 'Provinsi' as const,
      }
    : (IHK_REGIONS.find((r) => r.id === selectedRegionId) || {
        id: selectedRegionId,
        name: activeRegionDataset?.regionName || 'Wilayah IHK',
        shortName: activeRegionDataset?.sheetName || 'IHK',
        sheetName: activeRegionDataset?.sheetName || 'IHK',
        code: activeRegionDataset?.regionCode || '6100',
        type: 'Kabupaten' as const,
      });

  const startMonthMeta = ihkDataset.availableMonths.find((m) => m.id === startMonthId);
  const endMonthMeta = ihkDataset.availableMonths.find((m) => m.id === endMonthId);

  // Compute comparison items
  const comparisonResults = useMemo<IhkComparisonResult[]>(() => {
    if (!activeRegionDataset) return [];

    return activeRegionDataset.items.map((item) => {
      const startValue = item.monthlyValues[startMonthId] ?? 0;
      const endValue = item.monthlyValues[endMonthId] ?? 0;
      const pointDiff = Math.round((endValue - startValue) * 100) / 100;
      const percentDiff =
        startValue > 0 ? Math.round(((endValue - startValue) / startValue) * 1000) / 10 : 0;
      const status = calculateIhkStatus(startValue, endValue, tolerancePercent);

      // Build monthly history (with individual regional lines if in Kalbar mode)
      const monthlyHistory = ihkDataset.availableMonths.map((m) => {
        const regionalValues: Record<string, number> = {};
        if (isKalbarSelected) {
          IHK_REGIONS.forEach((reg) => {
            const regDataset = ihkDataset.regions[reg.id];
            const foundItem = regDataset?.items.find((it) => it.code === item.code || it.name.trim().toLowerCase() === item.name.trim().toLowerCase());
            if (foundItem && foundItem.monthlyValues[m.id] !== undefined) {
              regionalValues[reg.id] = foundItem.monthlyValues[m.id];
            }
          });
        }

        return {
          monthId: m.id,
          monthLabel: m.shortLabel,
          value: item.monthlyValues[m.id] ?? 0,
          regionalValues: isKalbarSelected ? regionalValues : undefined,
        };
      });

      // Build regional breakdown for Kalbar mode
      let regionalBreakdown: Record<string, any> | undefined = undefined;
      let kalbarNaikCount = 0;
      let kalbarTurunCount = 0;
      let kalbarStabilCount = 0;
      let kalbarActiveRegions = 0;

      if (isKalbarSelected) {
        regionalBreakdown = {};
        IHK_REGIONS.forEach((reg) => {
          const regDataset = ihkDataset.regions[reg.id];
          const foundItem = regDataset?.items.find(
            (it) => it.code === item.code || it.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (foundItem) {
            const rStart = foundItem.monthlyValues[startMonthId] ?? 0;
            const rEnd = foundItem.monthlyValues[endMonthId] ?? 0;
            const isMonitored = rStart > 0 || rEnd > 0;

            if (isMonitored) {
              kalbarActiveRegions++;
              const rPointDiff = Math.round((rEnd - rStart) * 100) / 100;
              const rPercentDiff = rStart > 0 ? Math.round(((rEnd - rStart) / rStart) * 1000) / 10 : 0;
              const rStatus = calculateIhkStatus(rStart, rEnd, tolerancePercent);

              if (rStatus === 'NAIK') kalbarNaikCount++;
              else if (rStatus === 'TURUN') kalbarTurunCount++;
              else if (rStatus === 'STABIL') kalbarStabilCount++;

              regionalBreakdown![reg.id] = {
                regionId: reg.id,
                regionName: reg.name,
                sheetName: reg.sheetName,
                startValue: rStart,
                endValue: rEnd,
                pointDiff: rPointDiff,
                percentDiff: rPercentDiff,
                status: rStatus,
                isMonitored: true,
              };
            } else {
              regionalBreakdown![reg.id] = {
                regionId: reg.id,
                regionName: reg.name,
                sheetName: reg.sheetName,
                startValue: 0,
                endValue: 0,
                pointDiff: 0,
                percentDiff: 0,
                status: 'NIHIL',
                isMonitored: false,
              };
            }
          } else {
            regionalBreakdown![reg.id] = {
              regionId: reg.id,
              regionName: reg.name,
              sheetName: reg.sheetName,
              startValue: 0,
              endValue: 0,
              pointDiff: 0,
              percentDiff: 0,
              status: 'NIHIL',
              isMonitored: false,
            };
          }
        });
      }

      let effectiveStatus = status;
      if (isKalbarSelected) {
        if (kalbarNaikCount > kalbarTurunCount && kalbarNaikCount >= kalbarStabilCount) {
          effectiveStatus = 'NAIK';
        } else if (kalbarTurunCount > kalbarNaikCount && kalbarTurunCount >= kalbarStabilCount) {
          effectiveStatus = 'TURUN';
        } else {
          effectiveStatus = 'STABIL';
        }
      }

      return {
        no: item.no,
        code: item.code,
        name: item.name,
        category: item.category,
        startValue,
        endValue,
        pointDiff,
        percentDiff,
        status: effectiveStatus,
        monthlyHistory,
        regionalBreakdown,
        kalbarNaikCount,
        kalbarTurunCount,
        kalbarStabilCount,
        kalbarActiveRegions,
      };
    });
  }, [activeRegionDataset, isKalbarSelected, startMonthId, endMonthId, tolerancePercent, ihkDataset]);

  // Filtered and sorted results
  const filteredResults = useMemo(() => {
    return comparisonResults
      .filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.code.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const mult = ihkSortDir === 'asc' ? 1 : -1;
        const statusWeight: Record<string, number> = { NAIK: 3, STABIL: 2, TURUN: 1, NIHIL: 0 };

        if (ihkSortCol === 'no') return (a.no - b.no) * mult;
        if (ihkSortCol === 'code') return a.code.localeCompare(b.code) * mult;
        if (ihkSortCol === 'name') return a.name.localeCompare(b.name) * mult;
        if (ihkSortCol === 'endValue') return (a.endValue - b.endValue) * mult;
        if (ihkSortCol === 'startValue') return (a.startValue - b.startValue) * mult;
        if (ihkSortCol === 'percentDiff') return (a.percentDiff - b.percentDiff) * mult;
        if (ihkSortCol === 'status') {
          const diff = (statusWeight[a.status] || 0) - (statusWeight[b.status] || 0);
          return (diff !== 0 ? diff : a.no - b.no) * mult;
        }
        if (ihkSortCol === 'sebaran') {
          const scoreA = (a.kalbarNaikCount || 0) * 10 - (a.kalbarTurunCount || 0) * 10 + (a.kalbarStabilCount || 0);
          const scoreB = (b.kalbarNaikCount || 0) * 10 - (b.kalbarTurunCount || 0) * 10 + (b.kalbarStabilCount || 0);
          return (scoreA - scoreB) * mult;
        }

        // Region specific column in Kalbar mode (e.g. 'tidur6171')
        if (a.regionalBreakdown && b.regionalBreakdown) {
          const regA = a.regionalBreakdown[ihkSortCol];
          const regB = b.regionalBreakdown[ihkSortCol];
          if (regA && regB) {
            const diff = (statusWeight[regA.status] || 0) - (statusWeight[regB.status] || 0);
            return (diff !== 0 ? diff : (regA.percentDiff - regB.percentDiff)) * mult;
          }
        }

        // Fallback to sortBy dropdown
        if (sortBy === 'no_asc') return a.no - b.no;
        if (sortBy === 'naik_desc') return (b.kalbarNaikCount || 0) - (a.kalbarNaikCount || 0);
        if (sortBy === 'turun_desc') return (b.kalbarTurunCount || 0) - (a.kalbarTurunCount || 0);
        if (sortBy === 'stabil_desc') return (b.kalbarStabilCount || 0) - (a.kalbarStabilCount || 0);
        if (sortBy === 'diff_desc') return b.percentDiff - a.percentDiff;
        if (sortBy === 'diff_asc') return a.percentDiff - b.percentDiff;
        if (sortBy === 'ihk_desc') return b.endValue - a.endValue;
        return a.name.localeCompare(b.name);
      });
  }, [comparisonResults, searchQuery, statusFilter, sortBy, ihkSortCol, ihkSortDir]);

  // Paginated IHK Table Results
  const paginatedIhkResults = useMemo(() => {
    if (ihkPageSize === 'all') return filteredResults;
    const size = Number(ihkPageSize);
    const start = (ihkPage - 1) * size;
    return filteredResults.slice(start, start + size);
  }, [filteredResults, ihkPage, ihkPageSize]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = comparisonResults.length;
    if (total === 0) {
      return {
        total: 0,
        naik: 0,
        turun: 0,
        stabil: 0,
        avgChange: 0,
        totalObsNaik: 0,
        totalObsTurun: 0,
        totalObsStabil: 0,
        topGainer: null,
        topDrop: null,
      };
    }

    let naik = 0;
    let turun = 0;
    let stabil = 0;
    let sumPercent = 0;
    let totalObsNaik = 0;
    let totalObsTurun = 0;
    let totalObsStabil = 0;

    comparisonResults.forEach((c) => {
      if (c.status === 'NAIK') naik++;
      else if (c.status === 'TURUN') turun++;
      else stabil++;
      sumPercent += c.percentDiff;

      if (c.kalbarNaikCount) totalObsNaik += c.kalbarNaikCount;
      if (c.kalbarTurunCount) totalObsTurun += c.kalbarTurunCount;
      if (c.kalbarStabilCount) totalObsStabil += c.kalbarStabilCount;
    });

    const avgChange = Math.round((sumPercent / total) * 10) / 10;

    const sortedByPercent = [...comparisonResults].sort((a, b) => b.percentDiff - a.percentDiff);
    const topGainer = sortedByPercent[0];
    const topDrop = sortedByPercent[sortedByPercent.length - 1];

    return {
      total,
      naik,
      turun,
      stabil,
      avgChange,
      totalObsNaik,
      totalObsTurun,
      totalObsStabil,
      topGainer,
      topDrop,
    };
  }, [comparisonResults]);

  // Selected item for inspection
  const inspectedCommodity = useMemo(() => {
    if (!inspectedCommodityCode) return comparisonResults[0] || null;
    return comparisonResults.find((c) => c.code === inspectedCommodityCode) || comparisonResults[0] || null;
  }, [comparisonResults, inspectedCommodityCode]);

  // Quick Preset Handlers
  const handleSetPresetFull = () => {
    setStartMonthId('2024-01');
    setEndMonthId('2026-08');
  };

  const handleSetPresetMoM = () => {
    if (ihkDataset.availableMonths.length >= 2) {
      const len = ihkDataset.availableMonths.length;
      setStartMonthId(ihkDataset.availableMonths[len - 2].id);
      setEndMonthId(ihkDataset.availableMonths[len - 1].id);
    }
  };

  const handleSetPresetYoY = () => {
    setStartMonthId('2024-08');
    setEndMonthId('2025-08');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Region Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-700 text-white rounded-xl shadow-xs shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Analisis IHK Level Konsumen (HK)
                </h2>
              </div>
            </div>
          </div>

          {/* Wilayah IHK Selector Tabs */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* Wilayah Kalbar Button */}
            <button
              id="btn-ihk-wilayah-kalbar"
              type="button"
              onClick={() => {
                setSelectedRegionId('kalbar');
                setIhkPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border shadow-2xs ${
                selectedRegionId === 'kalbar'
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                  : 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100/90 border-emerald-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Wilayah Kalbar (Gabungan)</span>
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1 shrink-0" />

            {/* Individual Kab/Kota Buttons */}
            {IHK_REGIONS.map((reg) => {
              const isSelected = selectedRegionId === reg.id;

              return (
                <button
                  key={reg.id}
                  id={`btn-ihk-region-${reg.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedRegionId(reg.id);
                    setIhkPage(1);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{reg.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Executive KPI Cards */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 border-b border-slate-200 bg-slate-50/50">
          {/* Total Komoditas */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Komoditas Terpantau
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {summaryMetrics.total}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {activeRegionMeta.shortName}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Level Konsumen / HK
            </span>
          </div>

          {/* Komoditas NAIK */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                {isKalbarSelected ? 'Mayoritas Naik' : 'Komoditas Naik'}
              </span>
              {/* Green triangle indicator */}
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">
                {summaryMetrics.naik}
              </span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {summaryMetrics.total > 0 ? Math.round((summaryMetrics.naik / summaryMetrics.total) * 100) : 0}%
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 mt-1 block truncate">
              {isKalbarSelected ? 'Fluktuasi naik di dominan wilayah' : 'IHK meningkat dibanding awal periode'}
            </span>
          </div>

          {/* Komoditas TURUN */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                {isKalbarSelected ? 'Mayoritas Turun' : 'Komoditas Turun'}
              </span>
              {/* Red down triangle indicator */}
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-rose-600" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700">
                {summaryMetrics.turun}
              </span>
              <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {summaryMetrics.total > 0 ? Math.round((summaryMetrics.turun / summaryMetrics.total) * 100) : 0}%
              </span>
            </div>
            <span className="text-[10px] text-rose-700 mt-1 block truncate">
              {isKalbarSelected ? 'Fluktuasi turun di dominan wilayah' : 'IHK mengalami penurunan / deflasi'}
            </span>
          </div>

          {/* Komoditas STABIL */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                {isKalbarSelected ? 'Mayoritas Stabil' : 'Komoditas Stabil'}
              </span>
              <Minus className="w-4 h-4 text-slate-500 font-bold" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-800">
                {summaryMetrics.stabil}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {summaryMetrics.total > 0 ? Math.round((summaryMetrics.stabil / summaryMetrics.total) * 100) : 0}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block truncate">
              {isKalbarSelected ? `Ambang toleransi ±${tolerancePercent}%` : `Perubahan dalam ambang ±${tolerancePercent}%`}
            </span>
          </div>

          {/* Rata-rata Perubahan / Sebaran 5 Wilayah */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {isKalbarSelected ? 'Total Sebaran Wilayah' : 'Rata-rata Perubahan'}
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              {isKalbarSelected ? (
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Total wilayah dengan fluktuasi Naik">
                    ▲ {summaryMetrics.totalObsNaik}
                  </span>
                  <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Total wilayah dengan fluktuasi Turun">
                    ▼ {summaryMetrics.totalObsTurun}
                  </span>
                  <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Total wilayah Stabil">
                    ▬ {summaryMetrics.totalObsStabil}
                  </span>
                </div>
              ) : (
                <span
                  className={`text-2xl font-black ${
                    summaryMetrics.avgChange > 0
                      ? 'text-emerald-700'
                      : summaryMetrics.avgChange < 0
                      ? 'text-rose-700'
                      : 'text-slate-800'
                  }`}
                >
                  {summaryMetrics.avgChange > 0 ? `+${summaryMetrics.avgChange}` : summaryMetrics.avgChange}%
                </span>
              )}
              <span className="text-xs text-slate-500 font-medium">
                {isKalbarSelected ? 'Observasi' : 'Persentase'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block truncate">
              {isKalbarSelected ? 'Akumulasi fluktuasi 5 wilayah' : `${startMonthMeta?.shortLabel} s/d ${endMonthMeta?.shortLabel}`}
            </span>
          </div>
        </div>

        {/* 3. Period Range & Comparison Controls Toolbar */}
        <div className="p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Periode:</span>
            </div>

            {/* Start Month Select */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">Dari:</span>
              <select
                value={startMonthId}
                onChange={(e) => setStartMonthId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white text-slate-800 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
              >
                {ihkDataset.availableMonths.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* End Month Select */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">Sampai:</span>
              <select
                value={endMonthId}
                onChange={(e) => setEndMonthId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white text-slate-800 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
              >
                {ihkDataset.availableMonths.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={handleSetPresetFull}
                className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                title="Januari 2024 s/d Agustus 2026 (Full)"
              >
                Jan '24 - Ags '26
              </button>
              <button
                type="button"
                onClick={handleSetPresetMoM}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                title="Bulan ke Bulan Terkini"
              >
                MoM Terkini
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Table / Charts / Matrix */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('table')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tabel IHK</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('charts')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'charts'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Grafik Tren</span>
            </button>
          </div>
        </div>

        {/* 4. Filter & Search Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIhkPage(1);
                }}
                placeholder="Cari nama atau kode komoditas..."
                className="pl-8 pr-7 py-1.5 text-xs bg-white text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52 sm:w-64"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIhkPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setIhkPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({comparisonResults.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('NAIK');
                  setIhkPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'NAIK'
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-current" />
                <span>Naik ({summaryMetrics.naik})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('TURUN');
                  setIhkPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'TURUN'
                    ? 'bg-rose-700 text-white font-semibold'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[6px] border-t-current" />
                <span>Turun ({summaryMetrics.turun})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('STABIL');
                  setIhkPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === 'STABIL'
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Stabil ({summaryMetrics.stabil})</span>
              </button>
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-slate-400 font-medium">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setIhkPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="no_asc">No Urut BPS (N)</option>
              {isKalbarSelected ? (
                <>
                  <option value="naik_desc">Wilayah Naik Terbanyak</option>
                  <option value="turun_desc">Wilayah Turun Terbanyak</option>
                  <option value="stabil_desc">Wilayah Stabil Terbanyak</option>
                </>
              ) : (
                <>
                  <option value="diff_desc">Kenaikan Tertinggi (%)</option>
                  <option value="diff_asc">Penurunan Terbesar (%)</option>
                  <option value="ihk_desc">Nilai IHK Tertinggi</option>
                </>
              )}
              <option value="name_asc">Nama Komoditas (A-Z)</option>
            </select>
          </div>
        </div>

        {/* 5. VIEW: TABLE */}
        {activeSubTab === 'table' && (
          <div className="overflow-x-auto">
            {isKalbarSelected ? (
              /* Tabel Khusus Kalbar: Sebaran Fluktuasi 5 Wilayah */
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold select-none">
                    <th
                      onClick={() => handleIhkSort('no')}
                      className="py-2.5 px-3 border-r border-slate-800 w-12 text-center cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan No. Urut"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>N</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'no' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('code')}
                      className="py-2.5 px-3 border-r border-slate-800 w-24 font-mono cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Kode BPS"
                    >
                      <div className="flex items-center gap-1">
                        <span>Kode</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'code' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('name')}
                      className="py-2.5 px-3 border-r border-slate-800 min-w-[200px] cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Nama Komoditas"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Komoditas</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'name' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    {IHK_REGIONS.map((reg) => (
                      <th
                        key={reg.id}
                        onClick={() => handleIhkSort(reg.id)}
                        className="py-2.5 px-2 border-r border-slate-800 text-center w-28 cursor-pointer hover:bg-slate-800 transition-colors"
                        title={`Klik untuk mengurutkan status ${reg.name}`}
                      >
                        <div className="flex items-center justify-center gap-1 font-bold truncate">
                          <span>{reg.shortName}</span>
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${ihkSortCol === reg.id ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">({reg.sheetName})</div>
                      </th>
                    ))}
                    <th
                      onClick={() => handleIhkSort('sebaran')}
                      className="py-2.5 px-3 w-48 text-center cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Sebaran Fluktuasi 5 Wilayah"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Sebaran 5 Wilayah ({startMonthMeta?.shortLabel || "'24"} - {endMonthMeta?.shortLabel || "'26"})</span>
                        <ArrowUpDown className={`w-3 h-3 shrink-0 ${ihkSortCol === 'sebaran' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-normal">
                  {paginatedIhkResults.map((item) => {
                    const isSelected = inspectedCommodityCode === item.code;

                    return (
                      <tr
                        key={item.code}
                        onClick={() => setInspectedCommodityCode(item.code)}
                        className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/60 font-medium' : ''
                        }`}
                        title="Klik baris untuk meninjau grafik komoditas ini"
                      >
                        {/* N */}
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono border-r border-slate-200">
                          {item.no}
                        </td>

                        {/* Kode */}
                        <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                          {item.code}
                        </td>

                        {/* Komoditas - keterangan kategori padi-padian dsb dihapus */}
                        <td className="py-2.5 px-3 text-slate-900 border-r border-slate-200 font-semibold">
                          <span>{item.name}</span>
                        </td>

                        {/* 5 Kolom Wilayah IHK: Naik, Turun, atau Stabil */}
                        {IHK_REGIONS.map((reg) => {
                          const rData = item.regionalBreakdown?.[reg.id];
                          if (!rData || !rData.isMonitored) {
                            return (
                              <td key={reg.id} className="py-2 px-2 text-center border-r border-slate-200 text-slate-300 font-mono text-xs">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={reg.id} className="py-2 px-2 text-center border-r border-slate-200">
                              {rData.status === 'NAIK' && (
                                <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold text-[11px]">
                                  <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-emerald-600" />
                                  <span>NAIK</span>
                                </span>
                              )}
                              {rData.status === 'TURUN' && (
                                <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-bold text-[11px]">
                                  <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[6px] border-t-rose-600" />
                                  <span>TURUN</span>
                                </span>
                              )}
                              {rData.status === 'STABIL' && (
                                <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold text-[11px]">
                                  <Minus className="w-3 h-3 text-slate-500 font-bold" />
                                  <span>STABIL</span>
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Sebaran Fluktuasi 5 Wilayah */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {(item.kalbarNaikCount || 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                {item.kalbarNaikCount} Naik
                              </span>
                            )}
                            {(item.kalbarTurunCount || 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                {item.kalbarTurunCount} Turun
                              </span>
                            )}
                            {(item.kalbarStabilCount || 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                {item.kalbarStabilCount} Stabil
                              </span>
                            )}
                            {(item.kalbarActiveRegions || 0) === 0 && (
                              <span className="text-slate-400 text-[10px] italic">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Tabel Per Kab/Kota: Selisih Poin Dihapus */
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold select-none">
                    <th
                      onClick={() => handleIhkSort('no')}
                      className="py-2.5 px-3 border-r border-slate-800 w-12 text-center cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan No. Urut"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>N</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'no' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('code')}
                      className="py-2.5 px-3 border-r border-slate-800 w-28 font-mono cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Kode BPS"
                    >
                      <div className="flex items-center gap-1">
                        <span>Kode</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'code' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('name')}
                      className="py-2.5 px-3 border-r border-slate-800 min-w-[240px] cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Nama Komoditas"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Komoditas</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'name' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('endValue')}
                      className="py-2.5 px-3 border-r border-slate-800 w-32 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Nilai IHK Akhir"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{endMonthMeta?.label || 'Agustus 2026'}</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'endValue' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('startValue')}
                      className="py-2.5 px-3 border-r border-slate-800 w-32 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Nilai IHK Awal"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{startMonthMeta?.label || "Januari '24"}</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'startValue' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    {/* Selisih Poin telah dihapus sesuai instruksi */}
                    <th
                      onClick={() => handleIhkSort('percentDiff')}
                      className="py-2.5 px-3 border-r border-slate-800 w-28 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Perubahan (%)"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Perubahan (%)</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'percentDiff' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleIhkSort('status')}
                      className="py-2.5 px-3 w-36 text-center cursor-pointer hover:bg-slate-800 transition-colors"
                      title="Klik untuk mengurutkan Status Fluktuasi"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status ({startMonthMeta?.shortLabel || "'24"} - {endMonthMeta?.shortLabel || "'26"})</span>
                        <ArrowUpDown className={`w-3 h-3 ${ihkSortCol === 'status' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-normal">
                  {paginatedIhkResults.map((item) => {
                    const isSelected = inspectedCommodityCode === item.code;

                    return (
                      <tr
                        key={item.code}
                        onClick={() => setInspectedCommodityCode(item.code)}
                        className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/60 font-medium' : ''
                        }`}
                        title="Klik baris untuk meninjau grafik time-series komoditas ini"
                      >
                        {/* N */}
                        <td className="py-2 px-3 text-center text-slate-500 font-mono border-r border-slate-200">
                          {item.no}
                        </td>

                        {/* Kode */}
                        <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                          {item.code}
                        </td>

                        {/* Komoditas - tanpa keterangan padi-padian dsb */}
                        <td className="py-2 px-3 text-slate-900 border-r border-slate-200 font-semibold">
                          <span>{item.name}</span>
                        </td>

                        {/* End Month IHK Value */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          {item.endValue > 0 ? item.endValue.toFixed(2) : '-'}
                        </td>

                        {/* Start Month IHK Value */}
                        <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                          {item.startValue > 0 ? item.startValue.toFixed(2) : '-'}
                        </td>

                        {/* Selisih Poin dihapus */}

                        {/* Perubahan (%) */}
                        <td
                          className={`py-2 px-3 text-right font-mono font-semibold border-r border-slate-200 ${
                            item.percentDiff > 0
                              ? 'text-emerald-700'
                              : item.percentDiff < 0
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {item.percentDiff > 0 ? `+${item.percentDiff.toFixed(1)}%` : `${item.percentDiff.toFixed(1)}%`}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {item.status === 'NAIK' && (
                              <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 font-bold text-[11px]">
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-emerald-600" />
                                <span>NAIK</span>
                              </div>
                            )}

                            {item.status === 'TURUN' && (
                              <div className="flex items-center gap-1 text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200 font-bold text-[11px]">
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[7px] border-t-rose-600" />
                                <span>TURUN</span>
                              </div>
                            )}

                            {item.status === 'STABIL' && (
                              <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 font-bold text-[11px]">
                                <Minus className="w-3 h-3 text-slate-500 font-bold" />
                                <span>STABIL</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination Controls for IHK Table */}
            {filteredResults.length > 0 && (
              <DataPaginationBar
                currentPage={ihkPage}
                totalItems={filteredResults.length}
                pageSize={ihkPageSize}
                onPageChange={setIhkPage}
                onPageSizeChange={setIhkPageSize}
                pageSizeOptions={[20, 50, 100, 200, 'all']}
                itemLabel="komoditas IHK"
              />
            )}

            {filteredResults.length === 0 && (
              <div className="p-8 text-center bg-slate-50">
                <p className="text-slate-600 text-sm font-semibold">
                  Tidak ada komoditas IHK yang sesuai dengan kriteria filter atau pencarian.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-2 text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. VIEW: CHARTS & TIME SERIES */}
        {activeSubTab === 'charts' && (
          <div className="p-5 space-y-6">
            {/* Top Gainers and Top Drops Bar Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top 7 Kenaikan IHK */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>7 Komoditas Kenaikan IHK Tertinggi (%)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    {startMonthMeta?.shortLabel} s/d {endMonthMeta?.shortLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  {[...comparisonResults]
                    .sort((a, b) => b.percentDiff - a.percentDiff)
                    .slice(0, 7)
                    .map((item) => (
                      <div
                        key={item.code}
                        onClick={() => setInspectedCommodityCode(item.code)}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 w-5">#{item.no}</span>
                          <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-slate-500">
                            {item.startValue.toFixed(1)} &rarr; {item.endValue.toFixed(1)}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-bold font-mono text-xs border border-emerald-200">
                            +{item.percentDiff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Top 7 Penurunan IHK */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <span>7 Komoditas Penurunan IHK Terbesar (%)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    {startMonthMeta?.shortLabel} s/d {endMonthMeta?.shortLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  {[...comparisonResults]
                    .sort((a, b) => a.percentDiff - b.percentDiff)
                    .slice(0, 7)
                    .map((item) => (
                      <div
                        key={item.code}
                        onClick={() => setInspectedCommodityCode(item.code)}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-rose-400 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 w-5">#{item.no}</span>
                          <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-slate-500">
                            {item.startValue.toFixed(1)} &rarr; {item.endValue.toFixed(1)}
                          </span>
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-800 rounded font-bold font-mono text-xs border border-rose-200">
                            {item.percentDiff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Time-Series Line Chart for Inspected Commodity */}
            {inspectedCommodity && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Grafik Time-Series IHK: {inspectedCommodity.name}
                      </h4>
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                        Kode: {inspectedCommodity.code}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          inspectedCommodity.status === 'NAIK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inspectedCommodity.status === 'TURUN'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {inspectedCommodity.status} ({inspectedCommodity.percentDiff > 0 ? '+' : ''}
                        {inspectedCommodity.percentDiff}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perjalanan nilai Indeks Harga Konsumen bulanan di {activeRegionMeta.name} ({activeRegionMeta.sheetName})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Pilih Komoditas:</span>
                    <select
                      value={inspectedCommodityCode || ''}
                      onChange={(e) => setInspectedCommodityCode(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-slate-50 text-slate-800 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {comparisonResults.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.no}. {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={inspectedCommodity.monthlyHistory.map((m) => {
                        const pt: any = {
                          monthLabel: m.monthLabel,
                          value: m.value,
                        };
                        if (m.regionalValues) {
                          Object.entries(m.regionalValues).forEach(([k, v]) => {
                            pt[k] = v;
                          });
                        }
                        return pt;
                      })}
                      margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        interval={2}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        domain={['dataMin - 3', 'dataMax + 3']}
                      />
                      <RechartsTooltip
                        formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}`, name]}
                        labelFormatter={(label) => `Bulan: ${label}`}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          color: '#fff',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={isKalbarSelected ? "Kalbar (Rata-rata Gabungan)" : `IHK ${activeRegionMeta.shortName}`}
                        stroke="#059669"
                        strokeWidth={isKalbarSelected ? 3.5 : 2.5}
                        dot={{ r: 3, fill: '#059669' }}
                        activeDot={{ r: 6, fill: '#047857' }}
                      />
                      {isKalbarSelected && (
                        <>
                          <Line type="monotone" dataKey="tidur6171" name="Kota Pontianak" stroke="#2563eb" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="tidur6172" name="Kota Singkawang" stroke="#9333ea" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="tidur6106" name="Kab. Ketapang" stroke="#d97706" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="tidur6107" name="Kab. Sintang" stroke="#0891b2" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="tidur6111" name="Kab. Kayong Utara" stroke="#e11d48" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                        </>
                      )}
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
