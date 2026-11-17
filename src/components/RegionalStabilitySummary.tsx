import React, { useMemo, useState } from 'react';
import {
  Award,
  Layers,
  Search,
  Table,
  X,
} from 'lucide-react';
import { DEFAULT_REGIONS } from '../data/initialData';
import {
  MonthlyHarmonizationDataset,
  PriceLevel,
  PriceStatus,
  RegionInfo,
} from '../types';
import {
  isRegionSampleForLevel,
  getSampleDescriptionForLevel,
} from '../utils/analysis';

interface RegionalStabilitySummaryProps {
  datasets: MonthlyHarmonizationDataset[];
  regions?: RegionInfo[];
  initialPriceLevel?: PriceLevel | 'all';
  onSelectCommodity?: (commodityId: string) => void;
}

export interface CommodityStabilityDetail {
  commodityId: string;
  commodityNo: number;
  commodityName: string;
  category: string;
  unit?: string;
  totalSurveiMonths: number;
  kosongMonths: number;
  stabilMonths: number;
  naikMonths: number;
  turunMonths: number;
  stabilityRate: number; // 0 - 100%
  isFullyStable: boolean; // 100% stabil with sufficient surveyed months
  isNihil: boolean; // completely empty/unobserved
}

export interface RegionLevelStabilitySummary {
  regionId: string;
  regionName: string;
  regionType: 'Kabupaten' | 'Kota';
  regionCode: string;
  totalSurveyedCommodities: number;
  totalNihilCommodities: number;
  totalValidObservations: number;
  totalStabilObservations: number;
  totalNaikObservations: number;
  totalTurunObservations: number;
  overallStabilityRate: number; // 0 - 100%
  highStabilityCommodities: CommodityStabilityDetail[]; // stabilityRate >= threshold
  fullyStableCommodities: CommodityStabilityDetail[]; // 100% stability
  topStableCommodities: CommodityStabilityDetail[];
}

const PRICE_LEVEL_OPTIONS: {
  id: PriceLevel;
  label: string;
  shortLabel: string;
  subtitle: string;
}[] = [
  {
    id: 'produsen_desa',
    label: '1. Produsen Perdesaan',
    shortLabel: 'Produsen Desa',
    subtitle: 'Harga Produsen Perdesaan (HD / HPG - Petani & Peternak)',
  },
  {
    id: 'konsumen_desa',
    label: '2. Konsumen Perdesaan',
    shortLabel: 'Konsumen Desa',
    subtitle: 'Harga Konsumen Perdesaan (HKD / Warung & Pasar Desa)',
  },
  {
    id: 'perdagangan_besar',
    label: '3. Perdagangan Besar',
    shortLabel: 'Grosir / HPB',
    subtitle: 'Harga Perdagangan Besar (HPB / Distributor & Pasar Induk)',
  },
  {
    id: 'konsumen',
    label: '4. Konsumen',
    shortLabel: 'Konsumen / HK',
    subtitle: 'Harga Konsumen (HK / Eceran Umum & Perkotaan)',
  },
];

