import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  Layers,
  MapPin,
  Minus,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { DEFAULT_REGIONS } from '../data/initialData';
import {
  CommodityStabilityAnalysis,
  HpbsMonthlyPeriod,
  HpbsQuestionnaireType,
  StabilityLevel,
} from '../types/hpbs';
import {
  computeStabilityAnalysis,
  exportHpbsStabilityToExcel,
} from '../utils/hpbsAnalysis';
import { DataPaginationBar, QuickViewOption } from './DataPaginationBar';

interface HpbsStabilitySeriesViewProps {
  periods: HpbsMonthlyPeriod[];
  initialRegionId?: string;
}

export const HpbsStabilitySeriesView: React.FC<HpbsStabilitySeriesViewProps> = ({
  periods,
  initialRegionId,
}) => {
  const [scopeType, setScopeType] = useState<'kalbar' | 'regional'>(
    initialRegionId ? 'regional' : 'kalbar'
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string>(
    initialRegionId || 'sambas'
  );
  const [stabilityFilter, setStabilityFilter] = useState<'ALL' | StabilityLevel>('ALL');
  const [questionnaireFilter, setQuestionnaireFilter] = useState<'ALL' | HpbsQuestionnaireType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCommodityCode, setSelectedCommodityCode] = useState<string | null>(null);

  // Pagination and sorting states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const [sortKey, setSortKey] = useState<string>('kode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Compute stability analysis for chosen scope
  const analyses = useMemo(() => {
    return computeStabilityAnalysis(
      periods,
      scopeType,
      scopeType === 'regional' ? selectedRegionId : undefined
    );
  }, [periods, scopeType, selectedRegionId]);

  // Filtered analyses
  const filteredAnalyses = useMemo(() => {
    return analyses.filter((a) => {
      if (stabilityFilter !== 'ALL' && a.stabilityLevel !== stabilityFilter) {
        return false;
      }
      if (questionnaireFilter !== 'ALL' && a.kuesioner !== questionnaireFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.komoditas.toLowerCase().includes(q) ||
          a.kodeKomoditas.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [analyses, stabilityFilter, questionnaireFilter, searchQuery]);

  // Sorting handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // default numeric columns to desc, text/code to asc
      if (
        key === 'volatility' ||
        key === 'averageRh' ||
        key === 'stabilityLevel' ||
        key.startsWith('period_')
      ) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
    setCurrentPage(1);
  };

  // Sorted analyses
  const sortedAnalyses = useMemo(() => {
    const list = [...filteredAnalyses];
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'komoditas') {
        diff = a.komoditas.localeCompare(b.komoditas, 'id');
      } else if (sortKey === 'kode') {
        diff = a.kodeKomoditas.localeCompare(b.kodeKomoditas);
      } else if (sortKey === 'kuesioner') {
        diff = a.kuesioner.localeCompare(b.kuesioner);
      } else if (sortKey === 'satuan') {
        diff = (a.satuanStandar || '').localeCompare(b.satuanStandar || '');
      } else if (sortKey === 'stabilityLevel') {
        const score: Record<StabilityLevel, number> = {
          SANGAT_STABIL: 3,
          MODERAT: 2,
          FLUKTUATIF: 1,
        };
        diff = score[a.stabilityLevel] - score[b.stabilityLevel];
      } else if (sortKey === 'volatility') {
        diff = a.volatility - b.volatility;
      } else if (sortKey === 'averageRh') {
        diff = a.averageRh - b.averageRh;
      } else if (sortKey === 'trend') {
        diff = a.trend.localeCompare(b.trend);
      } else if (sortKey.startsWith('period_')) {
        const pid = sortKey.replace('period_', '');
        const ptA = a.series.find((s) => s.periodId === pid)?.rh ?? -999;
        const ptB = b.series.find((s) => s.periodId === pid)?.rh ?? -999;
        diff = ptA - ptB;
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
    return list;
  }, [filteredAnalyses, sortKey, sortDirection]);

  // Paginated analyses
  const paginatedAnalyses = useMemo(() => {
    if (pageSize === 'all') return sortedAnalyses;
    const start = (currentPage - 1) * pageSize;
    return sortedAnalyses.slice(start, start + pageSize);
  }, [sortedAnalyses, currentPage, pageSize]);

  // Overall metrics summary
  const summaryMetrics = useMemo(() => {
    const total = analyses.length;
    if (total === 0) return { total: 0, sangatStabil: 0, moderat: 0, fluktuatif: 0, avgVolatility: 0 };

    const sangatStabil = analyses.filter((a) => a.stabilityLevel === 'SANGAT_STABIL').length;
    const moderat = analyses.filter((a) => a.stabilityLevel === 'MODERAT').length;
    const fluktuatif = analyses.filter((a) => a.stabilityLevel === 'FLUKTUATIF').length;
    const avgVolatility = parseFloat(
      (analyses.reduce((acc, a) => acc + a.volatility, 0) / total).toFixed(2)
    );

    return { total, sangatStabil, moderat, fluktuatif, avgVolatility };
  }, [analyses]);

  // Sorted periods for column headers
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => a.id.localeCompare(b.id));
  }, [periods]);

  const activeRegionName = useMemo(() => {
    if (scopeType === 'kalbar') return 'Agregat Se-Kalimantan Barat';
    return DEFAULT_REGIONS.find((r) => r.id === selectedRegionId)?.name || 'Kabupaten/Kota';
  }, [scopeType, selectedRegionId]);

  const selectedCommodityDetail = useMemo(() => {
    if (!selectedCommodityCode) return null;
    return analyses.find((a) => a.kodeKomoditas === selectedCommodityCode) || null;
  }, [analyses, selectedCommodityCode]);

  const handleExportExcel = () => {
    exportHpbsStabilityToExcel(filteredAnalyses, activeRegionName);
  };

  return (
    <div className="space-y-4">
      {/* Top Scope & Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Scope Selector: Kalbar vs Regional */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
              <button
                id="btn-scope-kalbar"
                onClick={() => setScopeType('kalbar')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  scopeType === 'kalbar'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Agregat Se-Kalbar (14 Wilayah)
              </button>
              <button
                id="btn-scope-regional"
                onClick={() => setScopeType('regional')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  scopeType === 'regional'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per Kabupaten/Kota
              </button>
            </div>

            {/* Region dropdown if regional scope selected */}
            {scopeType === 'regional' && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <select
                  id="select-series-region"
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {DEFAULT_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Export and Info Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              id="btn-export-stability"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition-colors shadow-xs cursor-pointer"
              title="Ekspor Series Stabilitas ke Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export Series Excel</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari komoditas atau kode..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Stability Filter Pills */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Status:
              </span>
              <button
                onClick={() => setStabilityFilter('ALL')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  stabilityFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua ({summaryMetrics.total})
              </button>
              <button
                onClick={() => setStabilityFilter('SANGAT_STABIL')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  stabilityFilter === 'SANGAT_STABIL'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Sangat Stabil ({summaryMetrics.sangatStabil})
              </button>
              <button
                onClick={() => setStabilityFilter('MODERAT')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  stabilityFilter === 'MODERAT'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Moderat ({summaryMetrics.moderat})
              </button>
              <button
                onClick={() => setStabilityFilter('FLUKTUATIF')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  stabilityFilter === 'FLUKTUATIF'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                }`}
              >
                Fluktuatif ({summaryMetrics.fluktuatif})
              </button>
            </div>
          </div>

          {/* Questionnaire Type Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 font-medium">Kuesioner:</span>
              <select
                value={questionnaireFilter}
                onChange={(e) => {
                  setQuestionnaireFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 cursor-pointer"
              >
                <option value="ALL">Semua Kuesioner</option>
                <option value="V-HPBS.1">V-HPBS.1 (Bulanan)</option>
                <option value="V-HPBS.2">V-HPBS.2 (Mingguan)</option>
              </select>
            </div>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                Urutkan:
              </span>
              <select
                value={`${sortKey}_${sortDirection}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split('_');
                  setSortKey(k);
                  setSortDirection(d as 'asc' | 'desc');
                  setCurrentPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 cursor-pointer"
              >
                <option value="kode_asc">Kode Komoditas (01 → 99)</option>
                <option value="komoditas_asc">Nama Komoditas (A → Z)</option>
                <option value="komoditas_desc">Nama Komoditas (Z → A)</option>
                <option value="volatility_asc">Paling Stabil (Volatilitas Terendah)</option>
                <option value="volatility_desc">Paling Fluktuatif (Volatilitas Tertinggi)</option>
                <option value="averageRh_desc">Rata-rata RH Tertinggi</option>
                <option value="averageRh_asc">Rata-rata RH Terendah</option>
                <option value="stabilityLevel_desc">Status Stabilitas (Stabil Duluan)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-900">
              {summaryMetrics.sangatStabil}
              <span className="text-xs font-normal text-emerald-700 ml-1.5">
                ({summaryMetrics.total > 0 ? Math.round((summaryMetrics.sangatStabil / summaryMetrics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="text-xs font-semibold text-emerald-800">Komoditas Sangat Stabil</div>
            <div className="text-[10px] text-emerald-600">Deviasi rata-rata &lt; 1.0 poin dari 100</div>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Minus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-900">
              {summaryMetrics.moderat}
              <span className="text-xs font-normal text-amber-700 ml-1.5">
                ({summaryMetrics.total > 0 ? Math.round((summaryMetrics.moderat / summaryMetrics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="text-xs font-semibold text-amber-800">Komoditas Moderat</div>
            <div className="text-[10px] text-amber-600">Deviasi rata-rata 1.0 - 3.5 poin</div>
          </div>
        </div>

        <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-800 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-red-900">
              {summaryMetrics.fluktuatif}
              <span className="text-xs font-normal text-red-700 ml-1.5">
                ({summaryMetrics.total > 0 ? Math.round((summaryMetrics.fluktuatif / summaryMetrics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="text-xs font-semibold text-red-800">Komoditas Fluktuatif</div>
            <div className="text-[10px] text-red-600">Volatilitas tinggi (Deviasi &ge; 3.5 poin)</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              &plusmn; {summaryMetrics.avgVolatility.toFixed(2)}
            </div>
            <div className="text-xs font-semibold text-slate-800">Indeks Volatilitas Pasar</div>
            <div className="text-[10px] text-slate-500">Rata-rata deviasi |RH - 100|</div>
          </div>
        </div>
      </div>

      {/* Main Time-Series Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Series Relatif Harga Bulanan ({sortedPeriods.length} Periode Survei Rutin) &bull; {activeRegionName}
            </h3>
            <p className="text-[11px] text-slate-500">
              Warna cell: <span className="text-emerald-700 font-semibold">Hijau = Stabil (99.5 - 100.5)</span>,{' '}
              <span className="text-red-700 font-semibold">Merah = Naik (&gt;100.5)</span>,{' '}
              <span className="text-blue-700 font-semibold">Biru = Turun (&lt;99.5)</span>. Klik baris untuk detail.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Menampilkan <span className="font-bold text-slate-800">{paginatedAnalyses.length}</span> dari{' '}
            <span className="font-bold text-slate-800">{sortedAnalyses.length}</span> komoditas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                {/* Komoditas */}
                <th
                  onClick={() => handleSort('komoditas')}
                  className={`py-2.5 px-3 sticky left-0 z-10 select-none cursor-pointer transition-colors ${
                    sortKey === 'komoditas' || sortKey === 'kode'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'bg-slate-100/95 hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan berdasarkan nama komoditas"
                >
                  <div className="flex items-center gap-1">
                    <span>Komoditas</span>
                    {sortKey === 'komoditas' || sortKey === 'kode' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Kuesioner */}
                <th
                  onClick={() => handleSort('kuesioner')}
                  className={`py-2.5 px-2 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'kuesioner'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan kuesioner"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Kuesioner</span>
                    {sortKey === 'kuesioner' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Satuan */}
                <th
                  onClick={() => handleSort('satuan')}
                  className={`py-2.5 px-2 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'satuan'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan satuan"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Satuan</span>
                    {sortKey === 'satuan' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Status Stabilitas */}
                <th
                  onClick={() => handleSort('stabilityLevel')}
                  className={`py-2.5 px-3 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'stabilityLevel'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan tingkat stabilitas"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Status Stabilitas</span>
                    {sortKey === 'stabilityLevel' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Volatilitas */}
                <th
                  onClick={() => handleSort('volatility')}
                  className={`py-2.5 px-2 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'volatility'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan nilai volatilitas (rata-rata deviasi dari 100)"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Volatilitas</span>
                    {sortKey === 'volatility' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Rata-rata RH */}
                <th
                  onClick={() => handleSort('averageRh')}
                  className={`py-2.5 px-2 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'averageRh'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan rata-rata RH"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Rata-rata RH</span>
                    {sortKey === 'averageRh' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Tren */}
                <th
                  onClick={() => handleSort('trend')}
                  className={`py-2.5 px-2 text-center select-none cursor-pointer transition-colors ${
                    sortKey === 'trend'
                      ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                      : 'hover:bg-slate-200/90'
                  }`}
                  title="Klik untuk mengurutkan tren"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Tren</span>
                    {sortKey === 'trend' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Periode-periode bulanan */}
                {sortedPeriods.map((p) => {
                  const pKey = `period_${p.id}`;
                  const isPeriodSorted = sortKey === pKey;
                  return (
                    <th
                      key={p.id}
                      onClick={() => handleSort(pKey)}
                      className={`py-2.5 px-2 text-center whitespace-nowrap min-w-[75px] select-none cursor-pointer transition-colors ${
                        isPeriodSorted
                          ? 'bg-emerald-100/90 text-emerald-950 font-bold'
                          : 'hover:bg-slate-200/90'
                      }`}
                      title={`Klik untuk mengurutkan berdasarkan RH ${p.label}`}
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>{p.shortLabel}</span>
                        {isPeriodSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-emerald-700" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAnalyses.length === 0 ? (
                <tr>
                  <td colSpan={7 + sortedPeriods.length} className="py-8 text-center text-slate-400">
                    Tidak ada komoditas yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedAnalyses.map((item) => {
                  const isSelected = selectedCommodityCode === item.kodeKomoditas;
                  return (
                    <tr
                      key={item.kodeKomoditas}
                      onClick={() =>
                        setSelectedCommodityCode(
                          isSelected ? null : item.kodeKomoditas
                        )
                      }
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Komoditas Title & Code */}
                      <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 border-r border-slate-100">
                        <div className="font-bold text-slate-900">{item.komoditas}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.kodeKomoditas}
                        </div>
                      </td>

                      {/* Kuesioner */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                          {item.kuesioner}
                        </span>
                      </td>

                      {/* Satuan */}
                      <td className="py-2.5 px-2 text-center text-slate-600 whitespace-nowrap">
                        {item.satuanStandar}
                      </td>

                      {/* Status Stabilitas Badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.stabilityLevel === 'SANGAT_STABIL'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : item.stabilityLevel === 'MODERAT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {item.stabilityLevel === 'SANGAT_STABIL' && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {item.stabilityLevel === 'MODERAT' && <Minus className="w-3 h-3" />}
                          {item.stabilityLevel === 'FLUKTUATIF' && (
                            <Activity className="w-3 h-3" />
                          )}
                          {item.stabilityLevel === 'SANGAT_STABIL'
                            ? 'Sangat Stabil'
                            : item.stabilityLevel === 'MODERAT'
                            ? 'Moderat'
                            : 'Fluktuatif'}
                        </span>
                      </td>

                      {/* Volatilitas */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                        {item.volatility.toFixed(2)}
                      </td>

                      {/* Rata-rata RH */}
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-800">
                        {item.averageRh.toFixed(2)}
                      </td>

                      {/* Tren Terakhir */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                            item.trend === 'CENDERUNG_NAIK'
                              ? 'text-red-700'
                              : item.trend === 'CENDERUNG_TURUN'
                              ? 'text-blue-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {item.trend === 'CENDERUNG_NAIK' && <ArrowUpRight className="w-3 h-3" />}
                          {item.trend === 'CENDERUNG_TURUN' && <ArrowDownRight className="w-3 h-3" />}
                          {item.trend === 'STABIL' && <Minus className="w-3 h-3" />}
                          {item.trend === 'CENDERUNG_NAIK'
                            ? 'Naik'
                            : item.trend === 'CENDERUNG_TURUN'
                            ? 'Turun'
                            : 'Stabil'}
                        </span>
                      </td>

                      {/* Series Cells per Month */}
                      {sortedPeriods.map((period) => {
                        const pt = item.series.find((s) => s.periodId === period.id);
                        if (!pt) {
                          return (
                            <td
                              key={period.id}
                              className="py-2.5 px-2 text-center text-slate-300 font-mono text-[11px]"
                            >
                              -
                            </td>
                          );
                        }

                        // Cell color highlight
                        let cellBg = 'bg-white text-slate-800';
                        if (pt.rh >= 100.5) {
                          cellBg = 'bg-red-50 text-red-900 font-bold';
                        } else if (pt.rh <= 99.5) {
                          cellBg = 'bg-blue-50 text-blue-900 font-bold';
                        } else {
                          cellBg = 'bg-emerald-50/70 text-emerald-900 font-semibold';
                        }

                        return (
                          <td
                            key={period.id}
                            className={`py-2 px-2 text-center font-mono text-[11px] border-l border-slate-100 ${cellBg}`}
                            title={`${item.komoditas} (${period.label}): RH = ${pt.rh.toFixed(2)} (${pt.status})`}
                          >
                            {pt.rh.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination and Rows-per-Page (View Berapa Baris) Control */}
        <DataPaginationBar
          currentPage={currentPage}
          totalItems={sortedAnalyses.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 15, 25, 50, 100, 'all']}
          itemLabel="komoditas"
          quickViews={[
            { id: 'ALL', label: 'Semua Komoditas', count: summaryMetrics.total },
            { id: 'SANGAT_STABIL', label: 'Sangat Stabil', count: summaryMetrics.sangatStabil },
            { id: 'MODERAT', label: 'Moderat', count: summaryMetrics.moderat },
            { id: 'FLUKTUATIF', label: 'Fluktuatif', count: summaryMetrics.fluktuatif },
          ]}
          activeQuickView={stabilityFilter}
          onQuickViewChange={(id) => {
            setStabilityFilter(id as any);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Selected Commodity Detail Inspector */}
      {selectedCommodityDetail && (
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedCommodityDetail.kuesioner}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedCommodityDetail.kodeKomoditas}
                </span>
              </div>
              <h4 className="text-base font-bold text-white mt-1">
                {selectedCommodityDetail.komoditas} ({selectedCommodityDetail.satuanStandar})
              </h4>
              <p className="text-xs text-slate-400">
                Riwayat pergerakan Relatif Harga (RH) di {activeRegionName}
              </p>
            </div>

            <button
              onClick={() => setSelectedCommodityCode(null)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Tutup Rincian
            </button>
          </div>

          {/* Monthly points visual grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {selectedCommodityDetail.series.map((pt) => {
              const isHigh = pt.rh >= 100.5;
              const isLow = pt.rh <= 99.5;
              return (
                <div
                  key={pt.periodId}
                  className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 text-center"
                >
                  <div className="text-[10px] text-slate-400 font-medium">{pt.shortLabel}</div>
                  <div
                    className={`text-sm font-mono font-bold mt-1 ${
                      isHigh ? 'text-red-400' : isLow ? 'text-cyan-400' : 'text-emerald-400'
                    }`}
                  >
                    {pt.rh.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 flex items-center justify-center gap-0.5">
                    {pt.status === 'NAIK' && <TrendingUp className="w-2.5 h-2.5 text-red-400" />}
                    {pt.status === 'TURUN' && <TrendingDown className="w-2.5 h-2.5 text-cyan-400" />}
                    {pt.status === 'STABIL' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                    <span>{pt.status}</span>
                  </div>
                  {pt.geoCurr > 0 && (
                    <div className="text-[9px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-700/40">
                      Rp {pt.geoCurr.toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-800 font-mono">
            <span>
              Tingkat Volatilitas: <strong className="text-amber-400">{selectedCommodityDetail.volatility.toFixed(2)}</strong> (
              {selectedCommodityDetail.stabilityLevel})
            </span>
            <span>
              Bulan Stabil: <strong className="text-emerald-400">{selectedCommodityDetail.stableMonthsCount}</strong> dari {selectedCommodityDetail.totalMonths} bulan
            </span>
            <span>
              Rentang RH: <strong>{selectedCommodityDetail.minRh.toFixed(2)}</strong> &mdash;{' '}
              <strong>{selectedCommodityDetail.maxRh.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
