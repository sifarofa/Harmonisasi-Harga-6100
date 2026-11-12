import React, { useState, useMemo } from 'react';
import {
  Shield,
  Building2,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
  BarChart3,
  Coins,
  Store,
  Info,
  HelpCircle,
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { DEFAULT_REGIONS } from '../data/initialData';

export interface PortalOption {
  code: string;
  id: string; // 'all' or regionId
  name: string;
  type: 'Provinsi' | 'Kabupaten' | 'Kota';
  role: UserRole;
  agencyName: string;
  tpidName: string;
  sampleScope: string;
  sampleTags: string[];
}

export const PORTAL_REGION_OPTIONS: PortalOption[] = [
  {
    code: '6100',
    id: 'all',
    name: 'Provinsi Kalimantan Barat (Akses Seluruh Wilayah)',
    type: 'Provinsi',
    role: 'admin_provinsi',
    agencyName: 'BPS Provinsi Kalimantan Barat',
    tpidName: 'Sekretariat TPID Provinsi Kalimantan Barat',
    sampleScope: 'Akses Otoritas Penuh: Rekapitulasi 14 Kabupaten/Kota se-Kalbar & Manajemen Database',
    sampleTags: ['Super Admin', '14 Kab/Kota', 'Rekap Provinsi', 'Akses Penuh'],
  },
  {
    code: '6171',
    id: 'pontianak',
    name: 'Kota Pontianak',
    type: 'Kota',
    role: 'admin_kabkota',
    agencyName: 'BPS Kota Pontianak',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kota Pontianak',
    sampleScope: 'Sampel Resmi IHK Konsumen (HK) & Perdagangan Besar (V-HPBS Grosir). Non-sampel perdesaan HD/HKD.',
    sampleTags: ['Kota Administratif', 'Sampel IHK', 'V-HPBS Grosir'],
  },
  {
    code: '6172',
    id: 'singkawang',
    name: 'Kota Singkawang',
    type: 'Kota',
    role: 'admin_kabkota',
    agencyName: 'BPS Kota Singkawang',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kota Singkawang',
    sampleScope: 'Sampel Resmi IHK Konsumen (HK) & Perdagangan Besar (V-HPBS Grosir). Non-sampel perdesaan HD/HKD.',
    sampleTags: ['Kota Administratif', 'Sampel IHK', 'V-HPBS Grosir'],
  },
  {
    code: '6101',
    id: 'sambas',
    name: 'Kabupaten Sambas',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sambas',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Sambas',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6102',
    id: 'bengkayang',
    name: 'Kabupaten Bengkayang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Bengkayang',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Bengkayang',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6103',
    id: 'landak',
    name: 'Kabupaten Landak',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Landak',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Landak',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6104',
    id: 'mempawah',
    name: 'Kabupaten Mempawah',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Mempawah',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Mempawah',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6105',
    id: 'sanggau',
    name: 'Kabupaten Sanggau',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sanggau',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Sanggau',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6106',
    id: 'ketapang',
    name: 'Kabupaten Ketapang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Ketapang',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Ketapang',
    sampleScope: 'Sampel Lengkap 4 Level: Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), V-HPBS, & Sampel Resmi IHK.',
    sampleTags: ['Kabupaten', 'Sampel Lengkap 4 Level', 'Sampel IHK', 'V-HPBS'],
  },
  {
    code: '6107',
    id: 'sintang',
    name: 'Kabupaten Sintang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sintang',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Sintang',
    sampleScope: 'Sampel Lengkap 4 Level: Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), V-HPBS, & Sampel Resmi IHK.',
    sampleTags: ['Kabupaten', 'Sampel Lengkap 4 Level', 'Sampel IHK', 'V-HPBS'],
  },
  {
    code: '6108',
    id: 'kapuas_hulu',
    name: 'Kabupaten Kapuas Hulu',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kapuas Hulu',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Kapuas Hulu',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6109',
    id: 'sekadau',
    name: 'Kabupaten Sekadau',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sekadau',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Sekadau',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6110',
    id: 'melawi',
    name: 'Kabupaten Melawi',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Melawi',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Melawi',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
  {
    code: '6111',
    id: 'kayong_utara',
    name: 'Kabupaten Kayong Utara',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kayong Utara',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Kayong Utara',
    sampleScope: 'Sampel Lengkap 4 Level: Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), V-HPBS, & Sampel Resmi IHK.',
    sampleTags: ['Kabupaten', 'Sampel Lengkap 4 Level', 'Sampel IHK', 'V-HPBS'],
  },
  {
    code: '6112',
    id: 'kubu_raya',
    name: 'Kabupaten Kubu Raya',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kubu Raya',
    tpidName: 'Tim Pengendali Inflasi Daerah (TPID) Kabupaten Kubu Raya',
    sampleScope: 'Sampel Produsen Perdesaan (HD), Konsumen Perdesaan (HKD), dan Perdagangan Besar (V-HPBS).',
    sampleTags: ['Kabupaten', 'Produsen Desa (HD)', 'Konsumen Desa (HKD)', 'V-HPBS'],
  },
];

interface PortalLoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export const PortalLoginPage: React.FC<PortalLoginPageProps> = ({ onLogin }) => {
  const [selectedCode, setSelectedCode] = useState<string>('6171'); // Default: Kota Pontianak
  const [password, setPassword] = useState<string>('bps6171');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Automatically find the selected region option
  const selectedRegion = useMemo(() => {
    return PORTAL_REGION_OPTIONS.find((opt) => opt.code === selectedCode) || PORTAL_REGION_OPTIONS[1];
  }, [selectedCode]);

  const handleSelectCode = (code: string) => {
    setSelectedCode(code);
    setErrorMessage('');
    // Auto-prefill intuitive password hint for seamless evaluation
    if (code === '6100') {
      setPassword('bps6100');
    } else {
      setPassword(`bps${code}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedCode) {
      setErrorMessage('Silakan pilih Kode Kabupaten/Kota atau Admin Provinsi.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Silakan masukkan kata sandi instansi.');
      return;
    }

    setIsSubmitting(true);

    // Simulate authentic verification
    setTimeout(() => {
      const user: AuthUser = {
        role: selectedRegion.role,
        regionCode: selectedRegion.code,
        regionId: selectedRegion.id,
        regionName: selectedRegion.name,
        regionType: selectedRegion.type,
        agencyName: selectedRegion.agencyName,
        loginTime: new Date().toISOString(),
      };

      if (rememberMe) {
        try {
          localStorage.setItem('seharga_auth_user', JSON.stringify(user));
        } catch (_) {}
      } else {
        try {
          sessionStorage.setItem('seharga_auth_user', JSON.stringify(user));
        } catch (_) {}
      }

      setIsSubmitting(false);
      onLogin(user);
    }, 450);
  };

  // Quick Demo Buttons Helper
  const handleQuickDemo = (code: string) => {
    handleSelectCode(code);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-between text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-full bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Top Government Portal Header */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-lg shadow-emerald-900/30 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                PORTAL SEHARGA
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                PROV. KALBAR
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Sistem Evaluasi Statistik &amp; Harmonisasi Harga
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>BPS Provinsi Kalimantan Barat</span>
        </div>
      </header>

      {/* Main Content: Two Columns on Desktop */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left Column: Institutional Value & Overview */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sistem Akses Terpadu Berbasis Wilayah Kerja BPS</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Portal Akses Statistik Harga Terpadu{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
                14 Kabupaten &amp; Kota
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Gerbang masuk resmi bagi Badan Pusat Statistik (BPS) dan Tim Pengendali Inflasi Daerah (TPID) di Kalimantan Barat. Akses otomatis menyesuaikan data, indikator stabilitas, serta cakupan survei sesuai wilayah yang Anda pilih.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto lg:mx-0">
            <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-xl flex items-start gap-3 backdrop-blur-xs">
              <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/50 shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Harmonisasi 4 Level</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Transmisi Produsen Desa (HD), Konsumen Desa (HKD), Grosir (HPB), dan Eceran (HK).
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-xl flex items-start gap-3 backdrop-blur-xs">
              <div className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800/50 shrink-0 mt-0.5">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Analisis RH Stabil IHK</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Indeks harga 5 kota sampel IHK (Pontianak, Singkawang, Sintang, Ketapang, Kayong Utara).
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-xl flex items-start gap-3 backdrop-blur-xs">
              <div className="p-2 bg-amber-950 text-amber-400 rounded-lg border border-amber-800/50 shrink-0 mt-0.5">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Survei V-HPBS Grosir</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Pemantauan 1.968 pedagang besar relatif harga komoditas strategis se-Kalbar.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800/90 rounded-xl flex items-start gap-3 backdrop-blur-xs">
              <div className="p-2 bg-purple-950 text-purple-400 rounded-lg border border-purple-800/50 shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Hak Akses Instansi</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Dashboard spesifik tiap Kab/Kota serta opsi Komando Pusat untuk Admin Provinsi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Institutional Login Card */}
        <div className="w-full max-w-md shrink-0">
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl shadow-black/60 p-5 sm:p-7 backdrop-blur-xl relative">
            {/* Top Badge of the Form */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Form Masuk Portal Wilayah
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                Akses Terproteksi
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. INPUT / DROPDOWN KODE KAB/KOTA */}
              <div>
                <label
                  htmlFor="portal-region-select"
                  className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pilih Kode &amp; Nama Wilayah</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    14 Kab/Kota &amp; Provinsi
                  </span>
                </label>

                <div className="relative">
                  <select
                    id="portal-region-select"
                    value={selectedCode}
                    onChange={(e) => handleSelectCode(e.target.value)}
                    className="w-full pl-3 pr-9 py-2.5 bg-slate-950 text-white font-semibold text-xs rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all cursor-pointer appearance-none shadow-inner"
                  >
                    <optgroup label="AKSES KOMANDO PUSAT PROVINSI" className="bg-slate-900 font-bold text-emerald-400">
                      <option value="6100" className="bg-slate-950 text-emerald-300 font-bold">
                        👑 6100 - Admin Provinsi Kalimantan Barat (Akses Seluruh Wilayah)
                      </option>
                    </optgroup>

                    <optgroup label="WILAYAH KOTA" className="bg-slate-900 font-bold text-blue-400">
                      <option value="6171" className="bg-slate-950 text-slate-100">
                        🏙️ 6171 - Kota Pontianak
                      </option>
                      <option value="6172" className="bg-slate-950 text-slate-100">
                        🏙️ 6172 - Kota Singkawang
                      </option>
                    </optgroup>

                    <optgroup label="WILAYAH KABUPATEN" className="bg-slate-900 font-bold text-amber-400">
                      <option value="6101" className="bg-slate-950 text-slate-100">🌾 6101 - Kabupaten Sambas</option>
                      <option value="6102" className="bg-slate-950 text-slate-100">🌾 6102 - Kabupaten Bengkayang</option>
                      <option value="6103" className="bg-slate-950 text-slate-100">🌾 6103 - Kabupaten Landak</option>
                      <option value="6104" className="bg-slate-950 text-slate-100">🌾 6104 - Kabupaten Mempawah</option>
                      <option value="6105" className="bg-slate-950 text-slate-100">🌾 6105 - Kabupaten Sanggau</option>
                      <option value="6106" className="bg-slate-950 text-slate-100">🌾 6106 - Kabupaten Ketapang (Sampel IHK)</option>
                      <option value="6107" className="bg-slate-950 text-slate-100">🌾 6107 - Kabupaten Sintang (Sampel IHK)</option>
                      <option value="6108" className="bg-slate-950 text-slate-100">🌾 6108 - Kabupaten Kapuas Hulu</option>
                      <option value="6109" className="bg-slate-950 text-slate-100">🌾 6109 - Kabupaten Sekadau</option>
                      <option value="6110" className="bg-slate-950 text-slate-100">🌾 6110 - Kabupaten Melawi</option>
                      <option value="6111" className="bg-slate-950 text-slate-100">🌾 6111 - Kabupaten Kayong Utara (Sampel IHK)</option>
                      <option value="6112" className="bg-slate-950 text-slate-100">🌾 6112 - Kabupaten Kubu Raya</option>
                    </optgroup>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              </div>

              {/* 2. DYNAMIC REGION INDICATOR CARD ("Ketika kode dipilih, muncul indikator nama wilayah secara otomatis") */}
              {selectedRegion && (
                <div
                  id="portal-region-indicator"
                  className={`p-3.5 rounded-xl border transition-all animate-fadeIn ${
                    selectedRegion.role === 'admin_provinsi'
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-100 shadow-md shadow-emerald-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                          selectedRegion.role === 'admin_provinsi'
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-emerald-900/80 text-emerald-300 border border-emerald-700/60'
                        }`}
                      >
                        KODE: {selectedRegion.code}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {selectedRegion.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Terverifikasi BPS</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-extrabold text-white tracking-tight">
                    {selectedRegion.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Instansi Kerja: <strong className="text-slate-200">{selectedRegion.agencyName}</strong>
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-800/80">
                    <p className="text-[11px] text-slate-300 leading-snug">
                      ℹ️ {selectedRegion.sampleScope}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedRegion.sampleTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. INPUT PASSWORD */}
              <div>
                <label
                  htmlFor="portal-password-input"
                  className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kata Sandi Akses</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Demo: bps{selectedCode} / kalbar2026
                  </span>
                </label>

                <div className="relative">
                  <input
                    id="portal-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950 text-white text-xs rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs text-slate-300 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Ingat sesi di perangkat ini</span>
                </label>

                <span className="text-[11px] text-slate-400 italic">
                  Sesi aman SSL
                </span>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-portal-login-submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Menghubungkan Wilayah...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard {selectedRegion?.type === 'Provinsi' ? 'Provinsi' : selectedRegion?.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Pills */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                ⚡ Akses Cepat / Demo Evaluasi (1-Klik):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('6171')}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    selectedCode === '6171'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  🏙️ Kota Pontianak (6171)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('6101')}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    selectedCode === '6101'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  🌾 Kab. Sambas (6101)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('6100')}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    selectedCode === '6100'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  👑 Admin Provinsi (6100)
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Legal & Security */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3 text-center text-[11px] text-slate-400">
        <p>
          Portal Resmi SEHARGA • Badan Pusat Statistik Provinsi Kalimantan Barat • Kerahasiaan data statistik dilindungi UU No. 16 Tahun 1997
        </p>
      </footer>
    </div>
  );
};