export const RegionalStabilitySummary: React.FC<RegionalStabilitySummaryProps> = ({
  datasets,
  regions = DEFAULT_REGIONS,
  initialPriceLevel = 'konsumen',
  onSelectCommodity,
}) => {
  // Sync with single-door filter but allow switching via level tabs
  const [internalLevel, setInternalLevel] = useState<PriceLevel>(() => {
    return initialPriceLevel && initialPriceLevel !== 'all' ? (initialPriceLevel as PriceLevel) : 'konsumen';
  });

  React.useEffect(() => {
    if (initialPriceLevel && initialPriceLevel !== 'all') {
      setInternalLevel(initialPriceLevel as PriceLevel);
    }
  }, [initialPriceLevel]);

  const activeLevel: PriceLevel = internalLevel;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Kabupaten' | 'Kota'>('all');
  const [stabilityFilter, setStabilityFilter] = useState<'all' | 'high_80' | 'high_70'>('all');
  const [sortBy, setSortBy] = useState<'stability_desc' | 'commodities_desc' | 'name_asc'>('stability_desc');

  // Helper to extract status for a region based on price level (strictly excludes NIHIL / KOSONG)
  const getRegionStatusForLevel = (
    regData: any,
    level: PriceLevel
  ): PriceStatus => {
    if (!regData) return 'KOSONG';
    if (regData.hasCommodity === false) return 'KOSONG';

    let raw: any = 'KOSONG';
    if (level === 'produsen_desa' || level === 'produsen') {
      raw = regData.produsenDesaStatus ?? regData.produsenStatus;
    } else if (level === 'konsumen_desa') {
      raw = regData.konsumenDesaStatus;
    } else if (level === 'perdagangan_besar' || level === 'grosir') {
      raw = regData.perdaganganBesarStatus ?? regData.grosirStatus;
    } else if (level === 'konsumen') {
      raw = regData.konsumenStatus ?? regData.status;
    } else {
      raw = regData.status;
    }

    if (raw === null || raw === undefined) return 'KOSONG';

    const str = String(raw).trim().toUpperCase();
    // Explicit checks for NIHIL / KOSONG / Empty / Zero / Non-observed indicators
    if (
      !str ||
      str === 'KOSONG' ||
      str === '-' ||
      str === '--' ||
      str === '---' ||
      str === 'NIHIL' ||
      str === '0' ||
      str === '0,00' ||
      str === '0.00' ||
      str === 'N/A' ||
      str === 'NA' ||
      str === 'NONE' ||
      str === 'TIDAK ADA' ||
      str === 'BELUM ADA' ||
      str === 'TD' ||
      str === 'NULL' ||
      str === 'UNDEFINED'
    ) {
      return 'KOSONG';
    }

    if (
      str === 'STABIL' ||
      str === 'TETAP' ||
      str === 'KONSTAN' ||
      str === 'SAMA' ||
      str === 'S' ||
      str.includes('STABIL')
    ) {
      return 'STABIL';
    }

    if (
      str === 'NAIK' ||
      str === '1' ||
      str === '+1' ||
      str === 'N' ||
      str === '▲' ||
      str === '↑' ||
      str.includes('NAIK') ||
      str.includes('MENINGKAT')
    ) {
      return 'NAIK';
    }

    if (
      str === 'TURUN' ||
      str === '-1' ||
      str === 'T' ||
      str === '▼' ||
      str === '↓' ||
      str.includes('TURUN') ||
      str.includes('MENURUN')
    ) {
      return 'TURUN';
    }

    return 'KOSONG';
  };

  // Compute stability summaries for all regions for ALL 4 price levels
  const allLevelsData = useMemo(() => {
    const result: Record<PriceLevel, RegionLevelStabilitySummary[]> = {
      produsen_desa: [],
      konsumen_desa: [],
      perdagangan_besar: [],
      konsumen: [],
      produsen: [],
      grosir: [],
    };

    const targetLevels: PriceLevel[] = [
      'produsen_desa',
      'konsumen_desa',
      'perdagangan_besar',
      'konsumen',
    ];

    targetLevels.forEach((level) => {
      // Filter regions strictly based on official BPS price survey sample design:
      // - HD & HKD: 12 Kabupaten (Kota Pontianak & Singkawang are NOT rural samples)
      // - HK: 5 Kab/Kota IHK (Pontianak, Singkawang, Sintang, Ketapang, Kayong Utara)
      // - HPB: 14 Kab/Kota V-HPBS
      const sampleRegions = regions.filter((reg) => isRegionSampleForLevel(reg, level));

      const regionSummaries: RegionLevelStabilitySummary[] = sampleRegions.map((region) => {
        // Collect all commodities stability in this region at this level
        const commodityDetailsMap: Record<string, CommodityStabilityDetail> = {};

        datasets.forEach((dataset) => {
          dataset.commodities.forEach((comm) => {
            if (!commodityDetailsMap[comm.id]) {
              commodityDetailsMap[comm.id] = {
                commodityId: comm.id,
                commodityNo: comm.no,
                commodityName: comm.name,
                category: comm.category,
                unit: comm.unit,
                totalSurveiMonths: 0,
                kosongMonths: 0,
                stabilMonths: 0,
                naikMonths: 0,
                turunMonths: 0,
                stabilityRate: 0,
                isFullyStable: false,
                isNihil: false,
              };
            }

            const regData = comm.regions?.[region.id];
            const st = getRegionStatusForLevel(regData, level);

            if (st === 'STABIL') {
              commodityDetailsMap[comm.id].stabilMonths++;
              commodityDetailsMap[comm.id].totalSurveiMonths++;
            } else if (st === 'NAIK') {
              commodityDetailsMap[comm.id].naikMonths++;
              commodityDetailsMap[comm.id].totalSurveiMonths++;
            } else if (st === 'TURUN') {
              commodityDetailsMap[comm.id].turunMonths++;
              commodityDetailsMap[comm.id].totalSurveiMonths++;
            } else {
              // 'KOSONG' / 'NIHIL' / '-' / '0' -> strictly excluded from active surveyed stability
              commodityDetailsMap[comm.id].kosongMonths++;
            }
          });
        });

        // Compute rate for each commodity (strictly excluding nihil / kosong)
        const minMonthsRequired = Math.min(2, datasets.length);
        const allCommodities = Object.values(commodityDetailsMap).map((item) => {
          const isNihil = item.totalSurveiMonths === 0;
          const rate =
            item.totalSurveiMonths > 0
              ? Math.round((item.stabilMonths / item.totalSurveiMonths) * 1000) / 10
              : 0;
          // Only fully stable if it was actively surveyed across sufficient periods (not just 1 solitary month while the rest are nihil)
          const isFullyStable = !isNihil && rate === 100 && item.totalSurveiMonths >= minMonthsRequired;

          return {
            ...item,
            stabilityRate: rate,
            isFullyStable,
            isNihil,
          };
        });

        // Valid surveyed commodities: exclude commodities with no observations (nihil)
        const surveyedCommodities = allCommodities.filter((c) => !c.isNihil);
        const nihilCommodities = allCommodities.filter((c) => c.isNihil);

        let totalValid = 0;
        let totalStabil = 0;
        let totalNaik = 0;
        let totalTurun = 0;

        surveyedCommodities.forEach((c) => {
          totalValid += c.totalSurveiMonths;
          totalStabil += c.stabilMonths;
          totalNaik += c.naikMonths;
          totalTurun += c.turunMonths;
        });

        const overallRate =
          totalValid > 0 ? Math.round((totalStabil / totalValid) * 1000) / 10 : 0;

        // High stability commodities (stabilityRate >= 70% and actively surveyed)
        const highStability = surveyedCommodities
          .filter((c) => c.stabilityRate >= 70 && c.totalSurveiMonths >= minMonthsRequired)
          .sort((a, b) => {
            if (b.stabilityRate !== a.stabilityRate) {
              return b.stabilityRate - a.stabilityRate;
            }
            return b.stabilMonths - a.stabilMonths;
          });

        const fullyStable = surveyedCommodities.filter((c) => c.isFullyStable);

        const topStable = [...surveyedCommodities].sort((a, b) => {
          if (b.stabilityRate !== a.stabilityRate) {
            return b.stabilityRate - a.stabilityRate;
          }
          return b.stabilMonths - a.stabilMonths;
        });

        return {
          regionId: region.id,
          regionName: region.name,
          regionType: region.type,
          regionCode: region.code,
          totalSurveyedCommodities: surveyedCommodities.length,
          totalNihilCommodities: nihilCommodities.length,
          totalValidObservations: totalValid,
          totalStabilObservations: totalStabil,
          totalNaikObservations: totalNaik,
          totalTurunObservations: totalTurun,
          overallStabilityRate: overallRate,
          highStabilityCommodities: highStability,
          fullyStableCommodities: fullyStable,
          topStableCommodities: topStable,
        };
      });

      result[level] = regionSummaries;
    });

    return result;
  }, [datasets, regions]);

  // Current level data
  const currentLevelKey: PriceLevel = activeLevel;
  const currentLevelSummaries = allLevelsData[currentLevelKey] || [];

  // Filtered and sorted current level summaries
  const filteredSummaries = useMemo(() => {
    return currentLevelSummaries
      .filter((r) => {
        // Search filter: matches region name or matches any of its high-stability commodities
        const matchesSearch =
          !searchQuery ||
          r.regionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.highStabilityCommodities.some((c) =>
            c.commodityName.toLowerCase().includes(searchQuery.toLowerCase())
          );

        // Type filter: all / Kabupaten / Kota
        const matchesType = filterType === 'all' || r.regionType === filterType;

        // Stability rate threshold filter
        let matchesStability = true;
        if (stabilityFilter === 'high_80') {
          matchesStability = r.overallStabilityRate >= 80;
        } else if (stabilityFilter === 'high_70') {
          matchesStability = r.overallStabilityRate >= 70;
        }

        return matchesSearch && matchesType && matchesStability;
      })
      .sort((a, b) => {
        if (sortBy === 'stability_desc') {
          return b.overallStabilityRate - a.overallStabilityRate;
        }
        if (sortBy === 'commodities_desc') {
          return b.highStabilityCommodities.length - a.highStabilityCommodities.length;
        }
        return a.regionName.localeCompare(b.regionName);
      });
  }, [currentLevelSummaries, searchQuery, filterType, stabilityFilter, sortBy]);

  // Executive KPI summary for active price level
  const activeLevelKpis = useMemo(() => {
    if (currentLevelSummaries.length === 0) {
      return {
        topRegion: null,
        avgStabilityRate: 0,
        totalHighStabilityCount: 0,
        mostCommonStableCommodity: '-',
      };
    }

    const sortedByRate = [...currentLevelSummaries].sort(
      (a, b) => b.overallStabilityRate - a.overallStabilityRate
    );
    const topRegion = sortedByRate[0];

    const totalRate = currentLevelSummaries.reduce(
      (acc, r) => acc + r.overallStabilityRate,
      0
    );
    const avgStabilityRate =
      Math.round((totalRate / currentLevelSummaries.length) * 10) / 10;

    const totalHigh = currentLevelSummaries.reduce(
      (acc, r) => acc + r.highStabilityCommodities.length,
      0
    );

    // Commodity with most stable appearances across all regions
    const commStableAppearanceCount: Record<string, { name: string; count: number }> = {};
    currentLevelSummaries.forEach((r) => {
      r.highStabilityCommodities.forEach((c) => {
        if (!commStableAppearanceCount[c.commodityId]) {
          commStableAppearanceCount[c.commodityId] = {
            name: c.commodityName,
            count: 0,
          };
        }
        commStableAppearanceCount[c.commodityId].count++;
      });
    });

    const sortedComms = Object.values(commStableAppearanceCount).sort(
      (a, b) => b.count - a.count
    );
    const mostCommonStableCommodity = sortedComms[0]
      ? `${sortedComms[0].name} (${sortedComms[0].count} Wilayah)`
      : '-';

    return {
      topRegion,
      avgStabilityRate,
      totalHighStabilityCount: totalHigh,
      mostCommonStableCommodity,
    };
  }, [currentLevelSummaries]);

  const activeLevelMeta = PRICE_LEVEL_OPTIONS.find((p) => p.id === currentLevelKey);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0">
      {/* 1. Header Section */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-gradient-to-r from-emerald-950/5 via-white to-emerald-900/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Summary Stabilitas Kabupaten/Kota per Level Harga
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                  {getSampleDescriptionForLevel(activeLevel).badge}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                  {datasets.length} Periode Bulan
                </span>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-900 rounded-md border border-emerald-300/80 flex items-center gap-1.5 shadow-2xs">
                  <Layers className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>Level: {activeLevelMeta?.label || 'Konsumen (Eceran)'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Daftar kabupaten/kota dan rincian komoditas dengan tingkat stabilitas harga tertinggi (&ge; 70% stabil) pada level <strong>{activeLevelMeta?.label}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs">
              <Table className="w-3.5 h-3.5 text-emerald-700" />
              <span>Format: Tabel Analisis Wilayah</span>
            </span>
          </div>
        </div>

        {/* Level Quick Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/80">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            Pilih Level Harga:
          </span>
          {PRICE_LEVEL_OPTIONS.map((opt) => {
            const isSelected = activeLevel === opt.id;
            const desc = getSampleDescriptionForLevel(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInternalLevel(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {desc.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sample Scope Banner */}
        <div className="mt-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-950">
          <div className="p-1 bg-emerald-100 text-emerald-800 rounded-md shrink-0 mt-0.5 font-bold text-[10px]">
            {getSampleDescriptionForLevel(activeLevel).badge}
          </div>
          <div>
            <p className="font-semibold">{getSampleDescriptionForLevel(activeLevel).description}</p>
            {activeLevel === 'produsen_desa' || activeLevel === 'konsumen_desa' ? (
              <p className="text-[11px] text-emerald-800/90 mt-0.5">
                Catatan BPS: Kota Pontianak dan Kota Singkawang dikecualikan secara otomatis karena survei HD & HKD berfokus pada statistik perdesaan.
              </p>
            ) : activeLevel === 'konsumen' ? (
              <p className="text-[11px] text-emerald-800/90 mt-0.5">
                Catatan BPS: Survei Harga Konsumen resmi (IHK) di Kalbar hanya mencakup 5 Kab/Kota (Pontianak, Singkawang, Sintang, Ketapang, Kayong Utara).
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Single Price Level Breakdown */}
      <div className="p-4 sm:p-5 space-y-4">
          {/* Executive Summary Bar (Clean Table Strip, No bulky cards) */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
              <div className="p-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Wilayah Paling Stabil
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="font-bold text-slate-900 truncate">
                    {activeLevelKpis.topRegion ? activeLevelKpis.topRegion.regionName : '-'}
                  </span>
                  <span className="font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                    {activeLevelKpis.topRegion ? `${activeLevelKpis.topRegion.overallStabilityRate}%` : '0%'}
                  </span>
                </div>
              </div>

              <div className="p-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Rata-rata Stabilitas
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="font-bold text-slate-900">
                    {activeLevelKpis.avgStabilityRate}%
                  </span>
                  <span className="text-slate-500 text-[11px]">Se-Kalbar</span>
                </div>
              </div>

              <div className="p-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Komoditas Terkendali
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="font-bold text-emerald-700">
                    {activeLevelKpis.totalHighStabilityCount} Pasang
                  </span>
                  <span className="text-slate-500 text-[11px]">&ge; 70%</span>
                </div>
              </div>

              <div className="p-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Komoditas Paling Merata
                </span>
                <div className="mt-1 truncate">
                  <span className="font-bold text-slate-900 truncate block" title={activeLevelKpis.mostCommonStableCommodity}>
                    {activeLevelKpis.mostCommonStableCommodity}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter, Sort Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Kab/Kota atau komoditas..."
                  className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Hapus pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Type Filter with Dynamic Sample Counts */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({currentLevelSummaries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('Kabupaten')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    filterType === 'Kabupaten'
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kabupaten ({currentLevelSummaries.filter((r) => r.regionType === 'Kabupaten').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('Kota')}
                  disabled={currentLevelSummaries.filter((r) => r.regionType === 'Kota').length === 0}
                  className={`px-2 py-1 rounded transition-colors ${
                    currentLevelSummaries.filter((r) => r.regionType === 'Kota').length === 0
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : filterType === 'Kota'
                      ? 'bg-slate-900 text-white font-semibold cursor-pointer'
                      : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                  }`}
                  title={
                    currentLevelSummaries.filter((r) => r.regionType === 'Kota').length === 0
                      ? 'Wilayah Kota bukan merupakan sampel survei perdesaan HD / HKD'
                      : undefined
                  }
                >
                  Kota ({currentLevelSummaries.filter((r) => r.regionType === 'Kota').length}
                  {currentLevelSummaries.filter((r) => r.regionType === 'Kota').length === 0 ? ' - Non Sampel' : ''})
                </button>
              </div>

              {/* Stability Rate Filter */}
              <select
                value={stabilityFilter}
                onChange={(e) => setStabilityFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Stabilitas</option>
                <option value="high_80">Stabilitas Tinggi (&ge; 80%)</option>
                <option value="high_70">Stabilitas Terkendali (&ge; 70%)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs self-end md:self-auto">
              <span className="text-slate-400 font-medium">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="stability_desc">Stabilitas Tertinggi (%)</option>
                <option value="commodities_desc">Komoditas Stabil Terbanyak</option>
                <option value="name_asc">Nama Wilayah (A-Z)</option>
              </select>
            </div>
          </div>

          {/* MAIN VIEW: Structured Table of Regional Stability (Not Cards) */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="py-3 px-3.5 border-r border-slate-800 w-14 text-center">Rank</th>
                  <th className="py-3 px-3.5 border-r border-slate-800 min-w-[180px]">Kabupaten / Kota</th>
                  <th className="py-3 px-3.5 border-r border-slate-800 w-36 text-center">Tingkat Stabilitas</th>
                  <th className="py-3 px-3.5 border-r border-slate-800 w-36 text-center">Rasio Komoditas Stabil</th>
                  <th className="py-3 px-3.5 min-w-[340px]">Komoditas dengan Tingkat Stabilitas Tertinggi</th>
                  <th className="py-3 px-3.5 border-l border-slate-800 w-28 text-center">Status TPID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredSummaries.map((regionSummary, rankIdx) => {
                  const rate = regionSummary.overallStabilityRate;
                  const rateBadgeClass =
                    rate >= 80
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                      : rate >= 70
                      ? 'text-teal-800 bg-teal-50 border-teal-300'
                      : 'text-amber-800 bg-amber-50 border-amber-300';

                  const tpidStatusBadge =
                    rate >= 80 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Terkendali
                      </span>
                    ) : rate >= 70 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                        Stabil
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Waspada
                      </span>
                    );

                  return (
                    <tr
                      key={regionSummary.regionId}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-700 border-r border-slate-200">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                            rankIdx === 0
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : rankIdx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : rankIdx === 2
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rankIdx + 1}
                        </span>
                      </td>

                      {/* Region Name & Type */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {regionSummary.regionName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                            {regionSummary.regionType}
                          </span>
                        </div>
                      </td>

                      {/* Stability Rate (%) & Progress Bar */}
                      <td className="py-2.5 px-3.5 text-center border-r border-slate-200">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded font-black text-xs border ${rateBadgeClass}`}>
                            {rate}%
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                rate >= 80 ? 'bg-emerald-500' : rate >= 70 ? 'bg-teal-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Ratio Komoditas Stabil */}
                      <td className="py-2.5 px-3.5 text-center border-r border-slate-200 font-medium">
                        <div>
                          <strong className="text-slate-900">{regionSummary.highStabilityCommodities.length}</strong>
                          <span className="text-slate-500"> / {regionSummary.totalSurveyedCommodities}</span>
                        </div>
                        {regionSummary.totalNihilCommodities > 0 && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({regionSummary.totalNihilCommodities} nihil)
                          </span>
                        )}
                      </td>

                      {/* Komoditas Paling Stabil */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {regionSummary.highStabilityCommodities.length > 0 ? (
                            regionSummary.highStabilityCommodities.slice(0, 6).map((c) => (
                              <button
                                key={c.commodityId}
                                type="button"
                                onClick={() => onSelectCommodity && onSelectCommodity(c.commodityId)}
                                className="px-2 py-0.5 bg-slate-50 hover:bg-emerald-50 text-slate-800 rounded border border-slate-200 hover:border-emerald-300 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                                title={`Klik untuk melihat grafik komoditas ${c.commodityName}: ${c.stabilityRate}% stabil (${c.stabilMonths}/${c.totalSurveiMonths} bulan)`}
                              >
                                <span>{c.commodityName}</span>
                                <span className="text-[10px] font-bold text-emerald-700 bg-white px-1 py-0.2 rounded border border-slate-200">
                                  {c.stabilityRate}%
                                </span>
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              Tidak ada komoditas stabil &ge; 70% pada level harga ini
                            </span>
                          )}
                          {regionSummary.highStabilityCommodities.length > 6 && (
                            <span className="text-[10px] text-slate-500 self-center font-medium">
                              +{regionSummary.highStabilityCommodities.length - 6} lainnya
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status TPID */}
                      <td className="py-2.5 px-3.5 text-center border-l border-slate-200">
                        {tpidStatusBadge}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSummaries.length === 0 && (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada kabupaten/kota yang sesuai dengan filter pencarian
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setStabilityFilter('all');
                }}
                className="mt-2 text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
    </div>
  );
};
