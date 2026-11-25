import React, { useEffect, useState } from 'react';
import {
  Menu,
  Maximize,
  Minimize,
  RefreshCw,
  Shield,
  Lock,
  Download,
  Upload,
  Plus,
  FileSpreadsheet,
  Columns3,
  Layers,
  Coins,
  Store,
  Database,
  ExternalLink,
  Building2,
  MapPin,
  LogOut,
  Users,
  KeyRound,
} from 'lucide-react';
import { MonthlyHarmonizationDataset, AuthUser } from '../types';
import { TabType } from './Navbar';

interface TopHeaderProps {
  activeTab: TabType;
  datasets: MonthlyHarmonizationDataset[];
  isOwner: boolean;
  ownerEmail?: string;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenOwnerAuth: (actionName?: string) => void;
  onLogoutOwner: () => void;
  onToggleSidebarMobile: () => void;
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
  hasNewVersion?: boolean;
  onForceRefresh?: () => void;
  onOpenBackupModal?: () => void;
  onOpenUserManagement?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'error' | 'offline';
  syncMessage?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  datasets,
  isOwner,
  ownerEmail = 'sifarofatunnisa24@gmail.com',
  authUser,
  onLogout,
  onOpenUserManagement,
  onOpenOwnerAuth,
  onLogoutOwner,
  onToggleSidebarMobile,
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
  hasNewVersion = false,
  onForceRefresh,
  onOpenBackupModal,
  syncStatus = 'synced',
  syncMessage,
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
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const getBreadcrumb = () => {
    if (activeTab === 'ihk_consumer') {
      return {
        parent: 'Analisis RH Stabil IHK',
        title: 'IHK Konsumen (5 Kota IHK Kalbar)',
        icon: Coins,
        iconColor: 'text-amber-600',
      };
    }
    if (activeTab === 'hpbs_rh') {
      return {
        parent: 'Analisis RH SHPB',
        title: 'Relatif Harga Komoditas Pedagang (V-HPBS)',
        icon: Store,
        iconColor: 'text-purple-600',
      };
    }
    if (activeTab === 'overview') {
      return {
        parent: 'Harmonisasi Harga',
        title: 'Ringkasan & Fluktuasi 4 Level',
        icon: Layers,
        iconColor: 'text-emerald-700',
      };
    }
    if (activeTab === 'grid') {
      return {
        parent: 'Harmonisasi Harga',
        title: 'Tabel Harmonisasi Wilayah',
        icon: Layers,
        iconColor: 'text-emerald-700',
      };
    }
    return {
      parent: 'Harmonisasi Harga',
      title: 'Harmonisasi 4 Level Harga',
      icon: Layers,
      iconColor: 'text-emerald-700',
    };
  };

  const breadcrumb = getBreadcrumb();
  const Icon = breadcrumb.icon;

  const isSharedPreview =
    typeof window !== 'undefined' && window.location.hostname.includes('ais-pre-');
  const devAppUrl =
    typeof window !== 'undefined'
      ? window.location.origin.replace('ais-pre-', 'ais-dev-')
      : 'https://ais-dev-rezk5u3xpaz5nva23h2vm3-732382289280.asia-southeast1.run.app';

