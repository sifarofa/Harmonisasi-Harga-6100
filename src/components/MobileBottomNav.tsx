import React from 'react';
import { Layers, Coins, Store, Menu, RefreshCw, Database } from 'lucide-react';
import { TabType } from './Navbar';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenSidebar: () => void;
  hasNewVersion?: boolean;
  onForceRefresh?: () => void;
  onOpenActiveManager?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenSidebar,
  hasNewVersion = false,
  onForceRefresh,
  onOpenActiveManager,
}) => {
  const isHarmonisasi =
    activeTab === 'price_levels' || activeTab === 'overview' || activeTab === 'grid';
  const isIhk = activeTab === 'ihk_consumer';
  const isHpbs = activeTab === 'hpbs_rh';

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Navigasi Bawah Seluler"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg lg:hidden"
    >
      {/* Update Indicator Pill if New Version Available */}
      {hasNewVersion && (
        <div
          onClick={onForceRefresh}
          className="bg-amber-500 text-white text-[11px] font-bold py-1 px-3 text-center flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Versi Baru Tersedia! Ketuk di sini untuk memperbarui tampilan HP</span>
        </div>
      )}

      <div className="grid grid-cols-4 items-center h-14 px-1 max-w-md mx-auto">
        {/* Tab 1: Harmonisasi */}
        <button
          type="button"
          onClick={() => onSelectTab('price_levels')}
          className={`flex flex-col items-center justify-center h-full py-1 transition-colors cursor-pointer ${
            isHarmonisasi ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Layers className="w-5 h-5" />
            {isHarmonisasi && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-emerald-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[72px]">
            Harmonisasi
          </span>
        </button>

        {/* Tab 2: IHK Konsumen */}
        <button
          type="button"
          onClick={() => onSelectTab('ihk_consumer')}
          className={`flex flex-col items-center justify-center h-full py-1 transition-colors cursor-pointer ${
            isIhk ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Coins className="w-5 h-5" />
            {isIhk && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-amber-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[72px]">
            IHK 5 Kota
          </span>
        </button>

        {/* Tab 3: RH V-HPBS */}
        <button
          type="button"
          onClick={() => onSelectTab('hpbs_rh')}
          className={`flex flex-col items-center justify-center h-full py-1 transition-colors cursor-pointer ${
            isHpbs ? 'text-purple-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Store className="w-5 h-5" />
            {isHpbs && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-purple-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[72px]">
            RH Pedagang
          </span>
        </button>

        {/* Tab 4: Menu Vertikal / Semua Fitur */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex flex-col items-center justify-center h-full py-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5 text-emerald-700" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium text-emerald-800">
            Menu Vertikal
          </span>
        </button>
      </div>
    </nav>
  );
};
