import React, { useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { forceHardRefresh } from '../utils/versionCheck';

interface UpdateNotificationBannerProps {
  hasNewVersion: boolean;
  version?: string;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  hasNewVersion,
  version = '1.5.0',
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  if (!hasNewVersion || isDismissed) {
    return null;
  }

  const handleUpdateClick = () => {
    setIsUpdating(true);
    forceHardRefresh();
  };

  return (
    <div
      id="auto-update-banner"
      className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 shadow-sm shadow-emerald-500/30 animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Fitur Baru Tersedia!</span>
              <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                v{version}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Pembaruan fitur terbaru telah dirilis. Muat ulang sekarang untuk menerapkan perubahan di perangkat ini.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdateClick}
              disabled={isUpdating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Memperbarui...' : 'Perbarui Sekarang'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl transition-colors cursor-pointer"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
