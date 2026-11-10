import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Key,
  Lock,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetActionName?: string;
}

const DEFAULT_OWNER_EMAIL = 'sifarofatunnisa24@gmail.com';
const VALID_PINS = ['owner123', 'admin123', 'bps2024', '123456'];

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetActionName,
}) => {
  const [email, setEmail] = useState(DEFAULT_OWNER_EMAIL);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Verification check: matches owner email, or valid PIN/password, or quick owner pass
    if (
      cleanEmail === DEFAULT_OWNER_EMAIL &&
      (cleanPin === '' || VALID_PINS.includes(cleanPin) || cleanPin === 'owner123')
    ) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setPin('');
        onSuccess();
      }, 500);
      return;
    }

    if (VALID_PINS.includes(cleanPin)) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setPin('');
        onSuccess();
      }, 500);
      return;
    }

    setError('PIN atau kredensial Owner tidak sesuai. Silakan gunakan PIN "owner123" atau verifikasi dengan email Owner terdaftar.');
  };

  const handleQuickUnlock = () => {
    setEmail(DEFAULT_OWNER_EMAIL);
    setPin('owner123');
    setError(null);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setPin('');
      onSuccess();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>Autentikasi Akses Owner</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Hak akses terbatas data master & import
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {targetActionName && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-relaxed">
                Fitur <strong className="font-semibold text-amber-900">"{targetActionName}"</strong> hanya dapat diakses oleh Owner / Penanggung Jawab data.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Verifikasi Owner Berhasil! Membuka akses...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Owner Terdaftar
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@bps.go.id"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  Owner
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Email owner terverifikasi: <span className="font-semibold text-slate-600">{DEFAULT_OWNER_EMAIL}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN / Password Owner
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ketik PIN (default: owner123)"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span>PIN default untuk demonstrasi: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-bold">owner123</code></span>
              </p>
            </div>

            {/* Quick 1-Click Verification for Owner */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleQuickUnlock}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Masuk Cepat sebagai {DEFAULT_OWNER_EMAIL}</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verifikasi & Masuk</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
