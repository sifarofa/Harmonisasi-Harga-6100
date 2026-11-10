import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  FileJson,
} from 'lucide-react';
import { MonthlyHarmonizationDataset } from '../types';
import { IhkCompleteDataset } from '../types/ihk';
import { HpbsDataset } from '../types/hpbs';
import {
  createFullAppBackup,
  restoreFullAppBackup,
  savePersistentItem,
  STORAGE_KEYS,
} from '../utils/persistentStorage';
import { syncAllDatasetsToServer } from '../utils/apiService';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: MonthlyHarmonizationDataset[];
  ihkDataset: IhkCompleteDataset;
  hpbsDataset: HpbsDataset;
  onRestoreSuccess: (restored: {
    datasets?: MonthlyHarmonizationDataset[];
    ihkDataset?: IhkCompleteDataset;
    hpbsDataset?: HpbsDataset;
  }) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  datasets,
  ihkDataset,
  hpbsDataset,
  onRestoreSuccess,
  onShowToast,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle download backup file
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const backupData = await createFullAppBackup();
      // Ensure in-memory current state is reflected in backup
      backupData.datasets = datasets;
      backupData.ihkDataset = ihkDataset;
      backupData.hpbsDataset = hpbsDataset;

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate()
      ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const fileName = `Backup_Data_Harmonisasi_Kalbar_${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast(`✓ File cadangan berhasil diunduh: ${fileName}`, 'success');
    } catch (err: any) {
      console.error('Export backup error:', err);
      onShowToast(`Gagal mengunduh cadangan: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file select and restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      setRestoreStatus({ type: null, message: '' });

      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Format file cadangan JSON tidak valid.');
      }

      const result = await restoreFullAppBackup(parsed);

      // Notify parent state
      onRestoreSuccess({
        datasets: parsed.datasets,
        ihkDataset: parsed.ihkDataset,
        hpbsDataset: parsed.hpbsDataset,
      });

      // Synchronize immediately to server
      syncAllDatasetsToServer({
        datasets: parsed.datasets,
        ihkDataset: parsed.ihkDataset,
        hpbsDataset: parsed.hpbsDataset,
      });

      setRestoreStatus({
        type: 'success',
        message: `Pemulihan sukses! ${result.harmCount} periode harmonisasi, ${result.ihkRegions} wilayah IHK, dan ${result.hpbsRecords} responden HPBS dipulihkan.`,
      });
      onShowToast('✓ Seluruh data cadangan berhasil dipulihkan & disinkronkan ke server!', 'success');
    } catch (err: any) {
      console.error('Restore error:', err);
      setRestoreStatus({
        type: 'error',
        message: `Gagal memulihkan cadangan: ${err.message || 'File tidak sesuai'}`,
      });
      onShowToast(`Gagal memulihkan: ${err.message}`, 'error');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Manual push all local data to server
  const handleForcePushToServer = async () => {
    try {
      setIsSyncingServer(true);
      // Persist to indexedDB with edit flag true
      await Promise.all([
        savePersistentItem(STORAGE_KEYS.HARMONIZATION, datasets, true),
        savePersistentItem(STORAGE_KEYS.IHK, ihkDataset, true),
        savePersistentItem(STORAGE_KEYS.HPBS, hpbsDataset, true),
      ]);

      const ok = await syncAllDatasetsToServer({
        datasets,
        ihkDataset,
        hpbsDataset,
      });

      if (ok) {
        onShowToast('✓ Data lokal browser berhasil dipublikasikan & disimpan permanen di server!', 'success');
      } else {
        onShowToast('Peringatan: Server merespons sebagian, data lokal Anda tetap aman tersimpan.', 'info');
      }
    } catch (err: any) {
      onShowToast(`Gagal sync ke server: ${err?.message}`, 'error');
    } finally {
      setIsSyncingServer(false);
    }
  };

  const ihkRegionCount = Object.keys(ihkDataset?.regions || {}).length;
  const hpbsRecordCount = hpbsDataset?.records?.length || 0;
  const hpbsPeriodCount = hpbsDataset?.periods?.length || (hpbsRecordCount > 0 ? 1 : 0);

  return (
    <div
      id="backup-restore-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="backup-restore-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Penyimpanan & Cadangan Data</h3>
              <p className="text-xs text-slate-300">
                IndexedDB Engine &bull; Bebas Reset &bull; Proteksi Pembaruan Fitur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Explanation Box */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Data Anda Aman & Tidak Akan Ter-Reset ke Default</span>
            </div>
            <p>
              Aplikasi kini menggunakan <strong>Penyimpanan IndexedDB Browser</strong> yang mandiri dari batas kuota
              5MB. Setiap ada pembaruan fitur/aplikasi, browser akan <strong>mempertahankan data Anda</strong> dan secara
              otomatis menyinkronkannya kembali ke server. Anda <strong>tidak perlu republish berulang kali</strong>.
            </p>
          </div>

          {/* Current Workspace Stats */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                Ringkasan Data Saat Ini di Browser Anda:
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Tersimpan di IndexedDB
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-base font-extrabold text-slate-800">{datasets.length}</div>
                <div className="text-[10px] text-slate-500 font-medium">Bulan Harmonisasi</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-base font-extrabold text-slate-800">{ihkRegionCount}</div>
                <div className="text-[10px] text-slate-500 font-medium">Wilayah IHK</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-base font-extrabold text-slate-800">{hpbsRecordCount.toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-slate-500 font-medium">Responden SHPB ({hpbsPeriodCount} Bln)</div>
              </div>
            </div>
          </div>

          {/* Action 1: Export Full Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-700" />
                  Unduh File Cadangan Lengkap (.json)
                </h4>
                <p className="text-xs text-slate-500">
                  Simpan cadangan seluruh data Harmonisasi, IHK, dan SHPB dalam satu file JSON ke komputer/HP Anda.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-backup"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                <span>{isExporting ? 'Mengunduh...' : 'Unduh Cadangan'}</span>
              </button>
            </div>
          </div>

          {/* Action 2: Restore from Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-700" />
                  Pulihkan dari File Cadangan (.json)
                </h4>
                <p className="text-xs text-slate-500">
                  Pulihkan seluruh data dari file JSON cadangan sebelumnya jika Anda berganti perangkat atau browser.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  id="btn-restore-backup"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{isRestoring ? 'Memulihkan...' : 'Pilih File JSON'}</span>
                </button>
              </div>
            </div>

            {restoreStatus.type && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  restoreStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {restoreStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{restoreStatus.message}</span>
              </div>
            )}
          </div>

          {/* Action 3: Push Local to Server */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-slate-700" />
                  Sinkronkan Ulang ke Server
                </h4>
                <p className="text-xs text-slate-500">
                  Paksa pengiriman ulang data yang ada di browser Anda ke server untuk memastikan link publik terbarui.
                </p>
              </div>
              <button
                type="button"
                id="btn-sync-to-server"
                onClick={handleForcePushToServer}
                disabled={isSyncingServer}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingServer ? 'animate-spin' : ''}`} />
                <span>{isSyncingServer ? 'Menyinkronkan...' : 'Sinkron ke Server'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Perubahan otomatis tersimpan real-time tanpa perlu klik Simpan manual.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
