import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { HpbsDataset, HpbsMonthlyPeriod, HpbsRespondentRecord } from '../types/hpbs';
import {
  computeRespondentMetrics,
  downloadHpbsTemplateExcel,
  exportHpbsAnalysisToExcel,
  filterValidHpbsRecords,
  ParseHpbsDetailedResult,
  parseHpbsExcelDetailed,
} from '../utils/hpbsAnalysis';

interface HpbsDataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'manage_months' | 'add_month' | 'import' | 'export';
  hpbsDataset: HpbsDataset;
  onSaveHpbsDataset: (newDataset: HpbsDataset) => void;
  onResetHpbs?: () => void;
  onSwitchPeriod: (periodId: string) => void;
  isOwner?: boolean;
  onOpenOwnerAuth?: (actionName?: string) => void;
}

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const INDO_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const HpbsDataManagementModal: React.FC<HpbsDataManagementModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'manage_months',
  hpbsDataset,
  onSaveHpbsDataset,
  onResetHpbs,
  onSwitchPeriod,
  isOwner = true,
  onOpenOwnerAuth,
}) => {
  const [activeMode, setActiveMode] = useState<
    'manage_months' | 'add_month' | 'import' | 'export'
  >(initialMode);

  // Add Month Form State
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // Default to September
  const [copyMode, setCopyMode] = useState<'copy_prev' | 'blank'>('copy_prev');
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ParseHpbsDetailedResult | null>(null);
  const [importTargetMonthId, setImportTargetMonthId] = useState<string>('auto');
  const [importMode, setImportMode] = useState<'keep_others' | 'replace_all'>('keep_others');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const periods = hpbsDataset.periods || [];
  const activePeriodId = hpbsDataset.activePeriodId || (periods[0]?.id ?? '2026-09');

  // Handle Add New Month
  const handleAddMonth = (e: React.FormEvent) => {
    e.preventDefault();
    const monthIndex = selectedMonth - 1;
    const monthStr = String(selectedMonth).padStart(2, '0');
    const newPeriodId = `${selectedYear}-${monthStr}`;
    const monthLabel = `${INDO_MONTHS[monthIndex]} ${selectedYear}`;
    const shortLabel = `${INDO_MONTH_SHORT[monthIndex]} ${String(selectedYear).slice(2)}`;

    // Comparison label: e.g. "Sep '26 vs Ags '26"
    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? selectedYear - 1 : selectedYear;
    const prevShortLabel = `${INDO_MONTH_SHORT[prevMonthIndex]} '${String(prevYear).slice(2)}`;
    const comparisonLabel = `${shortLabel} vs ${prevShortLabel}`;

    // Check if period ID already exists
    if (periods.some((p) => p.id === newPeriodId)) {
      setImportError(`Periode ${monthLabel} sudah ada di dalam daftar data.`);
      return;
    }

    // Build records
    let newRecords: HpbsRespondentRecord[] = [];
    const sourceRecords = hpbsDataset.records && hpbsDataset.records.length > 0
      ? hpbsDataset.records
      : periods[0]?.records || [];

    if (copyMode === 'copy_prev' && sourceRecords.length > 0) {
      // Use current prices as N-1 base for the new month
      newRecords = sourceRecords.map((r, idx) => {
        const prevPrice = r.geoCurr > 0 ? r.geoCurr : r.m1Curr || r.m1Prev || 15000;
        const currPrice = prevPrice; // baseline identical (RH = 100) until updated
        return computeRespondentMetrics({
          id: `hpbs_${newPeriodId}_${r.kabKotaId}_${r.kodeKomoditas}_${idx + 1}`,
          responden: r.responden,
          kabKotaId: r.kabKotaId,
          kabKotaName: r.kabKotaName,
          kodeKomoditas: r.kodeKomoditas,
          komoditas: r.komoditas,
          kodeKualitas: r.kodeKualitas,
          kualitas: r.kualitas,
          satuanStandar: r.satuanStandar,
          kuesioner: r.kuesioner,
          m1Prev: Math.round(prevPrice),
          m2Prev: r.kuesioner === 'V-HPBS.2' ? Math.round(prevPrice) : 0,
          m1Curr: Math.round(currPrice),
          m2Curr: r.kuesioner === 'V-HPBS.2' ? Math.round(currPrice) : 0,
          catatanM1: `Inisialisasi data ${monthLabel}`,
          catatanM2: '',
        });
      });
    }

    const newPeriod: HpbsMonthlyPeriod = {
      id: newPeriodId,
      label: monthLabel,
      shortLabel,
      comparisonLabel,
      records: newRecords,
      lastUpdated: new Date().toISOString(),
    };

    const updatedPeriods = [...periods, newPeriod].sort((a, b) => a.id.localeCompare(b.id));

    const updatedDataset: HpbsDataset = {
      ...hpbsDataset,
      activePeriodId: newPeriodId,
      periodTitle: comparisonLabel,
      records: newRecords,
      periods: updatedPeriods,
      lastUpdated: new Date().toISOString(),
      version: hpbsDataset.version ? String(Number(hpbsDataset.version) + 1) : '2.1.0',
    };

    onSaveHpbsDataset(updatedDataset);
    onSwitchPeriod(newPeriodId);
    setAddSuccessMessage(
      `Bulan ${monthLabel} berhasil ditambahkan! Semua data bulan sebelumnya tetap tersimpan rapi.`
    );
    setTimeout(() => {
      setAddSuccessMessage(null);
      setActiveMode('manage_months');
    }, 2000);
  };

  // Handle Delete Month
  const handleDeleteMonth = (periodId: string, label: string) => {
    if (periods.length <= 1) {
      alert('Tidak dapat menghapus bulan terakhir. Minimal harus ada 1 periode data yang tersimpan.');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus data untuk periode "${label}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    const remainingPeriods = periods.filter((p) => p.id !== periodId);
    let nextActiveId = activePeriodId;
    let nextRecords = hpbsDataset.records;
    let nextPeriodTitle = hpbsDataset.periodTitle;

    if (activePeriodId === periodId) {
      const fallback = remainingPeriods[remainingPeriods.length - 1];
      nextActiveId = fallback.id;
      nextRecords = fallback.records;
      nextPeriodTitle = fallback.comparisonLabel;
    }

    const updatedDataset: HpbsDataset = {
      ...hpbsDataset,
      activePeriodId: nextActiveId,
      periodTitle: nextPeriodTitle,
      records: nextRecords,
      periods: remainingPeriods,
      lastUpdated: new Date().toISOString(),
    };

    onSaveHpbsDataset(updatedDataset);
    if (activePeriodId === periodId) {
      onSwitchPeriod(nextActiveId);
    }
  };

  // Process File Select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setImportError(null);
    setImportSuccess(null);
    setParsedImport(null);
    setIsProcessing(true);

    try {
      const buffer = await selected.arrayBuffer();
      const result = parseHpbsExcelDetailed(buffer, selected.name);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Tidak ditemukan baris komoditas atau responden yang valid dalam file Excel ini. Pastikan format kolom sesuai kuesioner V-HPBS.'
        );
      }

      setImportFile(selected);
      setParsedImport(result);

      // Auto-detect target month from title if possible
      const lower = selected.name.toLowerCase();
      let matchedIndex = -1;
      INDO_MONTHS.forEach((m, idx) => {
        if (lower.includes(m.toLowerCase()) || lower.includes(INDO_MONTH_SHORT[idx].toLowerCase())) {
          matchedIndex = idx;
        }
      });

      if (matchedIndex !== -1) {
        const yr = lower.includes('2025') ? '2025' : lower.includes('2024') ? '2024' : '2026';
        const detectedId = `${yr}-${String(matchedIndex + 1).padStart(2, '0')}`;
        setImportTargetMonthId(detectedId);
      } else {
        setImportTargetMonthId('auto');
      }
    } catch (err: any) {
      console.error('Error parsing HPBS Excel:', err);
      setImportError(err.message || 'Gagal membaca file Excel.');
      setImportFile(null);
      setParsedImport(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Import
  const handleApplyImport = () => {
    if (!parsedImport || parsedImport.records.length === 0) {
      setImportError('Silakan pilih file Excel V-HPBS yang valid terlebih dahulu.');
      return;
    }

    const cleanImportedRecords = filterValidHpbsRecords(parsedImport.records);
    if (cleanImportedRecords.length === 0) {
      setImportError('File tidak memiliki baris data komoditas/harga valid (semua baris bernilai 0 atau kosong).');
      return;
    }

    let targetId = importTargetMonthId;
    let targetLabel = '';
    let targetShort = '';
    let targetComp = parsedImport.detectedPeriodTitle || "Ags '26 vs Jul '26";

    if (targetId === 'auto') {
      // Use active period or derive from detected title
      targetId = activePeriodId;
      const activeObj = periods.find((p) => p.id === activePeriodId);
      targetLabel = activeObj?.label || 'Agustus 2026';
      targetShort = activeObj?.shortLabel || 'Ags 26';
      targetComp = activeObj?.comparisonLabel || targetComp;
    } else {
      const found = periods.find((p) => p.id === targetId);
      if (found) {
        targetLabel = found.label;
        targetShort = found.shortLabel;
        targetComp = found.comparisonLabel;
      } else {
        // New period created on the fly
        const [yr, mo] = targetId.split('-');
        const moNum = parseInt(mo, 10);
        targetLabel = `${INDO_MONTHS[moNum - 1]} ${yr}`;
        targetShort = `${INDO_MONTH_SHORT[moNum - 1]} ${yr.slice(2)}`;
        targetComp = `${targetShort} vs Bln Lalu`;
      }
    }

    if (importMode === 'replace_all') {
      // Replace entire dataset with this single period
      const newPeriod: HpbsMonthlyPeriod = {
        id: targetId,
        label: targetLabel,
        shortLabel: targetShort,
        comparisonLabel: targetComp,
        records: cleanImportedRecords,
        lastUpdated: new Date().toISOString(),
      };

      const updatedDataset: HpbsDataset = {
        periodTitle: targetComp,
        records: cleanImportedRecords,
        activePeriodId: targetId,
        periods: [newPeriod],
        lastUpdated: new Date().toISOString(),
        version: '2.1.0',
      };

      onSaveHpbsDataset(updatedDataset);
      onSwitchPeriod(targetId);
      setImportSuccess(
        `Berhasil mengganti seluruh dataset dengan file baru (${cleanImportedRecords.length} baris pencacahan untuk ${targetLabel}).`
      );
    } else {
      // Safe mode: Add or update only this period; keep all others!
      const existingPeriodIdx = periods.findIndex((p) => p.id === targetId);
      let updatedPeriods: HpbsMonthlyPeriod[] = [];

      const newOrUpdatedPeriod: HpbsMonthlyPeriod = {
        id: targetId,
        label: targetLabel,
        shortLabel: targetShort,
        comparisonLabel: targetComp,
        records: cleanImportedRecords,
        lastUpdated: new Date().toISOString(),
      };

      if (existingPeriodIdx >= 0) {
        updatedPeriods = periods.map((p, idx) =>
          idx === existingPeriodIdx ? newOrUpdatedPeriod : p
        );
      } else {
        updatedPeriods = [...periods, newOrUpdatedPeriod].sort((a, b) =>
          a.id.localeCompare(b.id)
        );
      }

      const updatedDataset: HpbsDataset = {
        ...hpbsDataset,
        periodTitle: targetComp,
        records: parsedImport.records,
        activePeriodId: targetId,
        periods: updatedPeriods,
        lastUpdated: new Date().toISOString(),
      };

      onSaveHpbsDataset(updatedDataset);
      onSwitchPeriod(targetId);
      setImportSuccess(
        `Berhasil mengimpor & menyimpan data untuk periode "${targetLabel}" (${parsedImport.records.length} baris data). Semua data bulan lainnya tetap aman tersimpan!`
      );
    }

    // Reset file input
    setImportFile(null);
    setParsedImport(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setTimeout(() => {
      setImportSuccess(null);
      setActiveMode('manage_months');
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Manajemen & Kelola Data Relatif Harga (V-HPBS)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {periods.length} Periode Tersimpan
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tambah bulan baru, unggah file Excel per periode tanpa menghapus data sebelumnya, dan kelola arsip data SHPB.
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

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveMode('manage_months')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeMode === 'manage_months'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Daftar Bulan ({periods.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('add_month')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeMode === 'add_month'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bulan Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('import')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeMode === 'import'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import File Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('export')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeMode === 'export'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Template & Ekspor</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: MANAGE MONTHS */}
          {activeMode === 'manage_months' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">
                    Sistem Database Rutin V-HPBS Kalimantan Barat
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Setiap bulan tersimpan terpisah. Anda dapat menambah bulan baru (misalnya September 2026) atau mengimpor file tanpa menghapus data bulan lainnya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMode('add_month')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Bulan</span>
                </button>
              </div>

              {/* Table of Periods */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <th className="py-3 px-4">Periode Bulan</th>
                      <th className="py-3 px-3">Komparasi Relatif Harga</th>
                      <th className="py-3 px-3 text-center">Jumlah Pencacahan</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periods.map((p) => {
                      const isActive = p.id === activePeriodId;
                      const count = p.records?.length || 0;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isActive ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              <span>{p.label}</span>
                              <span className="text-slate-400 font-mono text-xs font-normal">
                                ({p.id})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Kode: {p.shortLabel}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 font-medium font-mono">
                            {p.comparisonLabel}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-700">
                            {count.toLocaleString('id-ID')} baris
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Sedang Aktif
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Tersimpan</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSwitchPeriod(p.id);
                                  onClose();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                              >
                                Tampilkan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteMonth(p.id, p.label)}
                              title="Hapus periode ini"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ADD NEW MONTH */}
          {activeMode === 'add_month' && (
            <form onSubmit={handleAddMonth} className="space-y-4 max-w-xl mx-auto py-2">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-950">
                <Calendar className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900">
                    Tambah Periode Baru (Misal September 2026):
                  </p>
                  <p className="text-emerald-800 leading-relaxed text-[11.5px]">
                    Bulan yang Anda tambahkan akan otomatis tersimpan sebagai periode baru dalam database V-HPBS tanpa menimpa atau menghapus bulan yang sudah ada.
                  </p>
                </div>
              </div>

              {addSuccessMessage && (
                <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{addSuccessMessage}</span>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tahun</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    {INDO_MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Metode Inisialisasi Data Periode Baru
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="copyMode"
                      checked={copyMode === 'copy_prev'}
                      onChange={() => setCopyMode('copy_prev')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-800">
                        Salin Komoditas & Titik Responden Bulan Sebelumnya (Rekomendasi)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Membuat struktur data 14 Kab/Kota lengkap dengan komoditas yang sama. Harga bulan lalu (N-1) secara otomatis mengambil harga bulan sebelumnya sehingga siap diisi/disesuaikan.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="copyMode"
                      checked={copyMode === 'blank'}
                      onChange={() => setCopyMode('blank')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-800">
                        Siapkan Ruang Periode Kosong Siap Diimpor
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Menyiapkan periode baru tanpa data awal, siap untuk diimpor langsung melalui file Excel.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveMode('manage_months')}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan Periode {INDO_MONTHS[selectedMonth - 1]} {selectedYear}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: IMPORT EXCEL */}
          {activeMode === 'import' && (
            <div className="space-y-4 max-w-2xl mx-auto py-1">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-950">
                <Upload className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900">
                    Import Fleksibel Tanpa Menghapus Data Lain:
                  </p>
                  <p className="text-emerald-800 leading-relaxed text-[11.5px]">
                    Pilih target bulan untuk file yang diunggah. Secara default, sistem akan{' '}
                    <strong>menambahkan/memperbarui bulan tersebut</strong> dan membiarkan data bulan-bulan lainnya tetap utuh dan aman.
                  </p>
                </div>
              </div>

              {importSuccess && (
                <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-800">
                    {importFile ? importFile.name : 'Klik untuk Memilih File Excel V-HPBS (.xlsx / .xls)'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mendukung multi-sheet, format kuesioner V-HPBS.1 bulanan dan V-HPBS.2 mingguan
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Template Download Shortcut */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-slate-600 text-[11.5px]">
                  Belum punya format Excel yang sesuai? Unduh template resmi BPS (18 kolom sesuai standar V-HPBS).
                </span>
                <button
                  type="button"
                  onClick={() => downloadHpbsTemplateExcel(hpbsDataset.records)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg border border-emerald-200 shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Resmi (18 Kolom BPS)</span>
                </button>
              </div>

              {/* Parsed Result Preview */}
              {parsedImport && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-xs text-slate-800">
                      Ringkasan File Terbaca
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Valid
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400 text-[10px] block">Pencacahan</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {parsedImport.records.length}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400 text-[10px] block">Komoditas</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {parsedImport.commodityCount}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400 text-[10px] block">Titik Responden</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {parsedImport.respondentCount}
                      </span>
                    </div>
                  </div>

                  {/* Storage Mode Selection: Replace All vs Append */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                        Pilihan Metode Penyimpanan Dataset:
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-medium">
                        Tentukan perlakuan terhadap data default bawaan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option 1: Replace All */}
                      <label
                        onClick={() => setImportMode('replace_all')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          importMode === 'replace_all'
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="mgmtImportMode"
                            checked={importMode === 'replace_all'}
                            onChange={() => setImportMode('replace_all')}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">
                                Ganti Seluruh Dataset
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                Hapus Bawaan
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              <strong>Hapus semua data default bawaan</strong> dan gantikan sepenuhnya hanya dengan data dari file Anda ini.
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                          <Trash2 className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Data default lama akan dibersihkan digantikan data Anda.</span>
                        </div>
                      </label>

                      {/* Option 2: Keep Others (Append/Update) */}
                      <label
                        onClick={() => setImportMode('keep_others')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          importMode === 'keep_others'
                            ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="mgmtImportMode"
                            checked={importMode === 'keep_others'}
                            onChange={() => setImportMode('keep_others')}
                            className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">
                                Tambahkan Dataset Baru
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                Simpan Data Lain
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              <strong>Pertahankan data bulan lainnya</strong> dan tambahkan data ini sebagai periode baru atau perbarui periode yang aktif.
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>Bulan-bulan survei lainnya tetap tersimpan aman.</span>
                        </div>
                      </label>
                    </div>

                    {/* Period target selector */}
                    <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Terapkan ke Periode Bulan:</span>
                      </label>
                      <select
                        value={importTargetMonthId}
                        onChange={(e) => setImportTargetMonthId(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer sm:w-64"
                      >
                        <option value="auto">
                          Bulan Aktif Saat Ini ({periods.find((p) => p.id === activePeriodId)?.label || activePeriodId})
                        </option>
                        <optgroup label="Periode yang Tersimpan">
                          {periods.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label} ({p.id})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Buat Periode Baru">
                          <option value="2026-09">September 2026 (Baru)</option>
                          <option value="2026-10">Oktober 2026 (Baru)</option>
                          <option value="2026-11">November 2026 (Baru)</option>
                          <option value="2026-12">Desember 2026 (Baru)</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      disabled={isProcessing}
                      className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        importMode === 'replace_all'
                          ? 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-600/30'
                          : 'bg-blue-700 hover:bg-blue-800 ring-2 ring-blue-600/30'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        {importMode === 'replace_all'
                          ? 'Ganti Seluruh Dataset & Terapkan File Saya'
                          : 'Terapkan & Simpan ke Database'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TEMPLATE & EXPORT */}
          {activeMode === 'export' && (
            <div className="space-y-4 max-w-xl mx-auto py-2">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Ekspor Hasil Analisis RH Bulan Ini</span>
                </div>
                <p className="text-xs text-slate-500">
                  Unduh seluruh hasil pengolahan Relatif Harga (RH), rata-rata geometri, status per komoditas, dan matriks 14 Kab/Kota ke dalam format Excel (.xlsx).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    exportHpbsAnalysisToExcel(
                      hpbsDataset.records,
                      hpbsDataset.periodTitle || "Ags '26 vs Jul '26"
                    );
                  }}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Ekspor Analisis RH (.xlsx)</span>
                </button>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Format Template Excel Resmi V-HPBS (18 Kolom BPS)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Template resmi BPS sesuai format standar survei SHPB (18 kolom: Kode Kabupaten/Kota, Kabupaten/Kota, Kode Responden, Responden, Kode Komoditas, Komoditas, Kode Kualitas, Kualitas, satuan_standar, Kuesioner, M1 & M2 N-1 / N, RH, Catatan) dilengkapi sheet petunjuk kamus data.
                </p>
                <button
                  type="button"
                  onClick={() => downloadHpbsTemplateExcel(hpbsDataset.records)}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Unduh Template Resmi V-HPBS (.xlsx)</span>
                </button>
              </div>

              {onResetHpbs && (
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                    <RefreshCw className="w-4 h-4 text-rose-600" />
                    <span>Reset Data ke Standar Awal</span>
                  </div>
                  <p className="text-xs text-rose-600">
                    Mengembalikan data V-HPBS ke data standar resmi 8 periode rutin (Januari s/d Agustus 2026).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Apakah Anda yakin ingin mereset data V-HPBS ke data standar resmi? Data tambahan akan dikembalikan ke kondisi awal.')) {
                        onResetHpbs();
                        onClose();
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 rounded-lg border border-rose-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset ke Data Standar</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Database Mandiri: SHPB / Relatif Harga (V-HPBS)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