  return (
    <>
      {isSharedPreview && (
        <div
          id="shared-preview-alert"
          className="bg-amber-600 text-white px-3 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-amber-700"
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping shrink-0" />
            <span>
              <strong>Tautan Share (Snapshot)</strong>: Ingin perubahan fitur langsung muncul otomatis di HP tanpa perlu republish?
            </span>
          </div>
          <a
            href={devAppUrl}
            target="_top"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-950 font-bold text-xs rounded-lg shadow-xs hover:bg-amber-50 active:scale-95 transition-all"
          >
            <span>Buka Versi Live Dev (Auto-Update)</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-800" />
          </a>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-5 lg:px-8 py-2.5 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        {/* Left Side: Breadcrumb Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <Icon className={`w-4 h-4 ${breadcrumb.iconColor}`} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>{breadcrumb.parent}</span>
                <span>/</span>
                <span className="font-bold text-slate-800 truncate">
                  {breadcrumb.title}
                </span>
              </div>
            </div>
          </div>

          {authUser && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-semibold shrink-0">
              {authUser.role === 'admin_provinsi' ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-purple-950 font-bold">Admin Provinsi Kalbar</span>
                  <span className="text-[10px] bg-purple-200 text-purple-900 px-1 py-0.2 rounded font-mono font-bold">
                    {authUser.regionCode || '61.00'}
                  </span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-emerald-950">{authUser.regionName}</span>
                  <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1 py-0.2 rounded font-mono font-bold">
                    {authUser.regionCode}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-800">Supabase Cloud</span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-700 font-bold">Realtime</span>
          </div>
        </div>

        {/* Right Side: Tab Actions & Global Controls */}
        <div className="flex flex-wrap items-center gap-1.5 self-end md:self-auto">
          {/* Action button: Single Door based on current active tab */}
          {activeTab === 'ihk_consumer' ? (
            <button
              type="button"
              id="topheader-single-door-ihk"
              onClick={() => onOpenIhkFileManager?.('import')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Kelola Data IHK: Upload File Excel, Unduh Template, Ekspor Excel"
            >
              <Database className="w-3.5 h-3.5 text-emerald-200" />
              <span>Kelola Data IHK</span>
            </button>
          ) : activeTab === 'hpbs_rh' ? (
            <button
              type="button"
              id="topheader-single-door-hpbs"
              onClick={onOpenHpbsImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Kelola Data SHPB: Upload Excel V-HPBS, Tambah Bulan, Template Excel, Ekspor"
            >
              <Database className="w-3.5 h-3.5 text-emerald-200" />
              <span>Kelola Data SHPB</span>
            </button>
          ) : (
            <button
              type="button"
              id="topheader-single-door-harmonisasi"
              onClick={() => {
                if (isOwner) onOpenManage();
                else onOpenOwnerAuth('Kelola Data Harmonisasi');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Kelola Data Harmonisasi: Upload File Excel, Tambah Bulan, Unduh Template, Ekspor Excel"
            >
              <Database className="w-3.5 h-3.5 text-emerald-200" />
              <span>Kelola Data Harmonisasi</span>
            </button>
          )}

          {/* User Management Button for Admin Provinsi & Admin Kab/Kota */}
          {authUser && onOpenUserManagement && (
            <button
              type="button"
              id="topheader-btn-users"
              onClick={onOpenUserManagement}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 transition-colors cursor-pointer shadow-2xs"
              title={
                authUser.role === 'admin_provinsi'
                  ? 'Manajemen Pengguna Wilayah (14 Kab/Kota) di Supabase'
                  : 'Kelola Kata Sandi & Keamanan Akun Wilayah'
              }
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[11px] hidden sm:inline">
                {authUser.role === 'admin_provinsi' ? 'Kelola User' : 'Ganti Sandi'}
              </span>
            </button>
          )}

          {/* User Account Switcher / Logout Button */}
          {authUser && onLogout && (
            <button
              type="button"
              id="topheader-btn-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 transition-colors cursor-pointer shadow-2xs"
              title={`Ganti Akun Wilayah (Saat ini: ${authUser.regionName})`}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[11px] hidden sm:inline">Ganti Akun</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </button>

          {/* Backup & Persistent Storage Modal Button */}
          {onOpenBackupModal && (
            <button
              type="button"
              id="topheader-backup-btn"
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Cadangan & Pemulihan Data (IndexedDB Bebas Reset & File JSON)"
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[11px] hidden sm:inline">Cadangan</span>
            </button>
          )}

          {/* Supabase Centralized Real-time Sync Status Indicator */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold shadow-2xs select-none"
            title={syncMessage || 'Status sinkronisasi database terpusat Supabase Cloud'}
          >
            {syncStatus === 'syncing' ? (
              <span className="flex items-center gap-1.5 text-blue-700">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                <span>Menyinkronkan...</span>
              </span>
            ) : syncStatus === 'error' || syncStatus === 'offline' ? (
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{syncStatus === 'error' ? 'Gagal Sinkron' : 'Mode Offline'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tersinkron ke Supabase</span>
              </span>
            )}
          </div>

          {/* Always Available Sync & Force Refresh Button */}
          <button
            type="button"
            onClick={onForceRefresh}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              hasNewVersion
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Sinkronisasi & Muat Ulang Versi Terbaru (Bypass Cache HP)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${hasNewVersion ? 'animate-spin' : 'text-slate-600'}`} />
            <span className="text-[11px]">{hasNewVersion ? 'Perbarui HP' : 'Sync'}</span>
          </button>
        </div>
      </div>
    </header>
  </>
  );
};
