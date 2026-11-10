import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  FilePlus,
  FileSpreadsheet,
  Info,
  Layers,
  MapPin,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { HpbsRespondentRecord } from '../types/hpbs';
import {
  downloadHpbsTemplateExcel,
  ParseHpbsDetailedResult,
  parseHpbsExcelDetailed,
} from '../utils/hpbsAnalysis';

export type HpbsImportMode = 'replace_all' | 'append';

export interface HpbsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    records: HpbsRespondentRecord[],
    detectedPeriod?: string,
    mode?: HpbsImportMode,
    customPeriodId?: string,
    customPeriodLabel?: string
  ) => void;
  sampleRecords: HpbsRespondentRecord[];
  existingPeriods?: { id: string; label: string }[];
  activePeriodId?: string;
}

export const HpbsImportModal: React.FC<HpbsImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  sampleRecords,
  existingPeriods = [],
  activePeriodId = '2026-09',
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [detailedResult, setDetailedResult] = useState<ParseHpbsDetailedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<HpbsImportMode>('replace_all');
  const [customPeriodLabel, setCustomPeriodLabel] = useState<string>('');
  const [targetPeriodOption, setTargetPeriodOption] = useState<string>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const derivePeriodId = (label: string): string => {
    const clean = label.toLowerCase();
    const yearMatch = clean.match(/20\d\d/);
    const year = yearMatch ? yearMatch[0] : '2026';

    const months = [
      { num: '01', names: ['jan', 'januari'] },
      { num: '02', names: ['feb', 'februari'] },
      { num: '03', names: ['mar', 'maret'] },
      { num: '04', names: ['apr', 'april'] },
      { num: '05', names: ['mei', 'may'] },
      { num: '06', names: ['jun', 'juni'] },
      { num: '07', names: ['jul', 'juli'] },
      { num: '08', names: ['ags', 'agustus', 'agu', 'aug'] },
      { num: '09', names: ['sep', 'september'] },
      { num: '10', names: ['okt', 'oktober', 'oct'] },
      { num: '11', names: ['nov', 'november'] },
      { num: '12', names: ['des', 'desember', 'dec'] },
    ];

    for (const m of months) {
      if (m.names.some((name) => clean.includes(name))) {
        return `${year}-${m.num}`;
      }
    }
    return `${year}-08`;
  };

  const handleFileProcess = async (selectedFile: File) => {
    setErrorMsg(null);
    setDetailedResult(null);
    setIsLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const fileName = selectedFile?.name || 'V-HPBS.xlsx';
      const result = parseHpbsExcelDetailed(buffer, fileName);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Tidak ditemukan baris komoditas atau pedagang yang valid di file Excel ini. ' +
            'Pastikan file memiliki kolom nama komoditas/responden dan kolom harga (M1/M2 atau Harga Bulan Lalu & Sekarang).'
        );
      }

      setFile(selectedFile);
      setDetailedResult(result);
      if (result.detectedPeriodTitle) {
        setCustomPeriodLabel(result.detectedPeriodTitle);
      } else {
        const fallback =
          existingPeriods.find((p) => p.id === activePeriodId)?.label || 'Agustus 2026';
        setCustomPeriodLabel(fallback);
      }
    } catch (err: any) {
      console.error('Error parsing Excel:', err);
      setErrorMsg(err.message || 'Gagal membaca file Excel.');
      setFile(null);
      setDetailedResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (detailedResult && detailedResult.records.length > 0) {
      let finalLabel = customPeriodLabel.trim();
      if (!finalLabel) {
        finalLabel = detailedResult.detectedPeriodTitle || 'Agustus 2026';
      }

      let finalId = activePeriodId;
      if (targetPeriodOption !== 'auto') {
        finalId = targetPeriodOption;
      } else {
        finalId = derivePeriodId(finalLabel);
      }

      onImportSuccess(
        detailedResult.records,
        finalLabel,
        importMode,
        finalId,
        finalLabel
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Import File Excel SHPB / V-HPBS
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Menu Khusus SHPB
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Survei Harga Perdagangan Besar Sektoral (V-HPBS.1 Bulanan & V-HPBS.2 Mingguan) 14 Kab/Kota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Format & Separation Notice */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-950">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900">
                Data SHPB Dikelola Mandiri (Terpisah Antar Menu):
              </p>
              <p className="text-emerald-800 leading-relaxed text-[11.5px]">
                Mengimpor data di sini <strong>hanya memperbarui database SHPB / Relatif Harga (RH)</strong> dan tidak mempengaruhi data Harmonisasi Rantai Pasok (4 level) maupun IHK Konsumen.
              </p>
              <p className="text-emerald-700 text-[11px]">
                Mendukung multi-sheet otomatis, baris kop/judul di bagian atas, format numerik maupun teks Rupiah (misal <code>Rp 14.500</code>), serta kuesioner bulanan (V-HPBS.1) & mingguan (V-HPBS.2).
              </p>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              {file ? file.name : 'Tarik & Letakkan file Excel (.xlsx / .xls) di sini'}
            </p>
            <p className="text-xs text-slate-500">
              atau klik untuk memilih file dari komputer atau handphone Anda
            </p>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Gagal Membaca File:</span>
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Success Preview & Verification */}
          {detailedResult && detailedResult.records.length > 0 && (
            <div className="space-y-3">
              {/* Summary Stats Card */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>File Terbaca Sempurna! ({detailedResult.records.length} data responden)</span>
                  </div>
                  {detailedResult.detectedPeriodTitle && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-200/80 text-emerald-900">
                      Periode Terdeteksi: {detailedResult.detectedPeriodTitle}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1 font-medium text-slate-700">
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="block text-slate-400 text-[10px]">Total Baris</span>
                    <span className="text-sm font-bold text-slate-800">{detailedResult.records.length}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="block text-slate-400 text-[10px]">Cakupan Wilayah</span>
                    <span className="text-sm font-bold text-slate-800">
                      {detailedResult.detectedRegions.length} Kab/Kota
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="block text-slate-400 text-[10px]">V-HPBS.1 (Bulanan)</span>
                    <span className="text-sm font-bold text-blue-700">
                      {detailedResult.records.filter((r) => r.kuesioner === 'V-HPBS.1').length}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="block text-slate-400 text-[10px]">V-HPBS.2 (Mingguan)</span>
                    <span className="text-sm font-bold text-purple-700">
                      {detailedResult.records.filter((r) => r.kuesioner === 'V-HPBS.2').length}
                    </span>
                  </div>
                </div>

                {/* Sheets info */}
                {detailedResult.sheetDetails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-emerald-800">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold">Sheet yang diproses:</span>
                    {detailedResult.sheetDetails.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white border border-emerald-200 font-mono text-[10.5px]"
                      >
                        {s.sheetName} ({s.recordCount} baris)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mode Selection: Replace All vs Append */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                    Pilihan Metode Penyimpanan Data:
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
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
                        name="hpbsImportMode"
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
                            Hapus Data Bawaan
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <strong>Hapus semua data bawaan/default</strong> dan gantikan sepenuhnya hanya dengan data dari file Anda ini.
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                      <Trash2 className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Data survei default akan dibersihkan digantikan data Anda.</span>
                    </div>
                  </label>

                  {/* Option 2: Append */}
                  <label
                    onClick={() => setImportMode('append')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      importMode === 'append'
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="hpbsImportMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
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
                          <strong>Pertahankan data periode lain</strong> yang tersimpan dan tambahkan data ini sebagai periode survei baru.
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                      <FilePlus className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>Data bulan lainnya tetap aman di arsip riwayat.</span>
                    </div>
                  </label>
                </div>

                {/* Target Period Customization */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-semibold text-slate-700">Nama Periode Survei:</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={customPeriodLabel}
                      onChange={(e) => setCustomPeriodLabel(e.target.value)}
                      placeholder="Mis: Agustus 2026"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden w-full sm:w-60"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Pratinjau 5 Data Pertama (Hasil Kalkulasi RH Otomatis):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Menampilkan 5 dari {detailedResult.records.length} data
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3">Responden</th>
                        <th className="py-2 px-2.5">Wilayah</th>
                        <th className="py-2 px-2.5">Komoditas</th>
                        <th className="py-2 px-2 text-center">Tipe</th>
                        <th className="py-2 px-2.5 text-right">Rata2 N-1</th>
                        <th className="py-2 px-2.5 text-right">Rata2 N</th>
                        <th className="py-2 px-2.5 text-right font-bold text-emerald-900">RH</th>
                        <th className="py-2 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailedResult.records.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {r.responden}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                            {r.kabKotaName}
                          </td>
                          <td className="py-2 px-2.5 text-slate-800 font-medium whitespace-nowrap">
                            {r.komoditas}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.kuesioner === 'V-HPBS.2'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {r.kuesioner}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                            Rp {r.geoPrev.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-900 font-semibold">
                            Rp {r.geoCurr.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-900">
                            {r.rh.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'NAIK'
                                  ? 'bg-rose-100 text-rose-800'
                                  : r.status === 'TURUN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {r.status === 'NAIK' ? (
                                <TrendingUp className="w-2.5 h-2.5" />
                              ) : r.status === 'TURUN' ? (
                                <TrendingDown className="w-2.5 h-2.5" />
                              ) : null}
                              <span>{r.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Download Template Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Format baku BPS 18 kolom: Kode Kabupaten/Kota, Kabupaten/Kota, Kode Responden, Responden, Kode Komoditas, Komoditas, Kode Kualitas, Kualitas, satuan_standar, Kuesioner, M1 & M2 (N-1 / N), RH, Catatan.
            </span>
            <button
              type="button"
              onClick={() => downloadHpbsTemplateExcel(sampleRecords)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template Resmi V-HPBS (18 Kolom BPS)</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2.5">
          <div className="text-xs text-slate-500">
            {detailedResult ? (
              <span className="text-emerald-700 font-semibold">
                ✓ Siap disimpan ke dashboard SHPB
              </span>
            ) : (
              <span>Pilih file Excel untuk memulai verifikasi data</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!detailedResult || detailedResult.records.length === 0 || isLoading}
              onClick={handleApply}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                importMode === 'replace_all'
                  ? 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-600/30'
                  : 'bg-blue-700 hover:bg-blue-800 ring-2 ring-blue-600/30'
              }`}
            >
              {isLoading ? (
                <span>Memproses...</span>
              ) : importMode === 'replace_all' ? (
                <span>Ganti Seluruh Dataset & Terapkan File Saya</span>
              ) : (
                <span>Tambahkan ke Dataset Baru</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

