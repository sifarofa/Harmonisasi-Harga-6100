import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Coins,
  Download,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { IhkCompleteDataset } from '../types/ihk';
import {
  downloadIhkTemplateExcel,
  exportIhkToExcel,
  parseIhkExcelFile,
} from '../utils/ihkFileUtils';

interface IhkDataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'import' | 'template' | 'export' | 'manage';
  ihkDataset?: IhkCompleteDataset;
  dataset?: IhkCompleteDataset;
  onSaveIhkDataset?: (newDataset: IhkCompleteDataset) => void;
  onSaveDataset?: (newDataset: IhkCompleteDataset) => void;
  onResetIhkDataset?: () => void;
  onResetDefault?: () => void;
  startMonthId?: string;
  endMonthId?: string;
}

export const IhkDataManagementModal: React.FC<IhkDataManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'import',
  ihkDataset,
  dataset,
  onSaveIhkDataset,
  onSaveDataset,
  onResetIhkDataset,
  onResetDefault,
  startMonthId = '2024-01',
  endMonthId = '2026-08',
}) => {
  const currentDataset = ihkDataset || dataset;
  const saveDatasetFn = onSaveIhkDataset || onSaveDataset;
  const resetDatasetFn = onResetIhkDataset || onResetDefault;

  const [activeTab, setActiveTab] = useState<'import' | 'template' | 'export' | 'manage'>(initialTab);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    details?: string;
  }>({ type: 'idle', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImportStatus({ type: 'idle', message: '' });
  };

  const handleProcessImport = async () => {
    if (!selectedFile) {
      setImportStatus({
        type: 'error',
        message: 'Silakan pilih file Excel IHK terlebih dahulu (.xlsx / .xls).',
      });
      return;
    }

    setIsProcessing(true);
    setImportStatus({ type: 'idle', message: '' });

    try {
      const parsed = await parseIhkExcelFile(selectedFile);
      const regionCount = Object.keys(parsed.regions).length;

      if (regionCount === 0) {
        throw new Error('Tidak ditemukan sheet atau data IHK yang valid dalam file ini.');
      }

      let totalItems = 0;
      Object.values(parsed.regions).forEach((r) => {
        totalItems += r.items.length;
      });

      if (typeof saveDatasetFn === 'function') {
        saveDatasetFn(parsed);
      } else {
        console.warn('saveDatasetFn is not provided, skipping dataset persistence.');
      }

      setImportStatus({
        type: 'success',
        message: `Berhasil mengimpor & mempublikasikan data IHK ke server! Terbaca ${regionCount} sheet wilayah (${Object.keys(parsed.regions).join(', ')}) dengan total ${totalItems} baris komoditas dan ${parsed.availableMonths.length} bulan observasi. Data yang dipublish telah diperbarui untuk semua pengunjung.`,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Import IHK Error:', err);
      setImportStatus({
        type: 'error',
        message: err.message || 'Gagal memproses file Excel IHK. Pastikan format kolom sesuai.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportNow = () => {
    if (currentDataset) {
      exportIhkToExcel(currentDataset, startMonthId, endMonthId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-900/10 via-slate-50 to-emerald-800/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Manajemen File & Data IHK Konsumen (HK)
              </h3>
              <p className="text-xs text-slate-500">
                Sistem pengelolaan berkas terpisah untuk data Indeks Harga Konsumen (BPS Kalbar)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/70 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File IHK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'template'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Format & Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Data IHK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'manage'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Status & Reset</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-slate-700 leading-relaxed">
                  <span className="font-bold text-emerald-950 block">
                    Mendukung Multi-Sheet Excel BPS IHK Kalbar
                  </span>
                  Unggah file Excel yang memiliki sheet per wilayah seperti di BPS:{' '}
                  <code className="bg-white px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                    tidur6106
                  </code>{' '}
                  (Ketapang),{' '}
                  <code className="bg-white px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                    tidur6107
                  </code>{' '}
                  (Sintang),{' '}
                  <code className="bg-white px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                    tidur6111
                  </code>{' '}
                  (Kayong Utara),{' '}
                  <code className="bg-white px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                    tidur6171
                  </code>{' '}
                  (Pontianak), dan{' '}
                  <code className="bg-white px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                    tidur6172
                  </code>{' '}
                  (Singkawang).
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 hover:bg-emerald-50/20">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="ihk-file-upload"
                />
                <label
                  htmlFor="ihk-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {selectedFile ? selectedFile.name : 'Pilih atau Tarik File Excel IHK di sini'}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Format yang didukung: .xlsx, .xls (Maksimal 20 MB)
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-[11px]">
                  File IHK ini disimpan secara mandiri dan tidak mengubah data harmonisasi 4 level harga.
                </span>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  disabled={!selectedFile || isProcessing}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Proses Impor File</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Banner */}
              {importStatus.type === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{importStatus.message}</span>
                </div>
              )}

              {importStatus.type === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEMPLATE */}
          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Template Excel Resmi BPS IHK Konsumen (5 Wilayah)</span>
                </h4>
                <p className="text-slate-600 leading-relaxed text-xs">
                  Unduh template Excel yang sudah tersusun sesuai standar pelaporan Indeks Harga Konsumen level HK di Kalimantan Barat. Berkas telah mencakup 5 lembar kerja (sheet) lengkap dengan 46 kode komoditas standar (Beras, Daging, Ikan, Telur, Minyak, dll) dan format kolom siap pakai.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="font-mono font-bold text-slate-800 block">tidur6106</span>
                    <span className="text-[10px] text-slate-500">Kab. Ketapang</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="font-mono font-bold text-slate-800 block">tidur6107</span>
                    <span className="text-[10px] text-slate-500">Kab. Sintang</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="font-mono font-bold text-slate-800 block">tidur6111</span>
                    <span className="text-[10px] text-slate-500">Kab. Kayong Utara</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="font-mono font-bold text-slate-800 block">tidur6171</span>
                    <span className="text-[10px] text-slate-500">Kota Pontianak</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="font-mono font-bold text-slate-800 block">tidur6172</span>
                    <span className="text-[10px] text-slate-500">Kota Singkawang</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-center flex flex-col justify-center">
                    <span className="font-bold text-emerald-800 block text-[11px]">46 Komoditas</span>
                    <span className="text-[10px] text-emerald-600">Terdaftar</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={downloadIhkTemplateExcel}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Template Excel IHK (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Ekspor Data IHK Aktif ke Excel Multi-Sheet</span>
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Ekspor seluruh data komoditas IHK level Konsumen (HK) yang saat ini aktif di dashboard ke dalam berkas Excel dengan lembar kerja terpisah untuk masing-masing wilayah, lengkap dengan kalkulasi selisih poin, persentase perubahan, dan status kestabilan harga.
                </p>

                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">Periode yang Disertakan:</span>
                    <span className="text-slate-500 text-[11px]">
                      {startMonthId} s/d {endMonthId} ({ihkDataset.availableMonths.length} bulan tersimpan)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                    {Object.keys(ihkDataset.regions).length} Sheet Wilayah
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExportNow}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ekspor Berkas Excel IHK Sekarang</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE & RESET */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Status Penyimpanan Data IHK</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Wilayah IHK</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5 block">
                      {currentDataset?.regions ? Object.keys(currentDataset.regions).length : 0} Wilayah
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Rentang Bulan</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5 block">
                      {currentDataset?.availableMonths?.length || 0} Bulan
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Pembaruan Terakhir</span>
                    <span className="text-xs font-semibold text-slate-700 mt-1 block truncate">
                      {currentDataset?.lastUpdated
                        ? new Date(currentDataset.lastUpdated).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Reset ke Data Standar BPS</span>
                    <span className="text-slate-500 text-[11px]">
                      Kembalikan data IHK ke acuan benchmark Januari 2024 s/d Agustus 2026.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Yakin ingin mereset data IHK ke data acuan benchmark default?')) {
                        if (typeof resetDatasetFn === 'function') {
                          resetDatasetFn();
                        }
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-slate-400 text-[11px] font-mono">
            Storage: ihk_consumer_datasets_v1 (Terisolasi)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
