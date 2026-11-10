import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  HelpCircle,
  History,
  RotateCcw,
  Save,
  Store,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { HpbsRespondentRecord } from '../types/hpbs';
import { calculateGeometricMean } from '../utils/hpbsAnalysis';

interface HpbsPriceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: HpbsRespondentRecord | null;
  onSaveAdjustment: (
    recordId: string,
    adjustedData: {
      m1Prev: number;
      m2Prev: number;
      m1Curr: number;
      m2Curr: number;
      adjustmentNote: string;
    }
  ) => void;
  onResetAdjustment?: (recordId: string) => void;
}

export const HpbsPriceAdjustmentModal: React.FC<HpbsPriceAdjustmentModalProps> = ({
  isOpen,
  onClose,
  record,
  onSaveAdjustment,
  onResetAdjustment,
}) => {
  if (!isOpen || !record) return null;

  const isWeekly = record.kuesioner === 'V-HPBS.2';

  const [m1Prev, setM1Prev] = useState<string>(String(record.m1Prev || 0));
  const [m2Prev, setM2Prev] = useState<string>(String(record.m2Prev || 0));
  const [m1Curr, setM1Curr] = useState<string>(String(record.m1Curr || 0));
  const [m2Curr, setM2Curr] = useState<string>(String(record.m2Curr || 0));
  const [adjustmentNote, setAdjustmentNote] = useState<string>(record.adjustmentNote || '');

  // Reset local state whenever record changes
  useEffect(() => {
    if (record) {
      setM1Prev(String(record.m1Prev || 0));
      setM2Prev(String(record.m2Prev || 0));
      setM1Curr(String(record.m1Curr || 0));
      setM2Curr(String(record.m2Curr || 0));
      setAdjustmentNote(record.adjustmentNote || '');
    }
  }, [record]);

  // Real-time recalculation of preview metrics as user changes inputs
  const numM1Prev = parseFloat(m1Prev) || 0;
  const numM2Prev = parseFloat(m2Prev) || 0;
  const numM1Curr = parseFloat(m1Curr) || 0;
  const numM2Curr = parseFloat(m2Curr) || 0;

  let previewGeoPrev = 0;
  let previewGeoCurr = 0;
  let previewRhM1 = 100;
  let previewRhM2 = 100;
  let previewRh = 100;

  if (isWeekly) {
    previewRhM1 = numM1Prev > 0 ? (numM1Curr / numM1Prev) * 100 : 100;
    previewRhM2 = numM2Prev > 0 ? (numM2Curr / numM2Prev) * 100 : 100;
    const prevList = [numM1Prev, numM2Prev].filter((p) => p > 0);
    const currList = [numM1Curr, numM2Curr].filter((p) => p > 0);
    previewGeoPrev = calculateGeometricMean(prevList);
    previewGeoCurr = calculateGeometricMean(currList);
    previewRh = previewGeoPrev > 0 ? (previewGeoCurr / previewGeoPrev) * 100 : 100;
  } else {
    previewRhM1 = numM1Prev > 0 ? (numM1Curr / numM1Prev) * 100 : 100;
    previewRhM2 = 100;
    previewGeoPrev = numM1Prev;
    previewGeoCurr = numM1Curr;
    previewRh = previewRhM1;
  }

  previewRh = parseFloat(previewRh.toFixed(2));
  previewRhM1 = parseFloat(previewRhM1.toFixed(2));
  previewRhM2 = parseFloat(previewRhM2.toFixed(2));

  const previewStatus: 'NAIK' | 'TURUN' | 'STABIL' =
    previewRh >= 100.005 ? 'NAIK' : previewRh <= 99.995 ? 'TURUN' : 'STABIL';

  const rhDelta = previewRh - record.rh;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAdjustment(record.id, {
      m1Prev: numM1Prev,
      m2Prev: numM2Prev,
      m1Curr: numM1Curr,
      m2Curr: numM2Curr,
      adjustmentNote: adjustmentNote.trim(),
    });
    onClose();
  };

  const handleReset = () => {
    if (onResetAdjustment && record.isAdjusted) {
      onResetAdjustment(record.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Penyesuaian (Adjustment) Harga Responden
              </h2>
              <p className="text-xs text-slate-500">
                Koreksi harga pencacahan M1 / M2 — RH dan rata-rata geometri otomatis terhitung seketika
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Identity Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-slate-800 text-sm">{record.responden}</span>
              </div>
              <p className="text-slate-500">
                {record.kabKotaName} &bull; <span className="font-mono text-slate-700">{record.kodeKomoditas}</span>{' '}
                - <span className="font-semibold text-slate-700">{record.komoditas}</span> ({record.satuanStandar})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {record.kuesioner} ({isWeekly ? 'Mingguan' : 'Bulanan'})
              </span>
              {record.isAdjusted && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Telah Di-Adjust
                </span>
              )}
            </div>
          </div>

          {/* Original Values Reference if Adjusted */}
          {record.isAdjusted && record.originalPrices && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <History className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Nilai Awal Sebelum Penyesuaian:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-amber-950">
                  <div>M1(N-1): Rp {record.originalPrices.m1Prev.toLocaleString('id-ID')}</div>
                  {isWeekly && <div>M2(N-1): Rp {record.originalPrices.m2Prev.toLocaleString('id-ID')}</div>}
                  <div>M1(N): Rp {record.originalPrices.m1Curr.toLocaleString('id-ID')}</div>
                  {isWeekly && <div>M2(N): Rp {record.originalPrices.m2Curr.toLocaleString('id-ID')}</div>}
                </div>
                <div className="text-[11px] font-mono">
                  RH Awal: <span className="font-bold">{record.originalPrices.rh.toFixed(2)}</span> ({record.originalPrices.status})
                </div>
              </div>
            </div>
          )}

          {/* Input Grid: Bulan N-1 vs Bulan N */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bulan Sebelumnya (N-1) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Harga Bulan Lalu (N-1)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Basis Pembanding</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  M1 (Minggu 1 / Bulan N-1) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={m1Prev}
                    onChange={(e) => setM1Prev(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>
              </div>

              {isWeekly ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    M2 (Minggu 2 / Bulan N-1) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={m2Prev}
                      onChange={(e) => setM2Prev(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      placeholder="0"
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic pt-2">
                  (Kuesioner V-HPBS.1 hanya memiliki pencacahan 1 kali / M1)
                </div>
              )}

              <div className="pt-1 text-xs text-slate-600 font-mono flex justify-between border-t border-slate-200">
                <span>Rata-rata Geo (N-1):</span>
                <span className="font-bold text-slate-800">
                  Rp {previewGeoPrev.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Bulan Berjalan (N) */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Harga Bulan Berjalan (N)
                </span>
                <span className="text-[10px] text-emerald-700 font-mono">Bulan Aktif</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  M1 (Minggu 1 / Bulan N) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={m1Curr}
                    onChange={(e) => setM1Curr(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-bold text-emerald-900"
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>
              </div>

              {isWeekly ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    M2 (Minggu 2 / Bulan N) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-semibold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={m2Curr}
                      onChange={(e) => setM2Curr(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-bold text-emerald-900"
                      placeholder="0"
                      min="0"
                      step="any"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic pt-2">
                  (Kuesioner V-HPBS.1 hanya memiliki pencacahan 1 kali / M1)
                </div>
              )}

              <div className="pt-1 text-xs text-slate-600 font-mono flex justify-between border-t border-emerald-200">
                <span>Rata-rata Geo (N):</span>
                <span className="font-bold text-emerald-900">
                  Rp {previewGeoCurr.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* REAL-TIME PREVIEW OF RH RESULT */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Live Preview Hasil Relatif Harga (RH)
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                Formula: (GeoMean N / GeoMean N-1) × 100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
                <span className="block text-[10px] text-slate-400">RH Minggu 1</span>
                <span className="text-base font-mono font-bold text-white">
                  {previewRhM1.toFixed(2)}
                </span>
              </div>

              {isWeekly ? (
                <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
                  <span className="block text-[10px] text-slate-400">RH Minggu 2</span>
                  <span className="text-base font-mono font-bold text-white">
                    {previewRhM2.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex items-center justify-center">
                  <span className="text-[11px] text-slate-500">N/A (V-HPBS.1)</span>
                </div>
              )}

              <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
                <span className="block text-[10px] text-slate-400">RH Akhir (Otomatis)</span>
                <span className="text-lg font-mono font-extrabold text-amber-400">
                  {previewRh.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60 flex flex-col items-center justify-center">
                <span className="block text-[10px] text-slate-400 mb-0.5">Status Fluktuasi</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                    previewStatus === 'NAIK'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : previewStatus === 'TURUN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {previewStatus === 'NAIK' && <TrendingUp className="w-3.5 h-3.5" />}
                  {previewStatus === 'TURUN' && <TrendingDown className="w-3.5 h-3.5" />}
                  {previewStatus === 'STABIL' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {previewStatus}
                </span>
              </div>
            </div>

            {/* Difference with current value */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 font-mono text-slate-300">
              <span>RH Sebelumnya di Sistem: <strong className="text-white">{record.rh.toFixed(2)}</strong></span>
              <span>
                Perubahan: {' '}
                <strong className={rhDelta > 0 ? 'text-amber-400' : rhDelta < 0 ? 'text-cyan-400' : 'text-slate-400'}>
                  {rhDelta > 0 ? `+${rhDelta.toFixed(2)}` : rhDelta.toFixed(2)} poin
                </strong>
              </span>
            </div>
          </div>

          {/* Adjustment Reason / Catatan Petugas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Penyesuaian / Catatan Perbaikan Petugas
            </label>
            <textarea
              value={adjustmentNote}
              onChange={(e) => setAdjustmentNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Contoh: Koreksi salah input satuan pedagang / konfirmasi ulang ke pasar ..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            {record.isAdjusted && onResetAdjustment ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan ke Harga Asli</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perbaikan & Auto Hitung RH</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
