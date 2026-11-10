import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Lock,
  Shield,
} from 'lucide-react';
import { MASTER_COMMODITIES } from '../data/initialData';
import { MonthlyHarmonizationDataset, PriceStatus, RegionInfo } from '../types';
import {
  computeOverallStatus,
  detectMonthInfo,
  downloadMonthly4SheetTemplate,
  downloadMonthlySingleSheetTemplate,
  exportHarmonizationToExcel,
  parseExcelFile,
} from '../utils/analysis';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add_month' | 'import' | 'export' | 'manage_months';
  datasets: MonthlyHarmonizationDataset[];
  regions: RegionInfo[];
  isOwner?: boolean;
  onRequireOwner?: (actionName: string, cb: () => void) => void;
  onAddMonth: (newDataset: MonthlyHarmonizationDataset) => void;
  onImportDatasets: (datasets: MonthlyHarmonizationDataset | MonthlyHarmonizationDataset[], replaceAll?: boolean) => void;
  onDeleteMonth: (monthId: string) => void;
  onDeleteMonths: (monthIds: string[]) => void;
  onClearAllDatasets: () => void;
  onResetData: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  datasets,
  regions,
  isOwner = true,
  onRequireOwner,
  onAddMonth,
  onImportDatasets,
  onDeleteMonth,
  onDeleteMonths,
  onClearAllDatasets,
  onResetData,
}) => {
  const [activeMode, setActiveMode] = useState<'add_month' | 'import' | 'export' | 'manage_months'>(initialMode);
  
  // Add Month State
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // Default to month after June
  const [copyMode, setCopyMode] = useState<'copy_prev' | 'blank' | 'realistic'>('realistic');
  const [notes, setNotes] = useState('');

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonthLabel, setImportMonthLabel] = useState('Juli 2024');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessInfo, setImportSuccessInfo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [replaceAllDatasets, setReplaceAllDatasets] = useState(false);
  const [detectedCount, setDetectedCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreateMonth = (e: React.FormEvent) => {
    e.preventDefault();
    const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    const id = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    // Check if month already exists
    if (datasets.some((d) => d.id === id)) {
      alert(`Data untuk ${monthLabel} sudah ada dalam sistem.`);
      return;
    }

    const lastDataset = datasets[datasets.length - 1];

    const commodities = MASTER_COMMODITIES.map((c) => {
      const regionData: Record<string, any> = {};

      regions.forEach((reg) => {
        // Check if this region naturally doesn't have/produce this commodity
        const isExcluded =
          (c.no === 35 && ['reg_4', 'reg_5', 'reg_6'].includes(reg.id)) || // Ikan Kembung in mountainous areas
          (c.no === 36 && ['reg_5', 'reg_6'].includes(reg.id)) || // Ikan Tongkol in highlands
          (c.no === 27 && ['reg_1', 'reg_2'].includes(reg.id)); // Jeruk Lokal

        if (isExcluded) {
          regionData[reg.id] = {
            status: 'KOSONG',
            produsenDesaStatus: 'KOSONG',
            konsumenDesaStatus: 'KOSONG',
            perdaganganBesarStatus: 'KOSONG',
            konsumenStatus: 'KOSONG',
            produsenStatus: 'KOSONG',
            grosirStatus: 'KOSONG',
            hasCommodity: false,
            hpg: 0,
            hkd: 0,
            hpb: 0,
            hk: 0,
          };
          return;
        }

        let status: PriceStatus = 'STABIL';

        if (copyMode === 'copy_prev' && lastDataset) {
          const prevComm = lastDataset.commodities.find((item) => item.no === c.no);
          status = prevComm?.regions?.[reg.id]?.status || 'STABIL';
        } else if (copyMode === 'blank') {
          status = 'STABIL';
        } else {
          // Realistic dynamic fluctuation
          if ([2, 6, 7, 9, 34, 37].includes(c.no)) {
            // Highly volatile: Cabai, Bawang, Daging Ayam, Telur
            const rand = Math.random();
            if (rand < 0.45) status = 'NAIK';
            else if (rand < 0.8) status = 'TURUN';
            else status = 'STABIL';
          } else if ([5, 12, 19].includes(c.no)) {
            // Moderate: Beras, Gula, Minyak
            const rand = Math.random();
            if (rand < 0.25) status = 'NAIK';
            else if (rand < 0.4) status = 'TURUN';
            else status = 'STABIL';
          } else {
            // High stability
            const rand = Math.random();
            if (rand < 0.08) status = 'NAIK';
            else if (rand < 0.15) status = 'TURUN';
            else status = 'STABIL';
          }
        }

        // Generate aligned 4-level statuses with realistic transmissions
        let pDesaStatus: PriceStatus = status;
        let kDesaStatus: PriceStatus = status;
        let pbStatus: PriceStatus = status;
        let kStatus: PriceStatus = status;

        const transmissionRand = Math.random();
        if (transmissionRand < 0.15 && status === 'NAIK') {
          // Lag transmisi: Produsen desa naik duluan, konsumen desa & hilir belum
          pDesaStatus = 'NAIK';
          kDesaStatus = 'STABIL';
          pbStatus = 'STABIL';
          kStatus = 'STABIL';
        } else if (transmissionRand > 0.88 && status === 'STABIL') {
          // Asimetri margin: Eceran kota naik sendiri
          pDesaStatus = 'STABIL';
          kDesaStatus = 'STABIL';
          pbStatus = 'NAIK';
          kStatus = 'NAIK';
        }

        regionData[reg.id] = {
          status: kStatus,
          produsenDesaStatus: pDesaStatus,
          konsumenDesaStatus: kDesaStatus,
          perdaganganBesarStatus: pbStatus,
          konsumenStatus: kStatus,
          produsenStatus: pDesaStatus,
          grosirStatus: pbStatus,
          hasCommodity: true,
          hpg: pDesaStatus === 'NAIK' ? 1 : pDesaStatus === 'TURUN' ? -1 : 0,
          hkd: kDesaStatus === 'NAIK' ? 1 : kDesaStatus === 'TURUN' ? -1 : 0,
          hpb: pbStatus === 'NAIK' ? 1 : pbStatus === 'TURUN' ? -1 : 0,
          hk: kStatus === 'NAIK' ? 1 : kStatus === 'TURUN' ? -1 : 0,
        };
      });

      // Compute overall status for all levels
      const overall = computeOverallStatus(regionData, 'konsumen');
      const overallPDesa = computeOverallStatus(regionData, 'produsen_desa');
      const overallKDesa = computeOverallStatus(regionData, 'konsumen_desa');
      const overallPB = computeOverallStatus(regionData, 'perdagangan_besar');

      return {
        id: `c_${c.no}`,
        no: c.no,
        name: c.name,
        category: c.category,
        unit: c.unit,
        regions: regionData,
        overallStatus: overall,
        overallProdusenDesaStatus: overallPDesa,
        overallKonsumenDesaStatus: overallKDesa,
        overallPerdaganganBesarStatus: overallPB,
        overallKonsumenStatus: overall,
        overallProdusenStatus: overallPDesa,
        overallGrosirStatus: overallPB,
      };
    });

    const newDataset: MonthlyHarmonizationDataset = {
      id,
      year: selectedYear,
      month: selectedMonth,
      monthLabel,
      notes: notes || `Rekapitulasi harmonisasi data bulanan ${monthLabel}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commodities,
    };

    onAddMonth(newDataset);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);
      setImportError(null);
      setImportSuccessInfo(null);
      setIsProcessing(true);

      parseExcelFile(file, regions, (result, error) => {
        setIsProcessing(false);
        if (error || !result || !result.datasets || result.datasets.length === 0) {
          setImportError(error || 'Gagal membaca isi file Excel.');
          setDetectedCount(0);
          return;
        }

        setDetectedCount(result.datasets.length);
        if (result.datasets.length === 1) {
          const singleDataset = result.datasets[0];
          setImportMonthLabel(singleDataset.monthLabel);
          if (result.sheetCount > 1) {
            setImportSuccessInfo(
              `File terdeteksi sebagai 1 periode (${singleDataset.monthLabel}) yang menggabungkan ${result.sheetCount} sheet tingkat harga (HD, HKD, HPB, HK) dengan total ${singleDataset.commodities.length} komoditas.`
            );
          } else {
            setImportSuccessInfo(
              `File terdeteksi sebagai 1 periode (${singleDataset.monthLabel}) dengan total ${singleDataset.commodities.length} komoditas.`
            );
          }
        } else {
          const monthNamesStr = result.datasets.map((d) => d.monthLabel.split(' ')[0]).join(', ');
          setImportSuccessInfo(
            `File siap diimpor: Terdeteksi ${result.datasets.length} periode bulan (${monthNamesStr}) dengan total ${result.datasets[0]?.commodities.length || 0} komoditas per bulan.`
          );
        }
      });
    }
  };

  const handleProcessImport = () => {
    if (!importFile) {
      setImportError('Silakan pilih file Excel (.xlsx atau .csv) terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    setImportError(null);

    parseExcelFile(importFile, regions, (result, error) => {
      setIsProcessing(false);
      if (error || !result || !result.datasets || result.datasets.length === 0) {
        setImportError(error || 'Gagal memproses file Excel.');
        return;
      }

      // If user provided a custom single month label and only 1 dataset was extracted
      if (result.datasets.length === 1 && importMonthLabel.trim()) {
        const customLabel = importMonthLabel.trim();
        result.datasets[0].monthLabel = customLabel;
        const parsed = detectMonthInfo(customLabel, result.datasets[0].month, result.datasets[0].year);
        result.datasets[0].month = parsed.month;
        result.datasets[0].year = parsed.year;
        result.datasets[0].id = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      }

      // Sort datasets chronologically: earliest year & month first (at index 0 / far left)
      result.datasets.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      onImportDatasets(result.datasets, replaceAllDatasets);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kelola Data Harmonisasi</h3>
              <p className="text-xs text-slate-500">Tambah periode bulan baru atau import data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher inside modal */}
        <div className="flex border-b border-slate-100 bg-white overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              if (!isOwner) {
                onRequireOwner?.('Kelola & Hapus Data Bulan', () => setActiveMode('manage_months'));
                return;
              }
              setActiveMode('manage_months');
            }}
            className={`flex-1 min-w-[120px] py-2.5 px-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeMode === 'manage_months'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Daftar & Hapus Bulan ({datasets.length})</span>
            {!isOwner && <Lock className="w-3 h-3 text-slate-400" />}
          </button>
          <button
            onClick={() => {
              if (!isOwner) {
                onRequireOwner?.('Import Data Excel', () => setActiveMode('import'));
                return;
              }
              setActiveMode('import');
            }}
            className={`flex-1 min-w-[120px] py-2.5 px-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeMode === 'import'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Import File Excel</span>
            {!isOwner && <Lock className="w-3 h-3 text-slate-400" />}
          </button>
          <button
            onClick={() => {
              if (!isOwner) {
                onRequireOwner?.('Tambah Bulan Baru', () => setActiveMode('add_month'));
                return;
              }
              setActiveMode('add_month');
            }}
            className={`flex-1 min-w-[110px] py-2.5 px-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeMode === 'add_month'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>+ Tambah Bulan</span>
            {!isOwner && <Lock className="w-3 h-3 text-slate-400" />}
          </button>
          <button
            onClick={() => setActiveMode('export')}
            className={`flex-1 min-w-[90px] py-2.5 px-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              activeMode === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Export Rekap
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {!isOwner && activeMode !== 'export' ? (
            <div className="py-8 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Akses Terbatas: Khusus Owner</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                Menu kelola data, import file excel, dan penambahan bulan hanya dapat diakses oleh Owner / penanggung jawab data.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireOwner?.(
                      activeMode === 'add_month'
                        ? 'Tambah Bulan'
                        : activeMode === 'import'
                        ? 'Import Data'
                        : 'Kelola Data',
                      () => {}
                    );
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Masuk sebagai Owner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('export')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Beralih ke Export Rekap
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeMode === 'manage_months' && (
            <div className="space-y-4">
              {/* Quick Action: Delete Jan - Jun 2024 */}
              {datasets.some((d) => ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'].includes(d.id)) && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Hapus Data Contoh (Januari s.d. Juni 2024)</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Hapus sekaligus 6 periode bulan bawaan contoh (Jan–Jun 2024) agar Anda dapat memulai dengan data survei mandiri (misal Januari s.d. September).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Yakin ingin menghapus seluruh data Januari s.d. Juni 2024?')) {
                        onDeleteMonths(['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06']);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Januari - Juni 2024 Sekarang</span>
                  </button>
                </div>
              )}

              {/* List of current months */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Daftar Periode Bulan Tersimpan ({datasets.length} Bulan):
                  </span>
                  {datasets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Apakah Anda yakin ingin MENGOSONGKAN SELURUH DATABASE? Semua data bulan akan dihapus.')) {
                          onClearAllDatasets();
                        }
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Kosongkan Semua</span>
                    </button>
                  )}
                </div>

                {datasets.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl space-y-2">
                    <Database className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">Database Kosong</p>
                    <p className="text-[11px] text-slate-500">
                      Tidak ada periode bulan tersimpan. Silakan import file Excel atau muat data standar.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMode('import')}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer"
                      >
                        Import File Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onResetData();
                        }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 cursor-pointer"
                      >
                        Muat Data Standar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {[...datasets]
                      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
                      .map((d) => (
                      <div
                        key={d.id}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{d.monthLabel}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">
                              {d.commodities?.length || 38} Komoditas
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {d.id}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus data ${d.monthLabel} dari database?`)) {
                              onDeleteMonth(d.id);
                            }
                          }}
                          title={`Hapus ${d.monthLabel}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Quick Reset Option */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset database ke data simulasi standar (Jan - Jun 2024)?')) {
                      onResetData();
                    }
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset ke Data Standar (Jan-Jun)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
          {activeMode === 'add_month' && (
            <form onSubmit={handleCreateMonth} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tahun
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bulan
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Inisialisasi Data Komoditas
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      checked={copyMode === 'realistic'}
                      onChange={() => setCopyMode('realistic')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Simulasi Dinamika Pasar Realistis
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Menghasilkan fluktuasi alami (cabai & bawang dinamis, komoditas pabrikan stabil)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      checked={copyMode === 'copy_prev'}
                      onChange={() => setCopyMode('copy_prev')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Salin Status dari Bulan Terakhir
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Mengambil nilai dari {datasets[datasets.length - 1]?.monthLabel || 'sebelumnya'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      checked={copyMode === 'blank'}
                      onChange={() => setCopyMode('blank')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Format Bersih / Netral (0)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Semua sel dimulai dari 0/Netral untuk diisi manual
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mis: Harmonisasi pasca panen raya / Hari Raya..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Periode</span>
                </button>
              </div>
            </form>
          )}

          {activeMode === 'import' && (
            <div className="space-y-4">
              {/* Upload Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-800">
                  {importFile ? importFile.name : 'Klik untuk memilih file Excel (.xlsx) / CSV'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mendukung 1 file multi-sheet (Januari s.d. September) atau file bulanan perorangan
                </p>
              </div>

              {/* Detected Sheet Info / Success Banner */}
              {importSuccessInfo && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>File Terverifikasi Siap Diimpor</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    {importSuccessInfo}
                  </p>
                </div>
              )}

              {/* Import Options Configuration */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <span className="font-bold text-slate-800 block">Metode Penggabungan Data:</span>
                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={!replaceAllDatasets}
                      onChange={() => setReplaceAllDatasets(false)}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <strong className="text-emerald-800">Sambung / Tambahkan ke Data Lama (Direkomendasikan):</strong> Data bulan yang baru diimpor akan ditambahkan ke riwayat data sebelumnya tanpa menghapus bulan-bulan yang sudah ada.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={replaceAllDatasets}
                      onChange={() => setReplaceAllDatasets(true)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <span>
                      <strong className="text-slate-800">Ganti Seluruh Dataset:</strong> Menghapus semua riwayat data sebelumnya dan menggantinya hanya dengan data dari file ini.
                    </span>
                  </label>
                </div>
              </div>

              {detectedCount <= 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Label Periode Bulan:
                  </label>
                  <input
                    type="text"
                    value={importMonthLabel}
                    onChange={(e) => setImportMonthLabel(e.target.value)}
                    placeholder="Mis: Januari 2024"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Label bulan terdeteksi otomatis dari nama file/sheet. Anda dapat menyesuaikannya bila perlu.
                  </p>
                </div>
              )}

              {/* Format Guidance Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Petunjuk Format File Excel:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        downloadMonthlySingleSheetTemplate(
                          importMonthLabel || datasets[0]?.monthLabel || 'Januari 2024',
                          datasets[0]?.commodities || MASTER_COMMODITIES as any,
                          regions
                        )
                      }
                      title="Download template Excel 1 sheet (Format Tabel Wilayah Kalbar)"
                      className="px-2 py-1 bg-white text-slate-700 border border-slate-300 rounded text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-slate-600" />
                      <span>Template Wilayah (1 Sheet)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadMonthly4SheetTemplate(
                          importMonthLabel || datasets[0]?.monthLabel || 'Januari 2024',
                          datasets[0]?.commodities || MASTER_COMMODITIES as any,
                          regions
                        )
                      }
                      title="Download template 1 bulan dengan 4 sheet tingkat harga (HD, HKD, HPB, HK)"
                      className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-emerald-700" />
                      <span>Template 4 Level (4 Sheet)</span>
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                  <p>
                    • <strong>Format Bulanan (4 Sheet / 4 Level):</strong> 1 file Excel untuk 1 periode bulan yang berisi 4 sheet tingkat harga:
                    <span className="inline-flex gap-1 ml-1 flex-wrap">
                      <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px] font-bold">HD</code> (Produsen Desa),
                      <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px] font-bold">HKD</code> (Konsumen Desa),
                      <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px] font-bold">HPB</code> (Grosir/Besar), dan
                      <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px] font-bold">HK</code> (Konsumen/Eceran).
                    </span>
                    <span className="text-slate-500 italic block mt-0.5">*(Tidak memerlukan sheet Rekap karena sistem otomatis mengonsolidasi seluruh level harga)*</span>
                  </p>
                  <p>
                    • <strong>Otomatisasi Penuh oleh Sistem:</strong> Begitu file bulanan diimpor, sistem secara otomatis menggabungkan seluruh level harga, memperbarui deret waktu (<em>Time Series</em>), menyusun <em>Matriks Lintas Bulan</em>, mendiagnosis transmisi harga hulu-ke-hilir, dan menghitung volatilitas.
                  </p>
                  <p>
                    • <strong>Header Kolom di Setiap Sheet:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">No.</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Komoditas</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Kategori</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px] font-bold text-slate-800">Kalbar</code>, diikuti 14 nama Kabupaten/Kota, dan <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Catatan</code>.
                  </p>
                  <p>
                    • <strong>Status Nilai Sel:</strong> <code className="text-emerald-800 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">STABIL</code> (atau 0), <code className="text-rose-800 font-bold bg-rose-50 px-1 py-0.2 rounded border border-rose-200">NAIK</code> (atau 1), <code className="text-blue-800 font-bold bg-blue-50 px-1 py-0.2 rounded border border-blue-200">TURUN</code> (atau -1), dan <code className="font-mono font-bold bg-slate-200 px-1 py-0.2 rounded text-slate-800">-</code> untuk wilayah nihil/tanpa komoditas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-emerald-800 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>
                  <strong>Sinkronisasi Publikasi Otomatis:</strong> Data yang diimpor akan langsung disimpan dan dipublikasikan ke server sehingga seluruh pengguna dan tautan publik langsung terupdate.
                </span>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={handleProcessImport}
                  disabled={!importFile || isProcessing}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Memproses...' : detectedCount > 1 ? `Import ${detectedCount} Bulan` : 'Import Data'}</span>
                </button>
              </div>
            </div>
          )}

          {activeMode === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-900">
                  Export Rekapitulasi Time Series & Harmonisasi Lengkap
                </h4>
                <p className="text-[11px] text-emerald-700 mt-1">
                  File Excel yang diunduh akan berisi:
                </p>
                <ul className="text-[11px] text-emerald-800 list-disc list-inside mt-1.5 space-y-0.5">
                  <li>Sheet 1: Rekap Time Series & Stabilitas 38 Komoditas</li>
                  <li>Sheet 2 s/d {datasets.length + 1}: Data Harmonisasi rinci per periode bulan</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    exportHarmonizationToExcel(datasets, regions);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
