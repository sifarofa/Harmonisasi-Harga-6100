import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  Coins,
  Columns3,
  Database,
  Download,
  Factory,
  FileSpreadsheet,
  Grid,
  Layers,
  Lock,
  MapPin,
  Maximize,
  Minimize,
  Plus,
  RefreshCw,
  Shield,
  Store,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { MonthlyHarmonizationDataset, PriceLevel, RegionInfo } from '../types';

export type TabType = 'price_levels' | 'overview' | 'grid' | 'ihk_consumer' | 'hpbs_rh';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  datasets: MonthlyHarmonizationDataset[];
  selectedMonthId: string;
  setSelectedMonthId: (id: string) => void;
  selectedRegionId: string;
  setSelectedRegionId: (id: string) => void;
  selectedPriceLevel: PriceLevel | 'all';
  setSelectedPriceLevel: (level: PriceLevel | 'all') => void;
  regions: RegionInfo[];
  isOwner: boolean;
  ownerEmail?: string;
  onOpenOwnerAuth: (actionName?: string) => void;
  onLogoutOwner: () => void;
  onOpenAddMonth: () => void;
  onOpenImport: () => void;
  onOpenManage: () => void;
  onExportExcel: () => void;
  onResetData: () => void;
  onOpenIhkFileManager?: (tab?: 'import' | 'template' | 'export' | 'manage') => void;
  onOpenHpbsImport?: () => void;
  onExportHpbs?: () => void;
  onDownloadHpbsTemplate?: () => void;
  onResetHpbs?: () => void;
  hasNewVersion?: boolean;
  onForceRefresh?: () => void;
  onToggleOrientation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  datasets,
  selectedMonthId,
  setSelectedMonthId,
  selectedRegionId,
  setSelectedRegionId,
  selectedPriceLevel,
  setSelectedPriceLevel,
  regions,
  isOwner,
  ownerEmail = 'sifarofatunnisa24@gmail.com',
  onOpenOwnerAuth,
  onLogoutOwner,
  onOpenAddMonth,
  onOpenImport,
  onOpenManage,
  onExportExcel,
  onResetData,
  onOpenIhkFileManager,
  onOpenHpbsImport,
  onExportHpbs,
  onDownloadHpbsTemplate,
  onResetHpbs,
  hasNewVersion = false,
  onForceRefresh,
  onToggleOrientation,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Layar penuh tidak dapat dibuka otomatis:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Gagal keluar layar penuh:', err);
        });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Top bar with branding & global actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-baseline gap-1.5">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    SEHARGA
                  </h1>
                  <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                    — {activeTab === 'hpbs_rh'
                      ? 'Relatif Harga (V-HPBS / SHPB)'
                      : activeTab === 'ihk_consumer'
                      ? 'IHK & Inflasi Konsumen (BPS)'
                      : 'Harmonisasi Komoditas Bulanan'}
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200"
                  title="Badan Pusat Statistik Provinsi Kalimantan Barat"
                >
                  BPS KALBAR
                </span>
                <span
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200"
                  title="Data yang diunggah langsung tersinkronisasi dan terpublikasi ke server secara live untuk seluruh pengunjung"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Terbit
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                {activeTab === 'hpbs_rh'
                  ? 'Survei Harga Perdagangan Besar Sektoral (V-HPBS.1 Bulanan & V-HPBS.2 Mingguan) 14 Kab/Kota se-Kalbar'
                  : activeTab === 'ihk_consumer'
                  ? 'Indeks Harga Konsumen 5 Kota IHK Kalimantan Barat & Series Inflasi (m-to-m, y-on-y, y-to-d)'
                  : 'Pemantauan Transmisi 4 Tingkat Harga (Produsen Desa, Konsumen Desa, Perdagangan Besar, Konsumen) & series fluktuasi'}
              </p>
            </div>
          </div>

          {/* Action buttons with Owner Access Protection */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Owner status pill or login button */}
            {isOwner ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 shadow-2xs">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden xl:inline">Owner: {ownerEmail}</span>
                <span className="xl:hidden">Owner</span>
                <button
                  onClick={onLogoutOwner}
                  title="Keluar dari sesi Owner"
                  className="ml-1 text-[10px] text-slate-500 hover:text-rose-600 font-normal hover:underline cursor-pointer"
                >
                  (Keluar)
                </button>
              </div>
            ) : (
              <button
                id="btn-login-owner"
                onClick={() => onOpenOwnerAuth()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Masuk sebagai Owner untuk mengelola data, import, dan menambah bulan"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Akses Owner</span>
              </button>
            )}

            {/* Action button: Single Door (Satu Pintu) based on active tab */}
            {activeTab === 'ihk_consumer' ? (
              <button
                id="btn-ihk-single-door-navbar"
                onClick={() => onOpenIhkFileManager?.('import')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Pusat Satu Pintu Kelola Data IHK: Upload File Excel, Unduh Template Resmi, Ekspor Excel, dan Status Data"
              >
                <Database className="w-3.5 h-3.5 text-emerald-200" />
                <span>Kelola Data IHK (Satu Pintu)</span>
              </button>
            ) : activeTab === 'hpbs_rh' ? (
              <button
                id="btn-hpbs-single-door-navbar"
                onClick={onOpenHpbsImport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Pusat Satu Pintu Kelola Data SHPB: Upload Excel V-HPBS, Tambah Bulan, Template Excel, Ekspor, dan Status Periode"
              >
                <Database className="w-3.5 h-3.5 text-emerald-200" />
                <span>Kelola Data SHPB (Satu Pintu)</span>
              </button>
            ) : (
              <button
                id="btn-harmonisasi-single-door-navbar"
                onClick={() => {
                  if (isOwner) onOpenManage();
                  else onOpenOwnerAuth('Kelola Data Harmonisasi');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Pusat Satu Pintu Kelola Data Harmonisasi: Upload File Excel, Tambah Bulan, Unduh Template, Ekspor Excel, dan Hapus Data"
              >
                <Database className="w-3.5 h-3.5 text-emerald-200" />
                <span>Kelola Data Harmonisasi ({datasets.length} Bulan)</span>
                {!isOwner && <Lock className="w-3 h-3 text-emerald-200 ml-0.5" />}
              </button>
            )}

            {/* Tombol Perbarui Fitur & Sync (Force Reload untuk semua device) */}
            <button
              id="btn-force-refresh-app"
              type="button"
              onClick={onForceRefresh}
              title={
                hasNewVersion
                  ? 'Versi fitur terbaru tersedia! Klik untuk memuat ulang sekarang'
                  : 'Periksa & terapkan pembaruan fitur terbaru di perangkat ini'
              }
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                hasNewVersion
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse ring-2 ring-amber-300'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${hasNewVersion ? 'animate-spin text-white' : 'text-emerald-600'}`} />
              <span className="inline">{hasNewVersion ? 'Fitur Baru!' : 'Sync'}</span>
            </button>

            {/* Tombol Toggle Tata Letak (Horizontal / Vertikal) */}
            {onToggleOrientation && (
              <button
                type="button"
                id="btn-toggle-to-vertical"
                onClick={onToggleOrientation}
                title="Ganti ke tata letak menu vertikal (Sidebar)"
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Columns3 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Menu Vertikal</span>
              </button>
            )}

            {/* Tombol Toggle Layar Penuh / Full Screen */}
            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Keluar Layar Penuh (ESC)" : "Layar Penuh (Full Screen)"}
              className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Normal</span>
                </>
              ) : (
                <>
                  <Maximize className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Layar Penuh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Main Menus: Harmonisasi Harga, Analisis RH Stabil IHK, Analisis RH SHPB */}
        {(() => {
          const isHarmonisasiActive =
            activeTab === 'price_levels' || activeTab === 'overview' || activeTab === 'grid';

          return (
            <>
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar border-t border-slate-100 pt-2 pb-1.5">
                {/* Menu 1: Harmonisasi Harga */}
                <button
                  id="tab-harmonisasi-harga"
                  onClick={() => {
                    if (!isHarmonisasiActive) {
                      setActiveTab('price_levels');
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    isHarmonisasiActive
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Harmonisasi Harga</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                      isHarmonisasiActive
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    3 Submenu
                  </span>
                </button>

                {/* Menu 2: Analisis RH Stabil IHK */}
                <button
                  id="tab-ihk-consumer"
                  onClick={() => setActiveTab('ihk_consumer')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'ihk_consumer'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Coins
                    className={`w-4 h-4 ${
                      activeTab === 'ihk_consumer' ? 'text-amber-300' : 'text-amber-600'
                    }`}
                  />
                  <span>Analisis RH Stabil IHK</span>
                </button>

                {/* Menu 3: Analisis RH SHPB */}
                <button
                  id="tab-hpbs-rh"
                  onClick={() => setActiveTab('hpbs_rh')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'hpbs_rh'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Store
                    className={`w-4 h-4 ${
                      activeTab === 'hpbs_rh' ? 'text-purple-200' : 'text-purple-600'
                    }`}
                  />
                  <span>Analisis RH SHPB</span>
                </button>
              </div>

              {/* Submenu Bar for Harmonisasi Harga */}
              {isHarmonisasiActive && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-2 bg-emerald-50/70 rounded-xl border border-emerald-200/80 mb-2 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider px-1.5 shrink-0">
                    Submenu Harmonisasi:
                  </span>

                  <button
                    id="subtab-price-levels"
                    onClick={() => setActiveTab('price_levels')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === 'price_levels'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 ring-1 ring-emerald-400/40'
                        : 'text-emerald-800 hover:text-emerald-950 hover:bg-white/70'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Harmonisasi 4 Level Harga</span>
                  </button>

                  <button
                    id="subtab-overview"
                    onClick={() => setActiveTab('overview')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 ring-1 ring-emerald-400/40'
                        : 'text-emerald-800 hover:text-emerald-950 hover:bg-white/70'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ringkasan &amp; Fluktuasi</span>
                  </button>

                  <button
                    id="subtab-grid"
                    onClick={() => setActiveTab('grid')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === 'grid'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 ring-1 ring-emerald-400/40'
                        : 'text-emerald-800 hover:text-emerald-950 hover:bg-white/70'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tabel Harmonisasi Wilayah</span>
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </header>
  );
};
