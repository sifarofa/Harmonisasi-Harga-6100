import React, { useState, useMemo, useEffect } from 'react';
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
  Coins,
  Store,
  Crown,
  Users,
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import {
  fetchActiveWilayahUsers,
  authenticateWilayahUser,
  WilayahUserRow,
  formatKodeKabKota,
  mapKodeToRegionId,
} from '../lib/supabaseClient';

export interface PortalOption {
  code: string;
  id: string;
  name: string;
  type: 'Provinsi' | 'Kabupaten' | 'Kota';
  role: UserRole;
  agencyName: string;
  sampleScope: string;
}

export const PORTAL_REGION_OPTIONS: PortalOption[] = [
  {
    code: '61.00',
    id: 'all',
    name: 'Provinsi Kalimantan Barat (Admin Provinsi)',
    type: 'Provinsi',
    role: 'admin_provinsi',
    agencyName: 'BPS Provinsi Kalimantan Barat',
    sampleScope: 'Akses Konsolidasi Agregat 14 Kabupaten/Kota se-Kalbar & Manajemen Pengguna',
  },
  {
    code: '61.71',
    id: 'pontianak',
    name: 'Kota Pontianak',
    type: 'Kota',
    role: 'admin_kabkota',
    agencyName: 'BPS Kota Pontianak',
    sampleScope: 'Sampel IHK Konsumen (HK) & Grosir (V-HPBS)',
  },
  {
    code: '61.72',
    id: 'singkawang',
    name: 'Kota Singkawang',
    type: 'Kota',
    role: 'admin_kabkota',
    agencyName: 'BPS Kota Singkawang',
    sampleScope: 'Sampel IHK Konsumen (HK) & Grosir (V-HPBS)',
  },
  {
    code: '61.01',
    id: 'sambas',
    name: 'Kabupaten Sambas',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sambas',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.02',
    id: 'mempawah',
    name: 'Kabupaten Mempawah',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Mempawah',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.03',
    id: 'sanggau',
    name: 'Kabupaten Sanggau',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sanggau',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.04',
    id: 'ketapang',
    name: 'Kabupaten Ketapang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Ketapang',
    sampleScope: 'Sampel Lengkap 4 Level: HD, HKD, V-HPBS, & Sampel Resmi IHK',
  },
  {
    code: '61.05',
    id: 'sintang',
    name: 'Kabupaten Sintang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sintang',
    sampleScope: 'Sampel Lengkap 4 Level: HD, HKD, V-HPBS, & Sampel Resmi IHK',
  },
  {
    code: '61.06',
    id: 'kapuas_hulu',
    name: 'Kabupaten Kapuas Hulu',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kapuas Hulu',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.07',
    id: 'bengkayang',
    name: 'Kabupaten Bengkayang',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Bengkayang',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.08',
    id: 'landak',
    name: 'Kabupaten Landak',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Landak',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.09',
    id: 'sekadau',
    name: 'Kabupaten Sekadau',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Sekadau',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.10',
    id: 'melawi',
    name: 'Kabupaten Melawi',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Melawi',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
  {
    code: '61.11',
    id: 'kayong_utara',
    name: 'Kabupaten Kayong Utara',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kayong Utara',
    sampleScope: 'Sampel Lengkap 4 Level: HD, HKD, V-HPBS, & Sampel Resmi IHK',
  },
  {
    code: '61.12',
    id: 'kubu_raya',
    name: 'Kabupaten Kubu Raya',
    type: 'Kabupaten',
    role: 'admin_kabkota',
    agencyName: 'BPS Kabupaten Kubu Raya',
    sampleScope: 'Sampel Produsen Desa (HD), Konsumen Desa (HKD), & Grosir (V-HPBS)',
  },
];

interface PortalLoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export const PortalLoginPage: React.FC<PortalLoginPageProps> = ({ onLogin }) => {
  // Login Role Tab: 'provinsi' | 'kabkota'
  const [loginMode, setLoginMode] = useState<'provinsi' | 'kabkota'>('provinsi');

  const [dbUsers, setDbUsers] = useState<WilayahUserRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('61.00');
  const [password, setPassword] = useState<string>('prov6100');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch active users from Supabase table `wilayah_users`
  useEffect(() => {
    let isMounted = true;
    async function loadWilayah() {
      const users = await fetchActiveWilayahUsers();
      if (isMounted && users && users.length > 0) {
        setDbUsers(users);
      }
    }
    loadWilayah();
    return () => {
      isMounted = false;
    };
  }, []);

  // When switching login mode, auto-set default code and password
  const handleSwitchMode = (mode: 'provinsi' | 'kabkota') => {
    setLoginMode(mode);
    setErrorMessage('');
    if (mode === 'provinsi') {
      setSelectedCode('61.00');
      const provMatch = dbUsers.find((u) => u.kode_kabkota === '61.00');
      setPassword(provMatch?.token_akses || 'prov6100');
    } else {
      setSelectedCode('61.71');
      const kabMatch = dbUsers.find((u) => u.kode_kabkota === '61.71');
      setPassword(kabMatch?.token_akses || 'bps6171');
    }
  };

  const handleSelectCode = (code: string) => {
    setSelectedCode(code);
    setErrorMessage('');
    const formatted = formatKodeKabKota(code);
    const dbMatch = dbUsers.find((u) => u.kode_kabkota === formatted || u.kode_kabkota === code);
    if (dbMatch?.token_akses) {
      setPassword(dbMatch.token_akses);
    } else if (formatted === '61.00') {
      setPassword('prov6100');
    } else {
      setPassword(`bps${code.replace('.', '')}`);
    }
  };

  const selectedRegion = useMemo(() => {
    const formatted = formatKodeKabKota(selectedCode);
    const clean = selectedCode.replace('.', '');
    return (
      PORTAL_REGION_OPTIONS.find(
        (opt) =>
          opt.code === selectedCode ||
          opt.code === formatted ||
          opt.code.replace('.', '') === clean
      ) || PORTAL_REGION_OPTIONS[0]
    );
  }, [selectedCode]);

  // Submit login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetCode = loginMode === 'provinsi' ? '61.00' : selectedCode;
    if (!targetCode) {
      setErrorMessage('Silakan pilih wilayah.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Silakan masukkan kata sandi / token akses.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Authenticate against Supabase table `wilayah_users`
      const res = await authenticateWilayahUser(targetCode, password);

      if (!res.success || !res.user) {
        setErrorMessage(
          res.error || 'Kata Sandi / Token Akses salah. Periksa kembali token Anda.'
        );
        setIsSubmitting(false);
        return;
      }

      const dbUser = res.user;
      const effectiveRole: UserRole =
        dbUser.role === 'provinsi' ? 'admin_provinsi' : 'admin_kabkota';

      const user: AuthUser = {
        role: effectiveRole,
        regionCode: dbUser.kode_kabkota,
        regionId: mapKodeToRegionId(dbUser.kode_kabkota),
        regionName: dbUser.nama_wilayah,
        regionType:
          dbUser.role === 'provinsi'
            ? 'Provinsi'
            : dbUser.nama_wilayah.toLowerCase().includes('kota')
            ? 'Kota'
            : 'Kabupaten',
        agencyName:
          dbUser.role === 'provinsi'
            ? 'BPS Provinsi Kalimantan Barat'
            : dbUser.nama_wilayah.startsWith('BPS')
            ? dbUser.nama_wilayah
            : `BPS ${dbUser.nama_wilayah}`,
        loginTime: new Date().toISOString(),
      };

      // Simpan sesi user yang sedang login ke sessionStorage
      try {
        sessionStorage.setItem('seharga_auth_user', JSON.stringify(user));
        sessionStorage.setItem('seharga_portal_auth_user', JSON.stringify(user));
      } catch (err) {
        console.warn('SessionStorage save warning:', err);
      }

      if (rememberMe) {
        try {
          localStorage.setItem('seharga_auth_user', JSON.stringify(user));
          localStorage.setItem('seharga_portal_auth_user', JSON.stringify(user));
        } catch (_) {}
      }

      setIsSubmitting(false);
      onLogin(user);
    } catch (err: any) {
      console.error('[PortalLogin] Exception:', err);
      setErrorMessage('Terjadi kendala saat memvalidasi akun ke Supabase.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-white flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950 flex items-center justify-center shrink-0">
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
                BPS KALBAR
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Sistem Evaluasi Statistik &amp; Harmonisasi Harga
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Database Terpusat Supabase Cloud</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left Side: Summary info */}
        <div className="flex-1 space-y-5 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Portal Akses Wilayah Resmi BPS Kalimantan Barat</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Evaluasi &amp; Harmonisasi Harga{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
                14 Kabupaten &amp; Kota
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Sistem akses terpadu berdasarkan tingkat wilayah kerja. Pilih akses login sebagai Admin Provinsi untuk melihat agregat se-Kalbar atau Admin Kab/Kota untuk wilayah masing-masing.
            </p>
          </div>

          {/* Clean 3-Pillar highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg w-fit mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">Harmonisasi 4 Level</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Produsen, Konsumen Desa, Grosir, &amp; Eceran.</p>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="p-2 bg-blue-950 text-blue-400 rounded-lg w-fit mb-2">
                <Coins className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">RH Stabil IHK</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Indeks harga konsumen 5 kota sampel resmi.</p>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="p-2 bg-amber-950 text-amber-400 rounded-lg w-fit mb-2">
                <Store className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">Survei V-HPBS</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">1.968 pedagang besar relatif harga komoditas.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Login Card with Tab Switcher */}
        <div className="w-full max-w-md shrink-0">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 backdrop-blur-xl">
            {/* TAB SELECTOR: ADMIN PROVINSI vs ADMIN KAB/KOTA */}
            <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => handleSwitchMode('provinsi')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMode === 'provinsi'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Admin Provinsi</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode('kabkota')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMode === 'kabkota'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Admin Kab/Kota</span>
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* MODE 1: ADMIN PROVINSI */}
              {loginMode === 'provinsi' ? (
                <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-700/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-600">
                      KODE: 61.00
                    </span>
                    <span className="text-[10px] font-bold text-purple-300">
                      Hak Akses Otoritas Penuh
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    BPS Provinsi Kalimantan Barat
                  </h4>
                  <p className="text-[11px] text-purple-200/80 leading-snug">
                    Rekapitulasi 14 Kabupaten/Kota se-Kalbar, monitoring database terpusat, dan manajemen akun pengguna wilayah.
                  </p>
                </div>
              ) : (
                /* MODE 2: ADMIN KAB/KOTA */
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="portal-select-kabkota"
                      className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pilih Wilayah Kabupaten / Kota</span>
                    </label>

                    <div className="relative">
                      <select
                        id="portal-select-kabkota"
                        value={selectedCode}
                        onChange={(e) => handleSelectCode(e.target.value)}
                        className="w-full pl-3 pr-8 py-2.5 bg-slate-950 text-white font-semibold text-xs rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
                      >
                        <optgroup label="WILAYAH KOTA" className="bg-slate-900 text-blue-400 font-bold">
                          <option value="61.71" className="bg-slate-950 text-slate-100">
                            🏙️ 61.71 - Kota Pontianak
                          </option>
                          <option value="61.72" className="bg-slate-950 text-slate-100">
                            🏙️ 61.72 - Kota Singkawang
                          </option>
                        </optgroup>

                        <optgroup label="WILAYAH KABUPATEN" className="bg-slate-900 text-amber-400 font-bold">
                          <option value="61.01" className="bg-slate-950 text-slate-100">🌾 61.01 - Kabupaten Sambas</option>
                          <option value="61.02" className="bg-slate-950 text-slate-100">🌾 61.02 - Kabupaten Mempawah</option>
                          <option value="61.03" className="bg-slate-950 text-slate-100">🌾 61.03 - Kabupaten Sanggau</option>
                          <option value="61.04" className="bg-slate-950 text-slate-100">🌾 61.04 - Kabupaten Ketapang (Sampel IHK)</option>
                          <option value="61.05" className="bg-slate-950 text-slate-100">🌾 61.05 - Kabupaten Sintang (Sampel IHK)</option>
                          <option value="61.06" className="bg-slate-950 text-slate-100">🌾 61.06 - Kabupaten Kapuas Hulu</option>
                          <option value="61.07" className="bg-slate-950 text-slate-100">🌾 61.07 - Kabupaten Bengkayang</option>
                          <option value="61.08" className="bg-slate-950 text-slate-100">🌾 61.08 - Kabupaten Landak</option>
                          <option value="61.09" className="bg-slate-950 text-slate-100">🌾 61.09 - Kabupaten Sekadau</option>
                          <option value="61.10" className="bg-slate-950 text-slate-100">🌾 61.10 - Kabupaten Melawi</option>
                          <option value="61.11" className="bg-slate-950 text-slate-100">🌾 61.11 - Kabupaten Kayong Utara (Sampel IHK)</option>
                          <option value="61.12" className="bg-slate-950 text-slate-100">🌾 61.12 - Kabupaten Kubu Raya</option>
                        </optgroup>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Clean Indicator */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        KODE: {selectedRegion.code}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedRegion.type}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      {selectedRegion.agencyName}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      ℹ️ {selectedRegion.sampleScope}
                    </p>
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label
                  htmlFor="portal-password-input"
                  className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kata Sandi Akses</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Token: {loginMode === 'provinsi' ? 'prov6100' : `bps${selectedCode.replace('.', '')}`}
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
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950 text-white text-xs rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Ingat sesi di perangkat ini</span>
                </label>
                <span className="text-[11px] text-slate-400 italic">Sesi aman SSL</span>
              </div>

              {/* Error */}
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
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Menghubungkan Wilayah...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {loginMode === 'provinsi'
                        ? 'Masuk sebagai Admin Provinsi'
                        : `Masuk sebagai Admin ${selectedRegion.name}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access */}
            <div className="mt-4 pt-4 border-t border-slate-800 text-center">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">
                ⚡ Akses Cepat Evaluasi:
              </span>
              <div className="flex justify-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleSwitchMode('provinsi');
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    loginMode === 'provinsi'
                      ? 'bg-purple-700 text-white border-purple-500'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  👑 Admin Provinsi (61.00)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchMode('kabkota');
                    handleSelectCode('61.71');
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    loginMode === 'kabkota' && selectedCode === '61.71'
                      ? 'bg-blue-700 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  🏙️ Kota Pontianak (61.71)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchMode('kabkota');
                    handleSelectCode('61.01');
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    loginMode === 'kabkota' && selectedCode === '61.01'
                      ? 'bg-amber-700 text-white border-amber-500'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  🌾 Kab. Sambas (61.01)
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3 text-center text-[11px] text-slate-400">
        <p>
          Portal Resmi SEHARGA • Badan Pusat Statistik Provinsi Kalimantan Barat • Kerahasiaan data dilindungi UU No. 16 Tahun 1997
        </p>
      </footer>
    </div>
  );
};
