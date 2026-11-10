import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  Filter,
  Home,
  Info,
  Save,
  Search,
  ShoppingCart,
  Sprout,
  Truck,
  X,
} from 'lucide-react';
import {
  CommodityCategory,
  CommodityPriceLevelHarmonization,
  LevelAlignmentType,
  MonthlyHarmonizationDataset,
  PriceLevel,
  PriceStatus,
  RegionInfo,
} from '../types';
import { computeAllPriceLevelHarmonizations, getStatusBadgeStyle } from '../utils/analysis';
import { saveHarmonizationNote } from '../utils/apiService';

interface PriceLevelHarmonizationViewProps {
  currentDataset: MonthlyHarmonizationDataset;
  allDatasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  selectedMonthId?: string;
  onSelectMonth?: (monthId: string) => void;
  selectedRegionId?: string;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
  onSelectCommodityForSeries?: (commodityId: string) => void;
  onExportExcel?: () => void;
  onUpdateDataset?: (updated: MonthlyHarmonizationDataset) => void;
}

export const PriceLevelHarmonizationView: React.FC<PriceLevelHarmonizationViewProps> = ({
  currentDataset,
  allDatasets,
  regions,
  selectedMonthId,
  onSelectMonth,
  selectedRegionId = 'all',
  selectedPriceLevel = 'all',
  setSelectedPriceLevel,
  onSelectCommodityForSeries,
  onExportExcel,
  onUpdateDataset,
}) => {
  const latestDataset = allDatasets.length > 0 ? allDatasets[allDatasets.length - 1] : currentDataset;
  const isViewingLatest = currentDataset.id === latestDataset?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAlignment, setSelectedAlignment] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'NAIK' | 'TURUN' | 'STABIL' | 'KOSONG'>('all');
  const [showOnlyDisparities, setShowOnlyDisparities] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filter inside expanded Detail Wilayah
  const [detailFilterMode, setDetailFilterMode] = useState<'all' | 'selaras' | 'perbedaan' | 'nihil'>('all');
  const [detailSearchQuery, setDetailSearchQuery] = useState<string>('');

  // Dynamic notes management keyed by `${commodityId}_${regionId}`
  const [regionalNotes, setRegionalNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (currentDataset.regionalHarmonizationNotes) {
      Object.assign(initial, currentDataset.regionalHarmonizationNotes);
    }
    currentDataset.commodities?.forEach((c) => {
      Object.entries(c.regions || {}).forEach(([regId, rVal]) => {
        const note = (rVal as any)?.dynamicNotes || (rVal as any)?.catatan;
        if (note && !initial[`${c.commodityId}_${regId}`]) {
          initial[`${c.commodityId}_${regId}`] = note;
        }
      });
    });
    try {
      const stored = localStorage.getItem(`harmonization_dyn_notes_${currentDataset.id}`);
      if (stored) {
        Object.assign(initial, JSON.parse(stored));
      }
    } catch (_) {}
    return initial;
  });

  // Track draft note inputs before blur/save
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  // Sync regionalNotes when dataset changes
  useEffect(() => {
    if (currentDataset.regionalHarmonizationNotes) {
      setRegionalNotes((prev) => ({
        ...prev,
        ...currentDataset.regionalHarmonizationNotes,
      }));
    }
  }, [currentDataset.id, currentDataset.regionalHarmonizationNotes]);

  const handleSaveNote = (commodityId: string, regionId: string, noteText: string) => {
    const key = `${commodityId}_${regionId}`;
    const cleanText = noteText.trim();
    const updatedNotes = { ...regionalNotes, [key]: cleanText };
    setRegionalNotes(updatedNotes);

    // Commit immediately to central cloud backend (Single Source of Truth)
    saveHarmonizationNote(currentDataset.id, commodityId, regionId, cleanText);

    // Local mirror fallback for offline tolerance
    try {
      localStorage.setItem(`harmonization_dyn_notes_${currentDataset.id}`, JSON.stringify(updatedNotes));
    } catch (_) {}

    // Flash saving confirmation
    setSavingStatus((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavingStatus((prev) => ({ ...prev, [key]: false }));
    }, 2500);

    // Propagate to parent dataset
    if (onUpdateDataset) {
      const updatedCommodities = currentDataset.commodities.map((c) => {
        if (c.commodityId === commodityId || c.id === commodityId) {
          const regObj = c.regions?.[regionId] || { status: 'KOSONG' as PriceStatus };
          return {
            ...c,
            regions: {
              ...c.regions,
              [regionId]: {
                ...regObj,
                catatan: cleanText,
                dynamicNotes: cleanText,
              },
            },
          };
        }
        return c;
      });

      const updatedDataset: MonthlyHarmonizationDataset = {
        ...currentDataset,
        regionalHarmonizationNotes: updatedNotes,
        commodities: updatedCommodities,
        updatedAt: new Date().toISOString(),
      };
      onUpdateDataset(updatedDataset);
    }
  };

  // Sorting state for columns
  type SortField =
    | 'no'
    | 'commodity'
    | 'produsen_desa'
    | 'konsumen_desa'
    | 'perdagangan_besar'
    | 'konsumen'
    | 'alignment'
    | 'coverage'
    | 'alignment_rate';
  const [sortField, setSortField] = useState<SortField>('no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Compute 4-tier harmonizations for current dataset respecting the single-door region filter
  const harmonizations = useMemo(() => {
    return computeAllPriceLevelHarmonizations(currentDataset, regions, selectedRegionId);
  }, [currentDataset, regions, selectedRegionId]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<CommodityCategory>();
    currentDataset.commodities.forEach((c) => set.add(c.category));
    return Array.from(set);
  }, [currentDataset]);


  // Filtered commodities
  const filteredHarmonizations = useMemo(() => {
    return harmonizations.filter((item) => {
      const matchSearch =
        item.commodityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.no).includes(searchTerm);

      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;

      const matchAlignment =
        selectedAlignment === 'all' || item.overallAlignment === selectedAlignment;

      let matchStatus = true;
      if (selectedStatusFilter !== 'all') {
        let st: PriceStatus | undefined;
        if (selectedPriceLevel === 'produsen_desa') st = item.produsenDesaStatus;
        else if (selectedPriceLevel === 'konsumen_desa') st = item.konsumenDesaStatus;
        else if (selectedPriceLevel === 'perdagangan_besar') st = item.perdaganganBesarStatus;
        else if (selectedPriceLevel === 'konsumen') st = item.konsumenStatus;
        else {
          // If 'all', matches if ANY of the 4 levels matches the status
          const statuses = [item.produsenDesaStatus, item.konsumenDesaStatus, item.perdaganganBesarStatus, item.konsumenStatus];
          matchStatus = statuses.includes(selectedStatusFilter);
        }

        if (selectedPriceLevel !== 'all') {
          matchStatus = (st || '0') === selectedStatusFilter;
        }
      }

      const matchDisparity =
        !showOnlyDisparities ||
        item.overallAlignment === 'LAG_TRANSMISI' ||
        item.overallAlignment === 'ASIMETRI_MARGIN' ||
        item.overallAlignment === 'DISPARITAS_DESA_KOTA' ||
        item.overallAlignment === 'MARGIN_TERTEKAN';

      return matchSearch && matchCategory && matchAlignment && matchStatus && matchDisparity;
    }).sort((a, b) => {
      const mult = sortDirection === 'asc' ? 1 : -1;
      const statusWeight: Record<string, number> = {
        NAIK: 4,
        STABIL: 3,
        TURUN: 2,
        KOSONG: 1,
        '-': 1,
        '0': 1,
      };
      const alignmentWeight: Record<string, number> = {
        SELARAS_NAIK: 8,
        SELARAS_TURUN: 7,
        SELARAS_STABIL: 6,
        LAG_TRANSMISI: 5,
        ASIMETRI_MARGIN: 4,
        MARGIN_TERTEKAN: 3,
        DISPARITAS_DESA_KOTA: 2,
        NON_PRODUSEN: 1,
        BERVARIASI: 1,
        NIHIL: 0,
      };

      if (sortField === 'no') {
        return (a.no - b.no) * mult;
      }
      if (sortField === 'commodity') {
        return a.commodityName.localeCompare(b.commodityName) * mult;
      }
      if (sortField === 'produsen_desa') {
        const diff = (statusWeight[a.produsenDesaOverall] || 0) - (statusWeight[b.produsenDesaOverall] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'konsumen_desa') {
        const diff = (statusWeight[a.konsumenDesaOverall] || 0) - (statusWeight[b.konsumenDesaOverall] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'perdagangan_besar') {
        const diff = (statusWeight[a.perdaganganBesarOverall] || 0) - (statusWeight[b.perdaganganBesarOverall] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'konsumen') {
        const diff = (statusWeight[a.konsumenOverall] || 0) - (statusWeight[b.konsumenOverall] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'alignment') {
        const diff = (alignmentWeight[a.overallAlignment] || 0) - (alignmentWeight[b.overallAlignment] || 0);
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'coverage') {
        const diff = a.activeRegionsCount - b.activeRegionsCount;
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      if (sortField === 'alignment_rate') {
        const diff = a.alignmentRate - b.alignmentRate;
        return (diff !== 0 ? diff : a.no - b.no) * mult;
      }
      return (a.no - b.no) * mult;
    });
  }, [
    harmonizations,
    searchTerm,
    selectedCategory,
    selectedAlignment,
    selectedPriceLevel,
    selectedStatusFilter,
    showOnlyDisparities,
    sortField,
    sortDirection,
  ]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Harmonisasi 4 Level Harga
              </span>

              {/* Direct Interactive Period Selector */}
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300/80 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-semibold text-emerald-950">Periode:</span>
                {onSelectMonth && allDatasets.length > 0 ? (
                  <select
                    id="select-price-level-month-direct"
                    value={currentDataset.id}
                    onChange={(e) => onSelectMonth(e.target.value)}
                    className="bg-white border border-emerald-300 text-emerald-900 font-bold rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    {allDatasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.monthLabel} {d.id === latestDataset?.id ? '★ (Terbaru)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-emerald-900 font-bold">
                    {currentDataset.monthLabel}
                  </span>
                )}
                {isViewingLatest ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-600 text-white rounded shadow-2xs">
                    Terbaru
                  </span>
                ) : onSelectMonth && latestDataset ? (
                  <button
                    type="button"
                    onClick={() => onSelectMonth(latestDataset.id)}
                    className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded transition-colors cursor-pointer"
                    title={`Pindah ke periode terbaru (${latestDataset.monthLabel})`}
                  >
                    ⚡ Tampilkan {latestDataset.monthLabel}
                  </button>
                ) : null}
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Harmonisasi Rantai Pasok 4 Tingkat Harga
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {onExportExcel && (
              <button
                id="btn-export-price-level-excel"
                onClick={onExportExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                title="Ekspor laporan harmonisasi 4 level ke Excel"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Unduh Excel</span>
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-price-level"
              type="text"
              placeholder="Cari nama komoditas atau nomor urut..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Hapus
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="min-w-[180px]">
            <select
              id="select-category-price-level"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Alignment Filter */}
          <div className="min-w-[220px]">
            <select
              id="select-alignment-price-level"
              value={selectedAlignment}
              onChange={(e) => setSelectedAlignment(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="all">Semua Keselarasan 4 Level</option>
              <option value="SELARAS_NAIK">Selaras Naik (4 Level)</option>
              <option value="SELARAS_TURUN">Selaras Turun (4 Level)</option>
              <option value="SELARAS_STABIL">Selaras Stabil (4 Level)</option>
              <option value="LAG_TRANSMISI">Lag Transmisi Hulu-Hilir</option>
              <option value="DISPARITAS_DESA_KOTA">Disparitas Perdesaan vs Kota</option>
              <option value="ASIMETRI_MARGIN">Asimetri Margin Distribusi</option>
              <option value="NON_PRODUSEN">Non-Produsen Perdesaan</option>
            </select>
          </div>

          {/* Disparity Toggle Button */}
          <button
            id="btn-toggle-disparity"
            onClick={() => setShowOnlyDisparities(!showOnlyDisparities)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              showOnlyDisparities
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${showOnlyDisparities ? 'text-amber-700' : 'text-slate-500'}`} />
            <span>Hanya Disparitas & Anomali</span>
          </button>
        </div>

        {/* Price Status Quick Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 mr-2">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>Status:</span>
          </div>

          <button
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedStatusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Status
          </button>

          <button
            onClick={() => setSelectedStatusFilter('NAIK')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedStatusFilter === 'NAIK'
                ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Naik</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter('TURUN')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedStatusFilter === 'TURUN'
                ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Turun</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter('STABIL')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedStatusFilter === 'STABIL'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Stabil</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter('KOSONG')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedStatusFilter === 'KOSONG'
                ? 'bg-slate-600 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 text-slate-600 border border-dashed border-slate-300 hover:bg-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Nihil / Kosong (-)</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold select-none">
                {/* No */}
                <th
                  onClick={() => handleSort('no')}
                  className="py-3 px-3 w-12 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan nomor urut"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'no' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`} />
                  </div>
                </th>

                {/* Komoditas & Kategori */}
                <th
                  onClick={() => handleSort('commodity')}
                  className="py-3 px-4 min-w-[200px] cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan nama komoditas"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Komoditas & Kategori</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'commodity' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`} />
                  </div>
                </th>
                
                {/* 4 Level Headers */}
                <th
                  onClick={() => handleSort('produsen_desa')}
                  className={`py-3 px-2 text-center min-w-[90px] cursor-pointer hover:bg-emerald-100/50 transition-colors ${
                    selectedPriceLevel === 'produsen_desa' ? 'bg-emerald-100/70 border-b-2 border-emerald-500' : ''
                  }`}
                  title="Klik untuk mengurutkan berdasarkan status Produsen Desa"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-700">
                    <Sprout className="w-3.5 h-3.5" />
                    <span>1. Prod. Desa</span>
                    <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === 'produsen_desa' ? 'text-emerald-900 font-bold' : 'text-emerald-400'}`} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('konsumen_desa')}
                  className={`py-3 px-2 text-center min-w-[90px] cursor-pointer hover:bg-amber-100/50 transition-colors ${
                    selectedPriceLevel === 'konsumen_desa' ? 'bg-amber-100/70 border-b-2 border-amber-500' : ''
                  }`}
                  title="Klik untuk mengurutkan berdasarkan status Konsumen Desa"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-700">
                    <Home className="w-3.5 h-3.5" />
                    <span>2. Kons. Desa</span>
                    <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === 'konsumen_desa' ? 'text-amber-900 font-bold' : 'text-amber-400'}`} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('perdagangan_besar')}
                  className={`py-3 px-2 text-center min-w-[90px] cursor-pointer hover:bg-blue-100/50 transition-colors ${
                    selectedPriceLevel === 'perdagangan_besar' ? 'bg-blue-100/70 border-b-2 border-blue-500' : ''
                  }`}
                  title="Klik untuk mengurutkan berdasarkan status Perdagangan Besar"
                >
                  <div className="flex items-center justify-center gap-1 text-blue-700">
                    <Truck className="w-3.5 h-3.5" />
                    <span>3. Dagang Besar</span>
                    <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === 'perdagangan_besar' ? 'text-blue-900 font-bold' : 'text-blue-400'}`} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('konsumen')}
                  className={`py-3 px-2 text-center min-w-[90px] cursor-pointer hover:bg-rose-100/50 transition-colors ${
                    selectedPriceLevel === 'konsumen' ? 'bg-rose-100/70 border-b-2 border-rose-500' : ''
                  }`}
                  title="Klik untuk mengurutkan berdasarkan status Konsumen Eceran"
                >
                  <div className="flex items-center justify-center gap-1 text-rose-700">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>4. Konsumen</span>
                    <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === 'konsumen' ? 'text-rose-900 font-bold' : 'text-rose-400'}`} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('alignment')}
                  className="py-3 px-3 text-center min-w-[130px] cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan keselarasan transmisi 4 level"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Transmisi 4 Level</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'alignment' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`} />
                  </div>
                </th>

                <th className="py-3 px-3 text-center min-w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHarmonizations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Tidak ada komoditas yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredHarmonizations.map((item) => {
                  const pDesaBadge = getStatusBadgeStyle(item.produsenDesaOverall);
                  const kDesaBadge = getStatusBadgeStyle(item.konsumenDesaOverall);
                  const pbBadge = getStatusBadgeStyle(item.perdaganganBesarOverall);
                  const kBadge = getStatusBadgeStyle(item.konsumenOverall);
                  const isExpanded = expandedRowId === item.commodityId;

                  return (
                    <React.Fragment key={item.commodityId}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${
                          item.disparityWarning ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-medium text-slate-500">
                          {item.no}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 text-sm">{item.commodityName}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-slate-500">
                            <span>{item.category}</span>
                            {item.unit && <span className="text-slate-400">({item.unit})</span>}
                          </div>
                        </td>

                        {/* 1. Produsen Perdesaan */}
                        <td className={`py-3 px-2 text-center ${selectedPriceLevel === 'produsen_desa' ? 'bg-emerald-50/60' : ''}`}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${pDesaBadge.bg} ${pDesaBadge.border}`}
                          >
                            {pDesaBadge.label}
                          </span>
                        </td>

                        {/* 2. Konsumen Perdesaan */}
                        <td className={`py-3 px-2 text-center ${selectedPriceLevel === 'konsumen_desa' ? 'bg-amber-50/60' : ''}`}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${kDesaBadge.bg} ${kDesaBadge.border}`}
                          >
                            {kDesaBadge.label}
                          </span>
                        </td>

                        {/* 3. Perdagangan Besar */}
                        <td className={`py-3 px-2 text-center ${selectedPriceLevel === 'perdagangan_besar' ? 'bg-blue-50/60' : ''}`}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${pbBadge.bg} ${pbBadge.border}`}
                          >
                            {pbBadge.label}
                          </span>
                        </td>

                        {/* 4. Harga Konsumen */}
                        <td className={`py-3 px-2 text-center ${selectedPriceLevel === 'konsumen' ? 'bg-rose-50/60' : ''}`}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${kBadge.bg} ${kBadge.border}`}
                          >
                            {kBadge.label}
                          </span>
                        </td>

                        {/* Transmisi Status */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.overallAlignmentBadge.bg} ${item.overallAlignmentBadge.border}`}
                          >
                            {item.overallAlignmentLabel}
                          </span>
                          {item.disparityWarning && (
                            <div className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center justify-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Disparitas</span>
                            </div>
                          )}
                        </td>

                        {/* Action column: Hanya menampilkan Detail Wilayah */}
                        <td className="py-3 px-3 text-center">
                          <button
                            id={`btn-expand-region-levels-${item.commodityId}`}
                            onClick={() => setExpandedRowId(isExpanded ? null : item.commodityId)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1 cursor-pointer mx-auto shadow-2xs ${
                              isExpanded
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                            title="Tampilkan rincian transmisi 4 level per kabupaten/kota"
                          >
                            <span>Detail Wilayah</span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable row for 4-Level regional breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-300">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                              {/* Header & Narrative */}
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3.5 border-b border-slate-200 gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md uppercase tracking-wider">
                                      Detail Wilayah 4 Level
                                    </span>
                                    <h4 className="font-bold text-slate-900 text-base">
                                      {item.commodityName}
                                    </h4>
                                    <span className="text-xs text-slate-500 font-medium">
                                      • Periode {currentDataset.monthLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{item.transmissionNarrative}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                                    <span className="text-slate-500">Tingkat Keselarasan:</span>
                                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      {item.alignmentRate}%
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setExpandedRowId(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Tutup Detail Wilayah"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Filter Controls Bar: Filter Status & Search */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 pb-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
                                    <Filter className="w-3.5 h-3.5" /> Filter:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setDetailFilterMode('all')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                      detailFilterMode === 'all'
                                        ? 'bg-slate-800 text-white font-semibold'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    Semua (14)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailFilterMode('selaras')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                      detailFilterMode === 'selaras'
                                        ? 'bg-emerald-700 text-white font-semibold'
                                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Hanya Selaras
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailFilterMode('perbedaan')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                      detailFilterMode === 'perbedaan'
                                        ? 'bg-amber-600 text-white font-semibold'
                                        : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                                    }`}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Terdapat Perbedaan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailFilterMode('nihil')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                      detailFilterMode === 'nihil'
                                        ? 'bg-slate-600 text-white font-semibold'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    Nihil
                                  </button>
                                </div>

                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="text"
                                    value={detailSearchQuery}
                                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                                    placeholder="Cari kab/kota..."
                                    className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg w-40 sm:w-52 focus:outline-emerald-600 focus:bg-white transition-colors"
                                  />
                                  {detailSearchQuery && (
                                    <button
                                      onClick={() => setDetailSearchQuery('')}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Filtered Regional List Table */}
                              {(() => {
                                const filteredBreakdown = item.regionalBreakdown.filter((rb) => {
                                  const isSelaras =
                                    rb.hasCommodity &&
                                    (rb.alignment === 'SELARAS_NAIK' ||
                                      rb.alignment === 'SELARAS_TURUN' ||
                                      rb.alignment === 'SELARAS_STABIL');
                                  const isPerbedaan = rb.hasCommodity && !isSelaras;
                                  const isNihil = !rb.hasCommodity || rb.alignment === 'NIHIL';

                                  if (detailFilterMode === 'selaras' && !isSelaras) return false;
                                  if (detailFilterMode === 'perbedaan' && !isPerbedaan) return false;
                                  if (detailFilterMode === 'nihil' && !isNihil) return false;

                                  if (detailSearchQuery.trim()) {
                                    return rb.regionName
                                      .toLowerCase()
                                      .includes(detailSearchQuery.toLowerCase().trim());
                                  }
                                  return true;
                                });

                                if (filteredBreakdown.length === 0) {
                                  return (
                                    <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                                      Tidak ada wilayah yang cocok dengan filter atau kata kunci pencarian.
                                    </div>
                                  );
                                }

                                return (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                                          <th className="py-2.5 px-3 min-w-[140px]">Kabupaten / Kota</th>
                                          <th className="py-2.5 px-3 min-w-[160px] text-center">
                                            Status Keselarasan
                                          </th>
                                          <th className="py-2.5 px-2 text-center w-24">1. Produsen Desa</th>
                                          <th className="py-2.5 px-2 text-center w-24">2. Konsumen Desa</th>
                                          <th className="py-2.5 px-2 text-center w-24">3. Dg. Besar</th>
                                          <th className="py-2.5 px-2 text-center w-24">4. Konsumen</th>
                                          <th className="py-2.5 px-3 min-w-[280px]">
                                            <span className="flex items-center gap-1.5 text-emerald-900 font-bold">
                                              <Edit3 className="w-3.5 h-3.5" />
                                              Catatan Dinamis
                                            </span>
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200">
                                        {filteredBreakdown.map((rb, idx) => {
                                          const noteKey = `${item.commodityId}_${rb.regionId}`;
                                          const currentNoteValue =
                                            draftNotes[noteKey] !== undefined
                                              ? draftNotes[noteKey]
                                              : regionalNotes[noteKey] || '';
                                          const isSaved = savingStatus[noteKey];

                                          const isSelaras =
                                            rb.hasCommodity &&
                                            (rb.alignment === 'SELARAS_NAIK' ||
                                              rb.alignment === 'SELARAS_TURUN' ||
                                              rb.alignment === 'SELARAS_STABIL');

                                          const rbPDesa = getStatusBadgeStyle(rb.produsenDesa);
                                          const rbKDesa = getStatusBadgeStyle(rb.konsumenDesa);
                                          const rbPB = getStatusBadgeStyle(rb.perdaganganBesar);
                                          const rbK = getStatusBadgeStyle(rb.konsumen);

                                          return (
                                            <tr
                                              key={rb.regionId}
                                              className={`transition-colors ${
                                                !rb.hasCommodity
                                                  ? 'bg-slate-50/60 text-slate-400'
                                                  : isSelaras
                                                  ? 'hover:bg-emerald-50/40'
                                                  : 'hover:bg-amber-50/40 bg-amber-50/15'
                                              }`}
                                            >
                                              {/* No */}
                                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                                                {idx + 1}
                                              </td>

                                              {/* Region Name */}
                                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                {rb.regionName}
                                              </td>

                                              {/* Status Keselarasan */}
                                              <td className="py-2.5 px-3 text-center">
                                                {!rb.hasCommodity ? (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 font-mono">
                                                    Nihil / Non-Komoditas
                                                  </span>
                                                ) : isSelaras ? (
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>Selaras ({rb.alignmentLabel.replace('Selaras ', '')})</span>
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                    <span>Perbedaan ({rb.alignmentLabel.split(' ')[0]})</span>
                                                  </span>
                                                )}
                                              </td>

                                              {/* 1. Produsen Desa */}
                                              <td className="py-2.5 px-2 text-center">
                                                <span
                                                  className={`inline-block w-full px-1.5 py-0.5 rounded text-[11px] font-bold border ${rbPDesa.bg} ${rbPDesa.text} ${rbPDesa.border}`}
                                                >
                                                  {rbPDesa.label}
                                                </span>
                                              </td>

                                              {/* 2. Konsumen Desa */}
                                              <td className="py-2.5 px-2 text-center">
                                                <span
                                                  className={`inline-block w-full px-1.5 py-0.5 rounded text-[11px] font-bold border ${rbKDesa.bg} ${rbKDesa.text} ${rbKDesa.border}`}
                                                >
                                                  {rbKDesa.label}
                                                </span>
                                              </td>

                                              {/* 3. Perdagangan Besar */}
                                              <td className="py-2.5 px-2 text-center">
                                                <span
                                                  className={`inline-block w-full px-1.5 py-0.5 rounded text-[11px] font-bold border ${rbPB.bg} ${rbPB.text} ${rbPB.border}`}
                                                >
                                                  {rbPB.label}
                                                </span>
                                              </td>

                                              {/* 4. Konsumen */}
                                              <td className="py-2.5 px-2 text-center">
                                                <span
                                                  className={`inline-block w-full px-1.5 py-0.5 rounded text-[11px] font-bold border ${rbK.bg} ${rbK.text} ${rbK.border}`}
                                                >
                                                  {rbK.label}
                                                </span>
                                              </td>

                                              {/* Kolom Catatan Dinamis */}
                                              <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="text"
                                                    value={currentNoteValue}
                                                    placeholder="Tulis catatan TPID/wilayah..."
                                                    onChange={(e) => {
                                                      const val = e.target.value;
                                                      setDraftNotes((prev) => ({
                                                        ...prev,
                                                        [noteKey]: val,
                                                      }));
                                                    }}
                                                    onBlur={() => {
                                                      if (
                                                        draftNotes[noteKey] !== undefined &&
                                                        draftNotes[noteKey] !== (regionalNotes[noteKey] || '')
                                                      ) {
                                                        handleSaveNote(
                                                          item.commodityId,
                                                          rb.regionId,
                                                          draftNotes[noteKey]
                                                        );
                                                      }
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        handleSaveNote(
                                                          item.commodityId,
                                                          rb.regionId,
                                                          currentNoteValue
                                                        );
                                                      }
                                                    }}
                                                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-300 shadow-2xs"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleSaveNote(
                                                        item.commodityId,
                                                        rb.regionId,
                                                        currentNoteValue
                                                      )
                                                    }
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                                                      isSaved
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-100 hover:bg-emerald-700 hover:text-white text-slate-700 border border-slate-200'
                                                    }`}
                                                    title="Simpan Catatan ke Server"
                                                  >
                                                    {isSaved ? (
                                                      <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Tersimpan</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Save className="w-3.5 h-3.5" />
                                                        <span>Simpan</span>
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
