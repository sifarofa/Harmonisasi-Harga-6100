import React from 'react';
import {
  Calendar,
  ChevronDown,
  Filter,
  Layers,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { MonthlyHarmonizationDataset, PriceLevel, RegionInfo } from '../types';

interface UnifiedFilterBarProps {
  datasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  selectedMonthId: string;
  setSelectedMonthId: (id: string) => void;
  selectedRegionId: string;
  setSelectedRegionId: (id: string) => void;
  selectedPriceLevel: PriceLevel | 'all';
  setSelectedPriceLevel: (level: PriceLevel | 'all') => void;
}

export const UnifiedFilterBar: React.FC<UnifiedFilterBarProps> = ({
  datasets,
  regions,
  selectedMonthId,
  setSelectedMonthId,
  selectedRegionId,
  setSelectedRegionId,
  selectedPriceLevel,
  setSelectedPriceLevel,
}) => {
  const defaultMonth = datasets.length > 0 ? datasets[datasets.length - 1] : null;
  const activeDataset = datasets.find((d) => d.id === selectedMonthId) || defaultMonth;
  const activeRegion = regions.find((r) => r.id === selectedRegionId);

  const priceLevelLabels: Record<PriceLevel | 'all', string> = {
    all: 'Semua Level (Konsolidasi 4 Level)',
    produsen_desa: '1. Produsen Perdesaan (HD / Petani)',
    konsumen_desa: '2. Konsumen Perdesaan (HKD / Warung Desa)',
    perdagangan_besar: '3. Perdagangan Besar (HPB / Grosir)',
    konsumen: '4. Konsumen Eceran (HK / Pasar Kota)',
    produsen: '1. Produsen Perdesaan (HD / Petani)',
    grosir: '3. Perdagangan Besar (HPB / Grosir)',
  };

  const isFiltered =
    selectedPriceLevel !== 'all' ||
    selectedRegionId !== 'all' ||
    (defaultMonth && selectedMonthId !== defaultMonth.id);

  const handleResetFilters = () => {
    setSelectedPriceLevel('all');
    setSelectedRegionId('all');
    if (defaultMonth) {
      setSelectedMonthId(defaultMonth.id);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Top Bar of Filter */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-xs font-bold text-slate-800">
            Filter Harmonisasi
          </span>
        </div>

        {isFiltered && (
          <button
            type="button"
            id="btn-reset-unified-filter"
            onClick={handleResetFilters}
            title="Kembalikan semua filter ke pengaturan standar"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      {/* 3 Unified Filter Controls */}
      <div className="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white">
        {/* 1. FILTER TINGKAT HARGA / LEVEL */}
        <div>
          <label
            htmlFor="unified-price-level-select"
            className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tingkat Harga</span>
          </label>
          <div className="relative">
            <select
              id="unified-price-level-select"
              value={selectedPriceLevel}
              onChange={(e) => setSelectedPriceLevel(e.target.value as PriceLevel | 'all')}
              className={`w-full pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                selectedPriceLevel !== 'all'
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">Semua Level (Konsolidasi 4 Level)</option>
              <option value="produsen_desa">1. Produsen Perdesaan (HD / HPG - Petani)</option>
              <option value="konsumen_desa">2. Konsumen Perdesaan (HKD - Warung Desa)</option>
              <option value="perdagangan_besar">3. Perdagangan Besar (HPB - Grosir/Distributor)</option>
              <option value="konsumen">4. Konsumen Eceran (HK - Pasar Konsumen)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 2. FILTER WILAYAH / KABUPATEN-KOTA */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="unified-region-select"
              className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Wilayah</span>
            </label>
            <button
              id="btn-filter-kalbar-all"
              type="button"
              onClick={() => setSelectedRegionId('all')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                selectedRegionId === 'all'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kalbar
            </button>
          </div>
          <div className="relative">
            <select
              id="unified-region-select"
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className={`w-full pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                selectedRegionId !== 'all'
                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">Semua Wilayah (Agregat Provinsi Kalbar)</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 3. FILTER PERIODE BULAN */}
        <div>
          <label
            htmlFor="unified-month-select"
            className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Periode Bulan</span>
          </label>
          <div className="relative">
            <select
              id="unified-month-select"
              value={selectedMonthId}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              disabled={datasets.length === 0}
              className={`w-full pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                defaultMonth && selectedMonthId !== defaultMonth.id
                  ? 'bg-amber-50/70 border-amber-300 text-amber-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              {datasets.length === 0 ? (
                <option value="">(Belum Ada Data Bulan Terdaftar)</option>
              ) : (
                datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.monthLabel} {d.id === defaultMonth?.id ? '★ (Terbaru)' : ''}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

    </div>
  );
};
