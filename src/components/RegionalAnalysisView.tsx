import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  MapPin,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MonthlyHarmonizationDataset, PriceLevel, PriceStatus, RegionInfo } from '../types';
import { computeCommoditySeries, getStatusBadgeStyle, isRegionSampleForLevel } from '../utils/analysis';

interface RegionalAnalysisViewProps {
  datasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  selectedMonthId: string;
  selectedPriceLevel?: PriceLevel | 'all';
  setSelectedPriceLevel?: (level: PriceLevel | 'all') => void;
  onSelectRegion: (regionId: string) => void;
  onSelectCommodity: (commodityId: string) => void;
}

export const RegionalAnalysisView: React.FC<RegionalAnalysisViewProps> = ({
  datasets,
  regions,
  selectedMonthId,
  selectedPriceLevel = 'all',
  setSelectedPriceLevel,
  onSelectRegion,
  onSelectCommodity,
}) => {
  const [activeTab, setActiveTab] = useState<'ranking' | 'monthly_snapshot'>('ranking');

  // Compute aggregate statistics per region across all months based on selected price level
  const regionalStats = useMemo(() => {
    const sampleRegions = regions.filter((reg) => isRegionSampleForLevel(reg, selectedPriceLevel));
    return sampleRegions.map((reg) => {
      let totalObservations = 0;
      let totalNaik = 0;
      let totalTurun = 0;
      let totalStabil = 0;
      let totalNetral = 0;

      // Track volatile items in this region
      const commodityVolatility: Record<string, { name: string; naik: number; turun: number; stabil: number }> = {};

      datasets.forEach((dataset) => {
        dataset.commodities.forEach((comm) => {
          const regData = comm.regions?.[reg.id];
          
          let st: PriceStatus = 'KOSONG';
          if (selectedPriceLevel === 'produsen_desa') {
            st = regData?.produsenDesaStatus || regData?.produsenStatus || 'KOSONG';
          } else if (selectedPriceLevel === 'konsumen_desa') {
            st = regData?.konsumenDesaStatus || 'KOSONG';
          } else if (selectedPriceLevel === 'perdagangan_besar') {
            st = regData?.perdaganganBesarStatus || regData?.grosirStatus || 'KOSONG';
          } else if (selectedPriceLevel === 'konsumen') {
            st = regData?.konsumenStatus || regData?.status || 'KOSONG';
          } else {
            st = regData?.status || 'KOSONG';
          }

          if (!commodityVolatility[comm.id]) {
            commodityVolatility[comm.id] = { name: comm.name, naik: 0, turun: 0, stabil: 0 };
          }

          if (st === 'NAIK') {
            totalObservations++;
            totalNaik++;
            commodityVolatility[comm.id].naik++;
          } else if (st === 'TURUN') {
            totalObservations++;
            totalTurun++;
            commodityVolatility[comm.id].turun++;
          } else if (st === 'STABIL') {
            totalObservations++;
            totalStabil++;
            commodityVolatility[comm.id].stabil++;
          } else {
            totalNetral++;
          }
        });
      });

      const activeChanges = totalNaik + totalTurun;
      const stabilityRate = totalObservations > 0 ? Math.round((totalStabil / totalObservations) * 100) : 0;
      const volatilityRate = totalObservations > 0 ? Math.round((activeChanges / totalObservations) * 100) : 0;

      // Top volatile commodities in this region
      const topVolatileItems = Object.entries(commodityVolatility)
        .map(([id, data]) => ({
          id,
          name: data.name,
          changes: data.naik + data.turun,
          naik: data.naik,
          turun: data.turun,
        }))
        .sort((a, b) => b.changes - a.changes)
        .slice(0, 3);

      return {
        id: reg.id,
        name: reg.name,
        type: reg.type,
        code: reg.code,
        totalObservations,
        totalNaik,
        totalTurun,
        totalStabil,
        totalNetral,
        stabilityRate,
        volatilityRate,
        topVolatileItems,
      };
    });
  }, [datasets, regions, selectedPriceLevel]);

  // Chart data for comparing regions
  const regionalChartData = useMemo(() => {
    return regionalStats.map((r) => ({
      name: r.name,
      'Total Naik': r.totalNaik,
      'Total Turun': r.totalTurun,
      'Total Stabil': r.totalStabil,
      stabilityRate: r.stabilityRate,
    }));
  }, [regionalStats]);

  // Sort regions by highest volatility
  const sortedByVolatility = useMemo(() => {
    return [...regionalStats].sort((a, b) => b.totalNaik - a.totalNaik);
  }, [regionalStats]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>Analisis Perbandingan Antar Kabupaten/Kota</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemetaan stabilitas harga dan komoditas pemicu gejolak di masing-masing daerah Kalimantan Barat
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            <span className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-lg">
              {regions.length} Wilayah
            </span>
          </div>
        </div>
      </div>

      {/* Regional Comparison Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Perbandingan Akumulasi Status Harga Antar Wilayah
            </h3>
            <p className="text-xs text-slate-500">
              Total frekuensi status Naik, Turun, dan Stabil pada seluruh komoditas sepanjang time series
            </p>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionalChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                angle={-25}
                textAnchor="end"
                height={45}
                axisLine={false}
                tickLine={false}
              />
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
              <Bar dataKey="Total Naik" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Total Turun" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Total Stabil" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regional Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedByVolatility.map((r) => (
          <div
            key={r.id}
            className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {r.code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{r.name}</h4>
                  <p className="text-[11px] text-slate-500">{r.type}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    {r.stabilityRate}% Stabil
                  </span>
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-100">
                  <span className="text-xs font-bold text-rose-700">{r.totalNaik}</span>
                  <p className="text-[10px] text-rose-600 font-medium">Naik</p>
                </div>
                <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                  <span className="text-xs font-bold text-blue-700">{r.totalTurun}</span>
                  <p className="text-[10px] text-blue-600 font-medium">Turun</p>
                </div>
                <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-700">{r.totalStabil}</span>
                  <p className="text-[10px] text-emerald-600 font-medium">Stabil</p>
                </div>
              </div>

              {/* Top Volatile Items in this region */}
              <div className="mt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pemicu Fluktuasi Terbanyak:
                </span>
                <div className="space-y-1.5 mt-1.5">
                  {r.topVolatileItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectCommodity(item.id)}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                    >
                      <span className="font-medium truncate max-w-[170px]">{item.name}</span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {item.naik}N • {item.turun}T
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => onSelectRegion(r.id)}
              className="mt-4 w-full py-1.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Lihat Rekap {r.name}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
