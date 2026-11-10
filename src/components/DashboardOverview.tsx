import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  ChevronRight,
  Grid,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CommoditySeriesSummary,
  CommodityTrendAnalysis,
  MonthlyHarmonizationDataset,
  PriceLevel,
  RegionInfo,
} from '../types';
import {
  analyzeAllCommodityTrends,
  computeAllCommoditySummaries,
  getStatusBadgeStyle,
} from '../utils/analysis';
import { RegionalStabilitySummary } from './RegionalStabilitySummary';

interface DashboardOverviewProps {
  datasets: MonthlyHarmonizationDataset[];
  regions?: RegionInfo[];
  selectedRegionId: string;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
  onSelectCommodity: (commodityId: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  datasets,
  regions,
  selectedRegionId,
  selectedPriceLevel = 'all',
  onSelectCommodity,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'fluktuatif' | 'stabil' | 'naik' | 'turun'>('all');
  const [sortBy, setSortBy] = useState<'volatility' | 'stability' | 'no' | 'name'>('volatility');

  // Compute summaries across all datasets with current price level
  const summaries: CommoditySeriesSummary[] = useMemo(() => {
    return computeAllCommoditySummaries(datasets, selectedRegionId, selectedPriceLevel);
  }, [datasets, selectedRegionId, selectedPriceLevel]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    summaries.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [summaries]);

  // Sorted months
  const sortedDatasets = useMemo(() => {
    return [...datasets].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  }, [datasets]);

  // Matrix sorting state for all columns
  const [matrixSortCol, setMatrixSortCol] = useState<string>('no');
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('asc');

  const handleMatrixSort = (col: string) => {
    if (matrixSortCol === col) {
      setMatrixSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setMatrixSortCol(col);
      setMatrixSortDir(col === 'stability' || col === 'volatility' ? 'desc' : 'asc');
    }
  };

  // Filtered summaries for the Cross-Month Matrix
  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => {
        const matchesSearch = s.commodityName.toLowerCase().includes(search.toLowerCase()) || String(s.no).includes(search);
        const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
        let matchesFilter = true;
        if (filterType === 'fluktuatif') {
          matchesFilter = s.volatilityClassification === 'SANGAT BERGEJOLAK' || s.volatilityClassification === 'FLUKTUATIF';
        } else if (filterType === 'stabil') {
          matchesFilter = s.volatilityClassification === 'SANGAT STABIL' || s.volatilityClassification === 'CENDERUNG STABIL';
        } else if (filterType === 'naik') {
          matchesFilter = s.trendDirection === 'TREN MENAIK' || s.naikMonths > s.turunMonths;
        } else if (filterType === 'turun') {
          matchesFilter = s.trendDirection === 'TREN MENURUN' || s.turunMonths > s.naikMonths;
        }

        return matchesSearch && matchesCategory && matchesFilter;
      })
      .sort((a, b) => {
        const mult = matrixSortDir === 'asc' ? 1 : -1;
        const statusWeight: Record<string, number> = {
          NAIK: 4,
          STABIL: 3,
          TURUN: 2,
          KOSONG: 1,
          '-': 1,
        };

        if (matrixSortCol === 'no') {
          return (a.no - b.no) * mult;
        }
        if (matrixSortCol === 'name') {
          return a.commodityName.localeCompare(b.commodityName) * mult;
        }
        if (matrixSortCol === 'stability') {
          const diff = a.stabilityRate - b.stabilityRate;
          return (diff !== 0 ? diff : a.no - b.no) * mult;
        }
        if (matrixSortCol === 'volatility') {
          const diff = a.volatilityRate - b.volatilityRate;
          return (diff !== 0 ? diff : a.no - b.no) * mult;
        }
        if (matrixSortCol === 'classification') {
          return a.volatilityClassification.localeCompare(b.volatilityClassification) * mult;
        }
        if (matrixSortCol === 'trend') {
          return a.trendDirection.localeCompare(b.trendDirection) * mult;
        }

        // Sort by month column (by monthId)
        const ptA = a.series.find((p) => p.monthId === matrixSortCol);
        const ptB = b.series.find((p) => p.monthId === matrixSortCol);
        const wA = ptA ? (statusWeight[ptA.overallStatus] || 0) : 0;
        const wB = ptB ? (statusWeight[ptB.overallStatus] || 0) : 0;
        const diff = wA - wB;
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      });
  }, [summaries, search, selectedCategory, filterType, matrixSortCol, matrixSortDir]);

  return (
    <div className="space-y-6 pb-12">
      {/* Summary Stabilitas Kabupaten/Kota per Level Harga */}
      <RegionalStabilitySummary
        datasets={datasets}
        regions={regions}
        initialPriceLevel={selectedPriceLevel}
        onSelectCommodity={onSelectCommodity}
      />

      {/* Matriks Lintas Bulan Time Series Komoditas */}
      <div className="space-y-4">
        {/* Matrix Header and Local Filter/Sort Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Grid className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Matriks Lintas Bulan Time Series Komoditas
                </h3>
                <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-md border border-emerald-200/70">
                  {filteredSummaries.length} Komoditas
                </span>
                <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200">
                  {sortedDatasets.length} Periode Bulan
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tinjauan horizontal pergerakan seluruh komoditas dari bulan ke bulan untuk mendeteksi pola naik, turun, atau stabil
              </p>
            </div>
          </div>

          {/* Matrix Search, Category, Quick Filters, and Sort */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari komoditas..."
                  className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Quick Filter Buttons */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Semua ({summaries.length})
                </button>
                <button
                  onClick={() => setFilterType('fluktuatif')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === 'fluktuatif' ? 'bg-white text-rose-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Fluktuatif
                </button>
                <button
                  onClick={() => setFilterType('stabil')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === 'stabil' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Stabil
                </button>
                <button
                  onClick={() => setFilterType('naik')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === 'naik' ? 'bg-white text-rose-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Tren Naik
                </button>
                <button
                  onClick={() => setFilterType('turun')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === 'turun' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Tren Turun
                </button>
              </div>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setSortBy(val);
                  if (val === 'volatility') {
                    setMatrixSortCol('volatility');
                    setMatrixSortDir('desc');
                  } else if (val === 'stability') {
                    setMatrixSortCol('stability');
                    setMatrixSortDir('desc');
                  } else if (val === 'name') {
                    setMatrixSortCol('name');
                    setMatrixSortDir('asc');
                  } else {
                    setMatrixSortCol('no');
                    setMatrixSortDir('asc');
                  }
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="no">Nomor Urut Komoditas</option>
                <option value="name">Nama Komoditas (A-Z)</option>
                <option value="volatility">Tingkat Fluktuasi Tertinggi</option>
                <option value="stability">Tingkat Stabilitas Tertinggi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cross-Month Matrix Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto max-h-[720px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider sticky top-0 z-20 select-none">
                <tr>
                  <th
                    onClick={() => handleMatrixSort('no')}
                    className="py-3 px-3 text-center border-r border-slate-800 sticky left-0 bg-slate-900 z-30 w-12 cursor-pointer hover:bg-slate-800 transition-colors"
                    title="Klik untuk mengurutkan berdasarkan nomor urut"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>No.</span>
                      <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === 'no' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleMatrixSort('name')}
                    className="py-3 px-4 border-r border-slate-800 sticky left-12 bg-slate-900 z-30 min-w-[220px] cursor-pointer hover:bg-slate-800 transition-colors"
                    title="Klik untuk mengurutkan berdasarkan nama komoditas"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Komoditas</span>
                      <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === 'name' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleMatrixSort('stability')}
                    className="py-3 px-3 text-center border-r border-slate-800 w-28 cursor-pointer hover:bg-slate-800 transition-colors"
                    title="Klik untuk mengurutkan berdasarkan persentase stabilitas"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Stabilitas (%)</span>
                      <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === 'stability' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleMatrixSort('classification')}
                    className="py-3 px-3 text-center border-r border-slate-800 w-32 cursor-pointer hover:bg-slate-800 transition-colors"
                    title="Klik untuk mengurutkan berdasarkan klasifikasi volatilitas"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Klasifikasi</span>
                      <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === 'classification' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                    </div>
                  </th>
                  {/* Month columns */}
                  {sortedDatasets.map((d) => (
                    <th
                      key={d.id}
                      onClick={() => handleMatrixSort(d.id)}
                      className="py-3 px-3 text-center border-r border-slate-800 min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-slate-800 transition-colors"
                      title={`Klik untuk mengurutkan berdasarkan status harga di bulan ${d.monthLabel}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{d.monthLabel}</span>
                        <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === d.id ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                      </div>
                    </th>
                  ))}
                  <th
                    onClick={() => handleMatrixSort('trend')}
                    className="py-3 px-3 text-center border-r border-slate-800 w-28 cursor-pointer hover:bg-slate-800 transition-colors"
                    title="Klik untuk mengurutkan berdasarkan arah tren"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Arah Tren</span>
                      <ArrowUpDown className={`w-3 h-3 ${matrixSortCol === 'trend' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center w-16">
                    Detail
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSummaries.length > 0 ? (
                  filteredSummaries.map((comm) => {
                    return (
                      <tr
                        key={comm.commodityId}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* No */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                          {comm.no}
                        </td>

                        {/* Commodity Name */}
                        <td className="py-2.5 px-4 border-r border-slate-100 sticky left-12 bg-white group-hover:bg-slate-50 z-10 shadow-2xs">
                          <div
                            onClick={() => onSelectCommodity(comm.commodityId)}
                            className="font-bold text-slate-900 group-hover:text-emerald-700 cursor-pointer transition-colors"
                          >
                            {comm.commodityName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {comm.category}
                          </div>
                        </td>

                        {/* Stability % */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100 bg-slate-50/30">
                          <span className="font-bold text-slate-800">{comm.stabilityRate}%</span>
                          <div className="text-[10px] text-slate-400">
                            {comm.stabilMonths}S • {comm.naikMonths}N • {comm.turunMonths}T
                          </div>
                        </td>

                        {/* Volatility Classification */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              comm.volatilityClassification === 'SANGAT BERGEJOLAK'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : comm.volatilityClassification === 'FLUKTUATIF'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {comm.volatilityClassification}
                          </span>
                        </td>

                        {/* Month by month cells strictly mapped to sortedDatasets */}
                        {sortedDatasets.map((d) => {
                          const pt = comm.series.find((p) => p.monthId === d.id);
                          const status = pt?.overallStatus || 'KOSONG';
                          const badge = getStatusBadgeStyle(status);

                          return (
                            <td
                              key={d.id}
                              className="py-2.5 px-3 text-center border-r border-slate-100"
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className={`inline-block w-full py-1 px-1.5 rounded text-[10px] font-bold border text-center ${badge.bg} ${badge.border} ${badge.text}`}
                                >
                                  {badge.label}
                                </span>
                                {selectedRegionId === 'all' && pt && (
                                  <span className="text-[9px] text-slate-400">
                                    {pt.naikCount}N • {pt.turunCount}T
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Trend Direction */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                            {comm.trendDirection === 'TREN MENAIK' && (
                              <span className="text-rose-600 font-bold flex items-center">
                                <ArrowUpRight className="w-3 h-3" /> Naik
                              </span>
                            )}
                            {comm.trendDirection === 'TREN MENURUN' && (
                              <span className="text-blue-600 font-bold flex items-center">
                                <ArrowDownRight className="w-3 h-3" /> Turun
                              </span>
                            )}
                            {comm.trendDirection === 'FLUKTUATIF / TIDAK MENENTU' && (
                              <span className="text-amber-600 font-medium">Fluktuatif</span>
                            )}
                            {comm.trendDirection === 'STABIL' && (
                              <span className="text-emerald-600 font-medium">Stabil</span>
                            )}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onSelectCommodity(comm.commodityId)}
                            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Lihat Detail Komoditas"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6 + sortedDatasets.length}
                      className="py-10 text-center text-slate-400 text-xs italic"
                    >
                      Tidak ada komoditas yang cocok dengan filter atau kata kunci pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
