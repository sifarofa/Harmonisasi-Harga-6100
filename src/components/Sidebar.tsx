import React, { useState } from 'react';
import {
  TrendingUp,
  Layers,
  BarChart3,
  FileSpreadsheet,
  Coins,
  Store,
  Shield,
  Lock,
  RefreshCw,
  Maximize,
  Minimize,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Upload,
  Download,
  LayoutGrid,
  Columns3,
  Sparkles,
  Database,
  ExternalLink,
  Building2,
  Edit3,
  MapPin,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { MonthlyHarmonizationDataset, AuthUser } from '../types';
import { TabType } from './Navbar';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  hpbsSubTab?: 'agregat_kalbar' | 'matriks_wilayah' | 'responden_detail' | 'series_stabilitas';
  onSelectHpbsSubTab?: (subTab: 'agregat_kalbar' | 'matriks_wilayah' | 'responden_detail' | 'series_stabilitas') => void;
  datasets: MonthlyHarmonizationDataset[];
  isOwner: boolean;
  ownerEmail?: string;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
  onOpenOwnerAuth: (actionName?: string) => void;
  onLogoutOwner: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hasNewVersion?: boolean;
  onForceRefresh?: () => void;
  navOrientation: 'vertical' | 'horizontal';
  onToggleOrientation: () => void;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  hpbsSubTab = 'agregat_kalbar',
  onSelectHpbsSubTab,
  datasets,
  isOwner,
  ownerEmail = 'sifarofatunnisa24@gmail.com',
  authUser,
  onLogout,
  onOpenUserManagement,
  onOpenOwnerAuth,
  onLogoutOwner,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  hasNewVersion = false,
  onForceRefresh,
  navOrientation,
  onToggleOrientation,
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
}) => {
  const [isHarmonisasiExpanded, setIsHarmonisasiExpanded] = useState<boolean>(true);
  const [isHpbsExpanded, setIsHpbsExpanded] = useState<boolean>(true);

  const isHarmonisasiActive =
    activeTab === 'price_levels' || activeTab === 'overview' || activeTab === 'grid';

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const handleHarmonisasiParentClick = () => {
    if (!isHarmonisasiActive) {
      handleSelectTab('price_levels');
      setIsHarmonisasiExpanded(true);
    } else {
      setIsHarmonisasiExpanded(!isHarmonisasiExpanded);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container (Permanently Fixed Wide Layout) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-200 flex flex-col h-screen select-none transition-transform duration-300 ease-in-out ${
          /* Mobile classes */
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 w-72 shadow-xl lg:shadow-none`}
      >
        {/* 1. Header & Branding */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-base tracking-tight truncate">
                  SEHARGA
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  BPS Kalbar
                </span>
              </div>
            </div>
          </div>

          {/* Close button for Mobile only */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Vertical Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 no-scrollbar">
          {/* Main Navigation Section */}
          <div className="space-y-1.5">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Menu Utama
            </div>

            {/* ============================================================== */}
            {/* MENU 1: HARMONISASI HARGA (dengan 3 Submenu) */}
            {/* ============================================================== */}
            <div className="rounded-xl overflow-hidden">
              <button
                type="button"
                id="vert-tab-harmonisasi"
                onClick={handleHarmonisasiParentClick}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isHarmonisasiActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Harmonisasi Harga"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Layers
                    className={`w-4 h-4 shrink-0 ${
                      isHarmonisasiActive ? 'text-white' : 'text-emerald-700'
                    }`}
                  />
                  <span className="truncate">Harmonisasi Harga</span>
                </div>

                <div className="flex items-center">
                  {isHarmonisasiExpanded ? (
                    <ChevronDown
                      className={`w-3.5 h-3.5 ${
                        isHarmonisasiActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  ) : (
                    <ChevronRight
                      className={`w-3.5 h-3.5 ${
                        isHarmonisasiActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  )}
                </div>
              </button>

              {/* Submenu Harmonisasi Harga (Vertikal Tree) */}
              {isHarmonisasiExpanded && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-emerald-200 space-y-1 py-1">
                  {/* Submenu 1: Harmonisasi 4 Level Harga */}
                  <button
                    type="button"
                    id="vert-subtab-price-levels"
                    onClick={() => handleSelectTab('price_levels')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      activeTab === 'price_levels'
                        ? 'bg-emerald-100/80 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="truncate">Harmonisasi 4 Level</span>
                  </button>

                  {/* Submenu 2: Ringkasan & Fluktuasi */}
                  <button
                    type="button"
                    id="vert-subtab-overview"
                    onClick={() => handleSelectTab('overview')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-emerald-100/80 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Ringkasan &amp; Fluktuasi</span>
                  </button>

                  {/* Submenu 3: Tabel Harmonisasi Wilayah */}
                  <button
                    type="button"
                    id="vert-subtab-grid"
                    onClick={() => handleSelectTab('grid')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      activeTab === 'grid'
                        ? 'bg-emerald-100/80 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Tabel Wilayah</span>
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* MENU 2: ANALISIS RH STABIL IHK */}
            {/* ============================================================== */}
            <button
              type="button"
              id="vert-tab-ihk"
              onClick={() => handleSelectTab('ihk_consumer')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ihk_consumer'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Analisis RH Stabil IHK"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Coins
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === 'ihk_consumer'
                      ? 'text-amber-300'
                      : 'text-amber-600'
                  }`}
                />
                <span className="truncate">Analisis RH Stabil IHK</span>
              </div>
            </button>

            {/* ============================================================== */}
            {/* MENU 3: ANALISIS RH SHPB (DENGAN SUB-MENU VERTIKAL) */}
            {/* ============================================================== */}
            <div className="space-y-1">
              <button
                type="button"
                id="vert-tab-hpbs"
                onClick={() => {
                  if (activeTab === 'hpbs_rh') {
                    setIsHpbsExpanded(!isHpbsExpanded);
                  } else {
                    handleSelectTab('hpbs_rh');
                    setIsHpbsExpanded(true);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'hpbs_rh'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Analisis RH SHPB"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Store
                    className={`w-4 h-4 shrink-0 ${
                      activeTab === 'hpbs_rh'
                        ? 'text-purple-200'
                        : 'text-purple-600'
                    }`}
                  />
                  <span className="truncate">Analisis RH SHPB</span>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isHpbsExpanded && activeTab === 'hpbs_rh'
                      ? 'rotate-180 text-white'
                      : activeTab === 'hpbs_rh'
                      ? 'text-white/80'
                      : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Sub-menu Vertikal Analisis RH SHPB */}
              {isHpbsExpanded && activeTab === 'hpbs_rh' && (
                <div className="pl-3.5 pr-1 py-1 space-y-1 border-l-2 border-emerald-300 ml-4 my-1">
                  {/* Submenu 1: Agregat Se-Kalbar */}
                  <button
                    type="button"
                    id="vert-subtab-hpbs-agregat"
                    onClick={() => {
                      onSelectHpbsSubTab?.('agregat_kalbar');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      hpbsSubTab === 'agregat_kalbar' || !hpbsSubTab
                        ? 'bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="truncate">Agregat Se-Kalbar</span>
                  </button>

                  {/* Submenu 2: Matriks 14 Kab/Kota */}
                  <button
                    type="button"
                    id="vert-subtab-hpbs-matriks"
                    onClick={() => {
                      onSelectHpbsSubTab?.('matriks_wilayah');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      hpbsSubTab === 'matriks_wilayah'
                        ? 'bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Matriks 14 Kab/Kota</span>
                  </button>

                  {/* Submenu 3: Detail Responden & Perbaikan */}
                  <button
                    type="button"
                    id="vert-subtab-hpbs-detail"
                    onClick={() => {
                      onSelectHpbsSubTab?.('responden_detail');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      hpbsSubTab === 'responden_detail'
                        ? 'bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Detail Responden</span>
                  </button>

                  {/* Submenu 4: Series Bulanan & Stabilitas RH */}
                  <button
                    type="button"
                    id="vert-subtab-hpbs-series"
                    onClick={() => {
                      onSelectHpbsSubTab?.('series_stabilitas');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      hpbsSubTab === 'series_stabilitas'
                        ? 'bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">Series Bulanan &amp; Stabilitas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Bottom Footer & Controls */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
          {/* Active Institutional Portal Account */}
          {authUser && (
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs border border-slate-800 text-xs">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 truncate">
                  {authUser.role === 'admin_provinsi' ? (
                    <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{authUser.regionName}</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-emerald-300 font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                  {authUser.regionCode}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mb-2">
                {authUser.role === 'admin_provinsi' ? 'Otoritas Seluruh 14 Kab/Kota' : authUser.agencyName}
              </p>
              <div className="space-y-1.5">
                {onOpenUserManagement && (
                  <button
                    type="button"
                    id="sidebar-btn-users"
                    onClick={onOpenUserManagement}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-100 border border-slate-700 hover:border-emerald-700/60 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title={authUser.role === 'admin_provinsi' ? 'Kelola Pengguna Wilayah di Supabase' : 'Ubah Kata Sandi / Token Wilayah'}
                  >
                    <KeyRound className="w-3 h-3 text-emerald-400" />
                    <span>{authUser.role === 'admin_provinsi' ? 'Kelola User Wilayah' : 'Ganti Kata Sandi'}</span>
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    id="sidebar-btn-logout"
                    onClick={onLogout}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 hover:border-rose-700/60 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Ganti akun instansi atau keluar ke portal utama"
                  >
                    <LogOut className="w-3 h-3 text-rose-400" />
                    <span>Ganti Akun Wilayah</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Owner Status / Login */}
          {isOwner ? (
            <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate text-left">
                  <p className="font-bold text-emerald-900 leading-tight">
                    Owner Aktif
                  </p>
                  <p
                    className="text-[10px] text-emerald-700 truncate max-w-[140px]"
                    title={ownerEmail}
                  >
                    {ownerEmail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogoutOwner}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                title="Keluar dari mode owner"
              >
                Keluar
              </button>
            </div>
          ) : !authUser || authUser.role !== 'admin_provinsi' ? (
            <button
              type="button"
              onClick={() => onOpenOwnerAuth('Login Owner')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer"
              title="Login Owner untuk kelola database"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Login Owner</span>
            </button>
          ) : null}

          {/* Bottom Tool Icons (Fullscreen, Sync) */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Tampilan Layar Penuh'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>

            {hasNewVersion && (
              <button
                type="button"
                onClick={onForceRefresh}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg animate-pulse transition-colors cursor-pointer"
                title="Pembaruan data tersedia! Klik untuk memuat ulang"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sinkronkan</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
