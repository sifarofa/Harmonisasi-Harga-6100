import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CommoditySeriesSummary, MonthlyHarmonizationDataset, PriceLevel, RegionInfo } from '../types';
import { analyzeCommodityTrend, computeCommoditySeries, getStatusBadgeStyle } from '../utils/analysis';

interface CommoditySeriesViewProps {
  datasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  selectedCommodityId: string;
  setSelectedCommodityId: (id: string) => void;
  selectedRegionId: string;
  setSelectedRegionId: (id: string) => void;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
}

export const CommoditySeriesView: React.FC<CommoditySeriesViewProps> = ({
  datasets,
  regions,
  selectedCommodityId,
  setSelectedCommodityId,
  selectedRegionId,
  setSelectedRegionId,
  selectedPriceLevel = 'all',
  setSelectedPriceLevel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [presetCategory, setPresetCategory] = useState<string>('all');
  const [compareCommodityIds, setCompareCommodityIds] = useState<string[]>([]);
  const [activeViewMode, setActiveViewMode] = useState<'trajectory' | 'regional_breakdown'>('trajectory');
  const [lineCurveType, setLineCurveType] = useState<'stepAfter' | 'monotone' | 'linear'>('stepAfter');

  // List of all commodities from first dataset
  const allCommodities = useMemo(() => {
    if (!datasets || datasets.length === 0) return [];
    return datasets[0].commodities.map((c) => ({
      id: c.id,
      no: c.no,
      name: c.name,
      category: c.category,
    }));
  }, [datasets]);

  // Selected commodity summary with selectedPriceLevel
  const summary: CommoditySeriesSummary | null = useMemo(() => {
    return computeCommoditySeries(selectedCommodityId, datasets, selectedRegionId, selectedPriceLevel);
  }, [selectedCommodityId, datasets, selectedRegionId, selectedPriceLevel]);

  // Commodity detailed trend analysis
  const trendAnalysis = useMemo(() => {
    if (!summary) return null;
    return analyzeCommodityTrend(summary);
  }, [summary]);

  // Compare summaries with selectedPriceLevel
  const compareSummaries: CommoditySeriesSummary[] = useMemo(() => {
    return compareCommodityIds
      .map((id) => computeCommoditySeries(id, datasets, selectedRegionId, selectedPriceLevel))
      .filter((s): s is CommoditySeriesSummary => s !== null);
  }, [compareCommodityIds, datasets, selectedRegionId, selectedPriceLevel]);

  // Toggle compare commodity
  const toggleCompare = (commId: string) => {
    if (compareCommodityIds.includes(commId)) {
      setCompareCommodityIds(compareCommodityIds.filter((id) => id !== commId));
    } else {
      if (compareCommodityIds.length >= 3) {
        alert('Maksimal membandingkan 3 komoditas tambahan.');
        return;
      }
      setCompareCommodityIds([...compareCommodityIds, commId]);
    }
  };

  // Trajectory chart data formatted for Recharts
  const trajectoryChartData = useMemo(() => {
    if (!summary) return [];

    return summary.series.map((pt, idx) => {
      const dataPoint: Record<string, any> = {
        name: pt.monthLabel,
        monthId: pt.monthId,
        score: pt.score, // 1 = Naik, 0 = Stabil, -1 = Turun
        statusLabel: pt.overallStatus,
        naikCount: pt.naikCount,
        turunCount: pt.turunCount,
        stabilCount: pt.stabilCount,
        naikPct: pt.naikPercentage,
        turunPct: pt.turunPercentage,
        stabilPct: pt.stabilPercentage,
        [summary.commodityName]: pt.score,
      };

      // Add compare items
      compareSummaries.forEach((cs) => {
        const matchingPt = cs.series[idx];
        if (matchingPt) {
          dataPoint[cs.commodityName] = matchingPt.score;
        }
      });

      return dataPoint;
    });
  }, [summary, compareSummaries]);

  // Filtered commodity list for search dropdown
  const filteredCommodities = useMemo(() => {
    return allCommodities.filter((c) => {
      const matchesText =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.no).includes(searchQuery);

      let matchesPreset = true;
      if (presetCategory === 'pokok') matchesPreset = c.category === 'Pangan Pokok';
      else if (presetCategory === 'bumbu') matchesPreset = c.category === 'Bumbu & Hortikultura';
      else if (presetCategory === 'daging') matchesPreset = c.category === 'Daging & Unggas';
      else if (presetCategory === 'fluktuatif') matchesPreset = [2, 6, 7, 9, 34, 37].includes(c.no);

      return matchesText && matchesPreset;
    });
  }, [allCommodities, searchQuery, presetCategory]);

  // Quick navigation helpers (Previous / Next)
  const currentIndex = allCommodities.findIndex((c) => c.id === selectedCommodityId);
  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedCommodityId(allCommodities[currentIndex - 1].id);
    }
  };
  const handleNext = () => {
    if (currentIndex < allCommodities.length - 1) {
      setSelectedCommodityId(allCommodities[currentIndex + 1].id);
    }
  };

  const compareColors = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed'];

  if (!summary || !trendAnalysis) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500">Pilih komoditas untuk melihat visualisasi grafik garis harmonik.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Commodity Switcher Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Komoditas Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === allCommodities.length - 1}
                className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Komoditas Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                  No. {summary.no}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {summary.commodityName}
                </h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  {summary.category}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${trendAnalysis.patternColor}`}>
                  {trendAnalysis.patternLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <span>Lingkup Analisis:</span>
                <span className="font-semibold text-slate-700">
                  {selectedRegionId === 'all'
                    ? 'Agregat Seluruh Kabupaten/Kota'
                    : regions.find((r) => r.id === selectedRegionId)?.name || selectedRegionId}
                </span>
                <span>• {summary.totalMonths} Bulan Pengamatan</span>
              </p>
            </div>
          </div>

          {/* Quick Commodity Selector, Price Level & Compare Section */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Price Level Dropdown Filter */}
            {setSelectedPriceLevel && (
              <div className="relative inline-flex items-center">
                <Layers className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 pointer-events-none" />
                <select
                  value={selectedPriceLevel}
                  onChange={(e) => setSelectedPriceLevel(e.target.value as PriceLevel | 'all')}
                  className="pl-8 pr-3 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 rounded-lg border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Level Harga (Rekap)</option>
                  <option value="produsen_desa">Produsen Desa (HD)</option>
                  <option value="konsumen_desa">Konsumen Desa (HKD)</option>
                  <option value="perdagangan_besar">Perdagangan Besar (HPB)</option>
                  <option value="konsumen">Konsumen Eceran (HK)</option>
                </select>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCommodityId}
                onChange={(e) => setSelectedCommodityId(e.target.value)}
                className="pl-8 pr-8 py-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-[220px] truncate"
              >
                {allCommodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.no}. {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick compare buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Komparasi:</span>
              {['c_6', 'c_7', 'c_2', 'c_5', 'c_9'].map((id) => {
                const target = allCommodities.find((c) => c.id === id);
                if (!target || target.id === selectedCommodityId) return null;
                const isSelected = compareCommodityIds.includes(target.id);
                return (
                  <button
                    key={target.id}
                    onClick={() => toggleCompare(target.id)}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {target.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards for Selected Commodity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Derajat Fluktuasi */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Derajat Fluktuasi
          </span>
          <div className="mt-2">
            <span
              className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                summary.volatilityClassification === 'SANGAT BERGEJOLAK'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : summary.volatilityClassification === 'FLUKTUATIF'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {summary.volatilityClassification}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Tingkat fluktuasi arah: <strong className="text-slate-800">{summary.volatilityRate}%</strong>
          </p>
        </div>

        {/* Tingkat Stabilitas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Tingkat Stabilitas
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{summary.stabilityRate}%</span>
            <span className="text-xs text-slate-500 font-medium">({summary.stabilMonths} dari {summary.totalMonths} bln)</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${
                summary.stabilityRate >= 70 ? 'bg-emerald-500' : summary.stabilityRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${summary.stabilityRate}%` }}
            ></div>
          </div>
        </div>

        {/* Status Terkini & Streak */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Status Terakhir
          </span>
          <div className="mt-2 flex items-center gap-2">
            {summary.currentStreak.status === 'NAIK' && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> NAIK ({summary.currentStreak.count} bln)
              </span>
            )}
            {summary.currentStreak.status === 'TURUN' && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" /> TURUN ({summary.currentStreak.count} bln)
              </span>
            )}
            {summary.currentStreak.status === 'STABIL' && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> STABIL ({summary.currentStreak.count} bln)
              </span>
            )}
            {summary.currentStreak.status === '0' && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                Netral / 0
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Streak stabil terpanjang: <strong className="text-slate-800">{trendAnalysis.longestStableStreak} bulan</strong>
          </p>
        </div>

        {/* Frekuensi Arah */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Frekuensi Arah
          </span>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-sm font-bold text-slate-800">{summary.naikMonths}x</span>
              <span className="text-[11px] text-slate-400">Naik</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-sm font-bold text-slate-800">{summary.turunMonths}x</span>
              <span className="text-[11px] text-slate-400">Turun</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-bold text-slate-800">{summary.stabilMonths}x</span>
              <span className="text-[11px] text-slate-400">Stabil</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Arah tren: <strong className="text-slate-800">{summary.trendDirection}</strong>
          </p>
        </div>
      </div>

      {/* Main Visual Chart: Harmonic Line Chart with Visual Zones */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Grafik Garis Harmonisasi Bulanan ({summary.commodityName})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi pergerakan arah harmonisasi (+1 = NAIK, 0 = STABIL, -1 = TURUN) antar periode bulan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Curve Style */}
            {activeViewMode === 'trajectory' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setLineCurveType('stepAfter')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    lineCurveType === 'stepAfter'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Garis Bertahap (Step)"
                >
                  Step Line
                </button>
                <button
                  onClick={() => setLineCurveType('monotone')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    lineCurveType === 'monotone'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Garis Lengkung Halus"
                >
                  Smooth Curve
                </button>
                <button
                  onClick={() => setLineCurveType('linear')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    lineCurveType === 'linear'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Garis Lurus"
                >
                  Linear
                </button>
              </div>
            )}

            {/* View Mode */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveViewMode('trajectory')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeViewMode === 'trajectory'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grafik Garis Arah
              </button>
              <button
                onClick={() => setActiveViewMode('regional_breakdown')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeViewMode === 'regional_breakdown'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Komposisi Wilayah (Bar)
              </button>
            </div>
          </div>
        </div>

        {/* Legend / Visual Zones Guide */}
        <div className="flex flex-wrap items-center justify-between text-xs py-2 px-3 bg-slate-50 rounded-lg mt-3 border border-slate-100 gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Zona Pergerakan:</span>
            <span className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 border border-rose-400"></span>
              Zona NAIK (+1)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400"></span>
              Zona STABIL (0)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-200 border border-blue-400"></span>
              Zona TURUN (-1)
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            Nilai arah relatif • Tidak menampilkan angka harga
          </div>
        </div>

        {activeViewMode === 'trajectory' ? (
          <div className="h-80 sm:h-96 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectoryChartData} margin={{ top: 25, right: 30, left: 10, bottom: 10 }}>
                {/* Reference lines for zones */}
                <ReferenceLine y={1} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'NAIK (+1)', position: 'right', fill: '#e11d48', fontSize: 10, fontWeight: 600 }} />
                <ReferenceLine y={0} stroke="#10b981" strokeDasharray="2 2" strokeWidth={1.5} label={{ value: 'STABIL (0)', position: 'right', fill: '#059669', fontSize: 10, fontWeight: 600 }} />
                <ReferenceLine y={-1} stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'TURUN (-1)', position: 'right', fill: '#2563eb', fontSize: 10, fontWeight: 600 }} />

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[-1.25, 1.25]}
                  ticks={[-1, 0, 1]}
                  tickFormatter={(val) => (val === 1 ? '▲ NAIK' : val === -1 ? '▼ TURUN' : '● STABIL')}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 2" />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800 min-w-[200px]">
                          <div className="font-bold border-b border-slate-800 pb-1.5 text-slate-200 flex items-center justify-between">
                            <span>{label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Periode</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-300 font-semibold">{summary.commodityName}:</span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                                data.score === 1
                                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                  : data.score === -1
                                  ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              }`}
                            >
                              {data.score === 1 ? 'NAIK' : data.score === -1 ? 'TURUN' : 'STABIL'}
                            </span>
                          </div>

                          {compareSummaries.map((cs) => (
                            <div key={cs.commodityId} className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">{cs.commodityName}:</span>
                              <span className="font-bold text-slate-200">
                                {data[cs.commodityName] === 1
                                  ? 'NAIK'
                                  : data[cs.commodityName] === -1
                                  ? 'TURUN'
                                  : 'STABIL'}
                              </span>
                            </div>
                          ))}

                          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-800 flex justify-between">
                            <span>Distribusi Wilayah:</span>
                            <span className="text-slate-300 font-medium">
                              {data.naikCount} Naik • {data.turunCount} Turun • {data.stabilCount} Stabil
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />

                {/* Primary Commodity Line */}
                <Line
                  type={lineCurveType}
                  dataKey={summary.commodityName}
                  stroke="#059669"
                  strokeWidth={3.5}
                  dot={{ r: 6, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 8, fill: '#047857' }}
                />

                {/* Compare Overlay Lines */}
                {compareSummaries.map((cs, idx) => (
                  <Line
                    key={cs.commodityId}
                    type={lineCurveType}
                    dataKey={cs.commodityName}
                    stroke={compareColors[idx % compareColors.length]}
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Regional Breakdown Bar Chart */
          <div className="h-80 sm:h-96 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trajectoryChartData} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="naikCount" name="Wilayah NAIK" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="turunCount" name="Wilayah TURUN" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stabilCount" name="Wilayah STABIL" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Narrative Trend Summary & Policy Insights for this commodity */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ringkasan Analisis Tren & Rekomendasi ({summary.commodityName})
            </h3>
            <p className="text-xs text-slate-500">
              Kesimpulan pergerakan harga komoditas berdasarkan akumulasi data harmonisasi bulanan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Deskripsi Pola Tren
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">
              {trendAnalysis.narrativeSummary}
            </p>

            <div className="mt-3 pt-3 border-t border-slate-200/60">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                Faktor Pemicu Utama:
              </span>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                {trendAnalysis.keyDrivers.map((driver, idx) => (
                  <li key={idx}>{driver}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Rekomendasi Pemantauan / Intervensi
            </span>
            <p className="text-xs text-emerald-900 leading-relaxed font-medium">
              {trendAnalysis.recommendedAction}
            </p>

            <div className="mt-3 pt-3 border-t border-emerald-200/60">
              <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                Periode Kunci Teridentifikasi:
              </span>
              <div className="space-y-1.5">
                {trendAnalysis.sharpIncreasePeriods.map((p, idx) => (
                  <div key={idx} className="text-[11px] text-rose-800 bg-rose-50 p-1.5 rounded border border-rose-200">
                    <strong>Lonjakan:</strong> {p.startMonthLabel} ({p.affectedRegionsCount} Wilayah Naik)
                  </div>
                ))}
                {trendAnalysis.significantDropPeriods.map((p, idx) => (
                  <div key={idx} className="text-[11px] text-blue-800 bg-blue-50 p-1.5 rounded border border-blue-200">
                    <strong>Penurunan:</strong> {p.startMonthLabel} ({p.affectedRegionsCount} Wilayah Turun)
                  </div>
                ))}
                {trendAnalysis.sharpIncreasePeriods.length === 0 && trendAnalysis.significantDropPeriods.length === 0 && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-100/60 p-1.5 rounded border border-emerald-200">
                    Stabilitas harga konsisten terjaga sepanjang seluruh periode pengamatan.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Matrix Heatmap for this Commodity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>Matriks Status Antar Wilayah ({summary.commodityName})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Rincian status pergerakan harga di setiap Kabupaten/Kota Kalimantan Barat untuk setiap bulan
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 sticky left-0 bg-slate-100/95 z-10 w-48">Wilayah (Kab/Kota)</th>
                {summary.series.map((pt) => (
                  <th key={pt.monthId} className="py-3 px-3 text-center whitespace-nowrap">
                    {pt.monthLabel}
                  </th>
                ))}
                <th className="py-3 px-3 text-center">Rekap Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regions.map((reg) => {
                let regNaik = 0;
                let regTurun = 0;
                let regStabil = 0;

                return (
                  <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 sticky left-0 bg-white/95 z-10 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">{reg.code}</span>
                        <span>{reg.name}</span>
                      </div>
                    </td>

                    {summary.series.map((pt) => {
                      const st = pt.regionalStatuses[reg.id] || '0';
                      if (st === 'NAIK') regNaik++;
                      else if (st === 'TURUN') regTurun++;
                      else if (st === 'STABIL') regStabil++;

                      const badge = getStatusBadgeStyle(st);

                      return (
                        <td key={pt.monthId} className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg} ${badge.border}`}
                          >
                            {st || '0'}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        <span className="text-rose-600 font-bold">{regNaik}N</span> •{' '}
                        <span className="text-blue-600 font-bold">{regTurun}T</span> •{' '}
                        <span className="text-emerald-600 font-bold">{regStabil}S</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
