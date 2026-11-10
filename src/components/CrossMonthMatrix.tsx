import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  Grid,
  Layers,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { CommoditySeriesSummary, MonthlyHarmonizationDataset, PriceLevel, RegionInfo } from '../types';
import { computeAllCommoditySummaries, getStatusBadgeStyle } from '../utils/analysis';

interface CrossMonthMatrixProps {
  datasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  selectedRegionId: string;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
  setSelectedRegionId: (id: string) => void;
  onSelectCommodity: (commodityId: string) => void;
}

export const CrossMonthMatrix: React.FC<CrossMonthMatrixProps> = ({
  datasets,
  regions,
  selectedRegionId,
  selectedPriceLevel = 'all',
  setSelectedPriceLevel,
  setSelectedRegionId,
  onSelectCommodity,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'fluktuatif' | 'stabil' | 'naik' | 'turun'>('all');
  const [sortBy, setSortBy] = useState<'no' | 'volatility' | 'stability' | 'name'>('volatility');

  // Compute all commodity summaries for the matrix with selectedPriceLevel
  const summaries: CommoditySeriesSummary[] = useMemo(() => {
    return computeAllCommoditySummaries(datasets, selectedRegionId, selectedPriceLevel);
  }, [datasets, selectedRegionId, selectedPriceLevel]);

  // Categories list
  const categories = useMemo(() => {
    const s = new Set<string>();
    summaries.forEach((c) => s.add(c.category));
    return Array.from(s);
  }, [summaries]);

  // Sorted months
  const sortedDatasets = useMemo(() => {
    return [...datasets].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  }, [datasets]);

  // Filter and sort
  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => {
        const matchSearch = s.commodityName.toLowerCase().includes(search.toLowerCase()) || String(s.no).includes(search);
        const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
        let matchFilter = true;
        if (filterType === 'fluktuatif') {
          matchFilter = s.volatilityClassification === 'SANGAT BERGEJOLAK' || s.volatilityClassification === 'FLUKTUATIF';
        } else if (filterType === 'stabil') {
          matchFilter = s.volatilityClassification === 'SANGAT STABIL' || s.volatilityClassification === 'CENDERUNG STABIL';
        } else if (filterType === 'naik') {
          matchFilter = s.trendDirection === 'TREN MENAIK' || s.naikMonths > s.turunMonths;
        } else if (filterType === 'turun') {
          matchFilter = s.trendDirection === 'TREN MENURUN' || s.turunMonths > s.naikMonths;
        }
        return matchSearch && matchCat && matchFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'volatility') return b.volatilityRate - a.volatilityRate;
        if (sortBy === 'stability') return b.stabilityRate - a.stabilityRate;
        if (sortBy === 'name') return a.commodityName.localeCompare(b.commodityName);
        return a.no - b.no;
      });
  }, [summaries, search, selectedCategory, filterType, sortBy]);

  return (
    <div className="space-y-4 pb-12">
      {/* Header card */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Matriks Lintas Bulan Time Series Komoditas
              </h2>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded">
                {sortedDatasets.length} Periode Bulan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tinjauan horizontal pergerakan seluruh komoditas dari bulan ke bulan untuk mendeteksi pola naik, turun, atau stabil
            </p>
          </div>

          {/* Region and Price Level selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Price Level Dropdown Filter */}
            {setSelectedPriceLevel && (
              <div className="relative inline-flex items-center">
                <Layers className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 pointer-events-none" />
                <select
                  value={selectedPriceLevel}
                  onChange={(e) => setSelectedPriceLevel(e.target.value as PriceLevel | 'all')}
                  className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 rounded-lg border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Level Harga (Rekap)</option>
                  <option value="produsen_desa">Produsen Desa (HD)</option>
                  <option value="konsumen_desa">Konsumen Desa (HKD)</option>
                  <option value="perdagangan_besar">Perdagangan Besar (HPB)</option>
                  <option value="konsumen">Konsumen Eceran (HK)</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Wilayah:</span>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Wilayah (Agregat)</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filters and sorting */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari komoditas..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56"
              />
            </div>

            {/* Category */}
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
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
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
                  filterType === 'naik' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                Tren Naik
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="volatility">Tingkat Fluktuasi Tertinggi</option>
              <option value="stability">Tingkat Stabilitas Tertinggi</option>
              <option value="no">Nomor Urut Komoditas</option>
              <option value="name">Nama Komoditas (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cross-Month Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider sticky top-0 z-20">
              <tr>
                <th className="py-3 px-3 text-center border-r border-slate-800 sticky left-0 bg-slate-900 z-30 w-12">
                  No.
                </th>
                <th className="py-3 px-4 border-r border-slate-800 sticky left-12 bg-slate-900 z-30 min-w-[220px]">
                  Komoditas
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-28">
                  Stabilitas (%)
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-800 w-32">
                  Klasifikasi
                </th>
                {/* Month columns */}
                {sortedDatasets.map((d) => (
                  <th
                    key={d.id}
                    className="py-3 px-3 text-center border-r border-slate-800 min-w-[110px] whitespace-nowrap"
                  >
                    {d.monthLabel}
                  </th>
                ))}
                <th className="py-3 px-3 text-center border-r border-slate-800 w-28">
                  Arah Tren
                </th>
                <th className="py-3 px-3 text-center w-16">
                  Detail
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredSummaries.map((comm) => {
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
                        title="Lihat Detail Series"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
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
