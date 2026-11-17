import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  KeyRound,
  Users,
  Building2,
  MapPin,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Lock,
  UserCheck,
  UserX,
  Save,
  AlertCircle,
} from 'lucide-react';
import { AuthUser } from '../types';
import {
  fetchAllWilayahUsers,
  updateWilayahUser,
  saveWilayahUser,
  WilayahUserRow,
  formatKodeKabKota,
} from '../lib/supabaseClient';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
}) => {
  const isProvinsi = currentUser.role === 'admin_provinsi';

  const [users, setUsers] = useState<WilayahUserRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Edit / Change Token State
  const [editingKode, setEditingKode] = useState<string | null>(null);
  const [newTokenAkses, setNewTokenAkses] = useState<string>('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Kab/Kota Change Password Form
  const [currentPassInput, setCurrentPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [showKabKotaPass, setShowKabKotaPass] = useState<boolean>(false);

  // Add New User Form (Provinsi only)
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [newKode, setNewKode] = useState<string>('');
  const [newNama, setNewNama] = useState<string>('');
  const [newRole, setNewRole] = useState<'provinsi' | 'kabkota'>('kabkota');
  const [newToken, setNewToken] = useState<string>('');

  // Load users from Supabase
  const loadUsers = async () => {
    setIsLoading(true);
    const data = await fetchAllWilayahUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setEditingKode(null);
      setNewTokenAkses('');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setIsAddUserOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowPassword = (kode: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [kode]: !prev[kode],
    }));
  };

  // Admin Provinsi: Quick update token
  const handleSaveToken = async (kode: string) => {
    if (!newTokenAkses.trim()) {
      onShowToast('Token akses tidak boleh kosong.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await updateWilayahUser(kode, { token_akses: newTokenAkses.trim() });
    setIsSaving(false);

    if (res.success) {
      onShowToast(`✓ Token akses untuk wilayah ${kode} berhasil diperbarui di Supabase!`, 'success');
      setEditingKode(null);
      setNewTokenAkses('');
      loadUsers();
    } else {
      onShowToast(`Gagal memperbarui token: ${res.error}`, 'error');
    }
  };

  // Admin Provinsi: Toggle user active status
  const handleToggleActive = async (user: WilayahUserRow) => {
    if (user.kode_kabkota === '61.00') {
      onShowToast('Akun Admin Provinsi wajib selalu aktif.', 'info');
      return;
    }

    const nextStatus = !user.is_active;
    setIsSaving(true);
    const res = await updateWilayahUser(user.kode_kabkota, { is_active: nextStatus });
    setIsSaving(false);

    if (res.success) {
      onShowToast(
        `✓ Status akun ${user.nama_wilayah} diubah menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}.`,
        'success'
      );
      loadUsers();
    } else {
      onShowToast(`Gagal mengubah status: ${res.error}`, 'error');
    }
  };

  // Admin Provinsi: Add new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKode.trim() || !newNama.trim() || !newToken.trim()) {
      onShowToast('Harap isi semua bidang akun baru.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await saveWilayahUser({
      kode_kabkota: formatKodeKabKota(newKode.trim()),
      nama_wilayah: newNama.trim(),
      role: newRole,
      token_akses: newToken.trim(),
      is_active: true,
    });
    setIsSaving(false);

    if (res.success) {
      onShowToast(`✓ Akun wilayah ${newNama} berhasil ditambahkan ke Supabase!`, 'success');
      setIsAddUserOpen(false);
      setNewKode('');
      setNewNama('');
      setNewToken('');
      loadUsers();
    } else {
      onShowToast(`Gagal menambahkan akun: ${res.error}`, 'error');
    }
  };

  // Admin Kab/Kota: Change own password
  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassInput.trim()) {
      onShowToast('Kata sandi baru tidak boleh kosong.', 'error');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      onShowToast('Konfirmasi kata sandi tidak cocok.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await updateWilayahUser(currentUser.regionCode, {
      token_akses: newPassInput.trim(),
    });
    setIsSaving(false);

    if (res.success) {
      onShowToast(
        `✓ Kata sandi akses wilayah ${currentUser.regionName} berhasil diubah!`,
        'success'
      );
      setNewPassInput('');
      setConfirmPassInput('');
      setCurrentPassInput('');
      loadUsers();
    } else {
      onShowToast(`Gagal memperbarui kata sandi: ${res.error}`, 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      u.kode_kabkota.toLowerCase().includes(q) ||
      u.nama_wilayah.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-scaleIn my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/30 rounded-xl text-emerald-400 border border-emerald-500/30">
              {isProvinsi ? <Users className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isProvinsi ? 'Manajemen Pengguna Wilayah (14 Kab/Kota)' : 'Keamanan & Kata Sandi Akun Wilayah'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Supabase DB
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isProvinsi
                  ? 'Kelola kredensial login, hak akses, dan status keaktifan user BPS Provinsi dan 14 Kabupaten/Kota se-Kalbar.'
                  : `Kelola kredensial akses resmi untuk ${currentUser.agencyName || currentUser.regionName}.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Section 1: ADMIN PROVINSI VIEW */}
          {isProvinsi ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari kode atau nama wilayah..."
                    className="w-full sm:w-64 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadUsers}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
                    <span>Segarkan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(!isAddUserOpen)}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddUserOpen ? 'Batal Tambah' : 'Tambah Akun'}</span>
                  </button>
                </div>
              </div>

              {/* Add User Form Drawer */}
              {isAddUserOpen && (
                <form
                  onSubmit={handleCreateUser}
                  className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs pb-1 border-b border-emerald-200/80">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>Form Pendaftaran Akun Wilayah Baru ke Database Supabase</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Kode Wilayah</label>
                      <input
                        type="text"
                        value={newKode}
                        onChange={(e) => setNewKode(e.target.value)}
                        placeholder="Contoh: 61.13"
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Nama Wilayah</label>
                      <input
                        type="text"
                        value={newNama}
                        onChange={(e) => setNewNama(e.target.value)}
                        placeholder="Nama instansi/wilayah"
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Tingkat / Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900"
                      >
                        <option value="kabkota">Admin Kab/Kota</option>
                        <option value="provinsi">Admin Provinsi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Token Akses / Sandi</label>
                      <input
                        type="text"
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder="Token akses login"
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan Akun Baru'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold">
                      <th className="py-2.5 px-3 border-r border-slate-800 w-24">Kode</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Nama Wilayah &amp; Instansi</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 w-28 text-center">Tingkat</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 min-w-[200px]">Token Akses / Sandi</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 w-24 text-center">Status</th>
                      <th className="py-2.5 px-3 w-36 text-center">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                          <span>Memuat daftar pengguna dari Supabase...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Tidak ada data akun yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isEditingThis = editingKode === user.kode_kabkota;
                        const isVisible = showPasswordMap[user.kode_kabkota];

                        return (
                          <tr key={user.kode_kabkota} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">
                              {user.kode_kabkota}
                            </td>

                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <div className="font-semibold text-slate-900">{user.nama_wilayah}</div>
                              <div className="text-[10px] text-slate-400">
                                {user.role === 'provinsi'
                                  ? 'Sekretariat TPID & BPS Provinsi Kalbar'
                                  : `BPS ${user.nama_wilayah}`}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center border-r border-slate-200">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  user.role === 'provinsi'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {user.role === 'provinsi' ? 'Provinsi' : 'Kab/Kota'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 border-r border-slate-200">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={newTokenAkses}
                                    onChange={(e) => setNewTokenAkses(e.target.value)}
                                    placeholder="Token baru"
                                    className="px-2 py-1 text-xs border border-emerald-400 rounded bg-emerald-50 text-slate-900 font-mono w-36"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveToken(user.kode_kabkota)}
                                    disabled={isSaving}
                                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                                    title="Simpan"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingKode(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Batal"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-slate-700 text-xs">
                                    {isVisible ? user.token_akses || '—' : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleShowPassword(user.kode_kabkota)}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                    title={isVisible ? 'Sembunyikan' : 'Tampilkan token'}
                                  >
                                    {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center border-r border-slate-200">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  user.is_active
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {user.is_active ? 'Aktif' : 'Non-Aktif'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKode(user.kode_kabkota);
                                    setNewTokenAkses(user.token_akses || '');
                                  }}
                                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors cursor-pointer"
                                  title="Ubah token akses ini"
                                >
                                  Ubah Token
                                </button>

                                {user.kode_kabkota !== '61.00' && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(user)}
                                    disabled={isSaving}
                                    className={`p-1 rounded cursor-pointer transition-colors ${
                                      user.is_active
                                        ? 'text-rose-600 hover:bg-rose-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={user.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                  >
                                    {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Section 2: ADMIN KAB/KOTA VIEW */
            <div className="space-y-5 max-w-xl mx-auto">
              {/* Account summary banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                    KODE: {currentUser.regionCode}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-1">
                    {currentUser.agencyName || currentUser.regionName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tingkat Wilayah: <strong>{currentUser.regionType}</strong> • Hak Akses: <strong>Admin Kab/Kota</strong>
                  </p>
                </div>
              </div>

              {/* Change Password Form */}
              <form
                onSubmit={handleChangeOwnPassword}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Perbarui Kata Sandi / Token Akses Wilayah Anda
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kata Sandi / Token Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showKabKotaPass ? 'text' : 'password'}
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      placeholder="Masukkan kata sandi baru..."
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowKabKotaPass(!showKabKotaPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKabKotaPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <input
                    type={showKabKotaPass ? 'text' : 'password'}
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Ulangi kata sandi baru..."
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400 italic">
                    Perubahan langsung ter-commit otomatis ke database Supabase.
                  </p>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Koneksi Terenkripsi SSL • Single Source of Truth Supabase</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
