import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://pjzhpweddmrnzkvigehg.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_8s26cuw_eEHc9PqGlKbD0Q_B4wTtg1m';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface WilayahUserRow {
  id?: string;
  kode_kabkota: string;
  nama_wilayah: string;
  role: 'provinsi' | 'kabkota';
  token_akses?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DatasetType = 'harmonisasi' | 'ihk' | 'hpbs';

export interface WilayahDatasetRow {
  id?: string;
  kode_kabkota: string;
  dataset_type: DatasetType;
  payload: any;
  updated_by?: string | null;
  updated_at?: string;
}

// Normalized mapping between database `kode_kabkota` (61.00 - 61.72) and app `regionId`
export const KODE_TO_REGION_ID: Record<string, string> = {
  '61.00': 'all',
  '6100': 'all',
  '61.01': 'sambas',
  '6101': 'sambas',
  '61.02': 'mempawah',
  '6102': 'mempawah',
  '61.03': 'sanggau',
  '6103': 'sanggau',
  '61.04': 'ketapang',
  '6104': 'ketapang',
  '61.05': 'sintang',
  '6105': 'sintang',
  '61.06': 'kapuas_hulu',
  '6106': 'kapuas_hulu',
  '61.07': 'bengkayang',
  '6107': 'bengkayang',
  '61.08': 'landak',
  '6108': 'landak',
  '61.09': 'sekadau',
  '6109': 'sekadau',
  '61.10': 'melawi',
  '6110': 'melawi',
  '61.11': 'kayong_utara',
  '6111': 'kayong_utara',
  '61.12': 'kubu_raya',
  '6112': 'kubu_raya',
  '61.71': 'pontianak',
  '6171': 'pontianak',
  '61.72': 'singkawang',
  '6172': 'singkawang',
};

export const REGION_ID_TO_KODE: Record<string, string> = {
  all: '61.00',
  sambas: '61.01',
  mempawah: '61.02',
  sanggau: '61.03',
  ketapang: '61.04',
  sintang: '61.05',
  kapuas_hulu: '61.06',
  bengkayang: '61.07',
  landak: '61.08',
  sekadau: '61.09',
  melawi: '61.10',
  kayong_utara: '61.11',
  kubu_raya: '61.12',
  pontianak: '61.71',
  singkawang: '61.72',
};

export function formatKodeKabKota(code: string): string {
  if (!code) return '61.00';
  const clean = code.trim();
  if (clean.includes('.')) return clean;
  if (clean.length === 4 && clean.startsWith('61')) {
    return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  }
  return clean;
}

export function mapKodeToRegionId(code: string): string {
  const formatted = formatKodeKabKota(code);
  return KODE_TO_REGION_ID[formatted] || KODE_TO_REGION_ID[code] || 'all';
}

export function mapRegionIdToKode(regionId: string): string {
  return REGION_ID_TO_KODE[regionId] || '61.00';
}

export function getCurrentSessionUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      sessionStorage.getItem('seharga_auth_user') ||
      sessionStorage.getItem('seharga_portal_auth_user') ||
      localStorage.getItem('seharga_auth_user') ||
      localStorage.getItem('seharga_portal_auth_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.debug('[Supabase] Failed to get session user:', e);
  }
  return null;
}

export function getCurrentUserRegionKode(): string {
  const user = getCurrentSessionUser();
  if (user && user.regionCode) {
    return formatKodeKabKota(user.regionCode);
  }
  return '61.00';
}

/**
 * Fetch all active wilayah from Supabase table `wilayah_users`
 */
export async function fetchActiveWilayahUsers(): Promise<WilayahUserRow[]> {
  try {
    const { data, error } = await supabase
      .from('wilayah_users')
      .select('kode_kabkota, nama_wilayah, role, is_active, token_akses')
      .eq('is_active', true)
      .order('kode_kabkota');

    if (error) {
      console.warn('[Supabase] Failed to fetch wilayah_users:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Supabase] fetchActiveWilayahUsers error:', err);
    return [];
  }
}

/**
 * Validate login credentials against `wilayah_users`
 */
export async function authenticateWilayahUser(
  kodeKabKota: string,
  tokenAkses: string
): Promise<{ success: boolean; user?: WilayahUserRow; error?: string }> {
  try {
    const formattedKode = formatKodeKabKota(kodeKabKota);
    const cleanToken = tokenAkses.trim();

    // Query matching by formatted code or raw code
    const { data, error } = await supabase
      .from('wilayah_users')
      .select('*')
      .or(`kode_kabkota.eq.${formattedKode},kode_kabkota.eq.${kodeKabKota}`)
      .eq('token_akses', cleanToken)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Auth error:', error);
      return { success: false, error: 'Terjadi kendala koneksi ke server autentikasi.' };
    }

    if (!data) {
      return { success: false, error: 'Kode Kabupaten/Kota atau Token Akses tidak sesuai.' };
    }

    return { success: true, user: data as WilayahUserRow };
  } catch (err: any) {
    console.error('[Supabase] authenticateWilayahUser error:', err);
    return { success: false, error: err?.message || 'Gagal memvalidasi token akses.' };
  }
}

/**
 * Fetch all users for User Management (Admin Provinsi & Admin Kab/Kota)
 */
export async function fetchAllWilayahUsers(): Promise<WilayahUserRow[]> {
  try {
    const { data, error } = await supabase
      .from('wilayah_users')
      .select('*')
      .order('kode_kabkota');

    if (error) {
      console.warn('[Supabase] Failed to fetch all wilayah_users:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Supabase] fetchAllWilayahUsers error:', err);
    return [];
  }
}

/**
 * Update user token or status in Supabase table `wilayah_users`
 */
export async function updateWilayahUser(
  kodeKabKota: string,
  updates: Partial<WilayahUserRow>
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedKode = formatKodeKabKota(kodeKabKota);
    const { error } = await supabase
      .from('wilayah_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .or(`kode_kabkota.eq.${formattedKode},kode_kabkota.eq.${kodeKabKota}`);

    if (error) {
      console.error('[Supabase] updateWilayahUser error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] updateWilayahUser exception:', err);
    return { success: false, error: err?.message || 'Gagal memperbarui data user.' };
  }
}

/**
 * Create or save new user in Supabase table `wilayah_users`
 */
export async function saveWilayahUser(
  user: WilayahUserRow
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedKode = formatKodeKabKota(user.kode_kabkota);
    const { error } = await supabase.from('wilayah_users').upsert(
      {
        kode_kabkota: formattedKode,
        nama_wilayah: user.nama_wilayah,
        role: user.role,
        token_akses: user.token_akses,
        is_active: user.is_active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'kode_kabkota' }
    );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menyimpan user.' };
  }
}

/**
 * Delete user from Supabase table `wilayah_users`
 */
export async function deleteWilayahUser(
  kodeKabKota: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedKode = formatKodeKabKota(kodeKabKota);
    if (formattedKode === '61.00') {
      return { success: false, error: 'Akun Super Admin Provinsi tidak dapat dihapus.' };
    }
    const { error } = await supabase
      .from('wilayah_users')
      .delete()
      .eq('kode_kabkota', formattedKode);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus user.' };
  }
}

/**
 * Upsert dataset to Supabase table `wilayah_datasets`
 */
export async function upsertWilayahDataset(
  kodeKabKota: string,
  datasetType: DatasetType,
  payload: any,
  updatedBy?: string
): Promise<boolean> {
  try {
    const formattedKode = formatKodeKabKota(kodeKabKota);
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from('wilayah_datasets').upsert(
      {
        kode_kabkota: formattedKode,
        dataset_type: datasetType,
        payload,
        updated_by: updatedBy || formattedKode,
        updated_at: nowIso,
      },
      { onConflict: 'kode_kabkota,dataset_type' }
    );

    if (error) {
      console.error(`[Supabase] Upsert error for ${formattedKode}/${datasetType}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase] upsertWilayahDataset exception:`, err);
    return false;
  }
}

/**
 * Load datasets from Supabase for a specific role and kode_kabkota:
 * - If role === 'kabkota', loads specifically for that kode_kabkota.
 * - If role === 'provinsi', loads all records from `wilayah_datasets`.
 */
export async function loadWilayahDatasetsFromSupabase(
  kodeKabKota: string,
  role: 'provinsi' | 'kabkota'
): Promise<{
  rows: WilayahDatasetRow[];
  harmonisasiPayload?: any;
  ihkPayload?: any;
  hpbsPayload?: any;
  allDatasetsByRegion?: Record<string, Record<DatasetType, any>>;
}> {
  try {
    const formattedKode = formatKodeKabKota(kodeKabKota);

    let query = supabase.from('wilayah_datasets').select('*');
    if (role === 'kabkota') {
      query = query.eq('kode_kabkota', formattedKode);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] loadWilayahDatasets error:', error);
      return { rows: [] };
    }

    const rows = (data || []) as WilayahDatasetRow[];

    // Organize datasets by region and type
    const allDatasetsByRegion: Record<string, Record<DatasetType, any>> = {};
    rows.forEach((r) => {
      if (!allDatasetsByRegion[r.kode_kabkota]) {
        allDatasetsByRegion[r.kode_kabkota] = {} as Record<DatasetType, any>;
      }
      allDatasetsByRegion[r.kode_kabkota][r.dataset_type] = r.payload;
    });

    // Primary payloads for current active context
    // For kabkota, take matching kode. For provinsi, prefer '61.00' as master aggregate
    const targetKode = role === 'provinsi' ? '61.00' : formattedKode;
    const harmonisasiRow = rows.find(
      (r) => r.kode_kabkota === targetKode && r.dataset_type === 'harmonisasi'
    );
    const ihkRow = rows.find(
      (r) => r.kode_kabkota === targetKode && r.dataset_type === 'ihk'
    );
    const hpbsRow = rows.find(
      (r) => r.kode_kabkota === targetKode && r.dataset_type === 'hpbs'
    );

    return {
      rows,
      harmonisasiPayload: harmonisasiRow?.payload,
      ihkPayload: ihkRow?.payload,
      hpbsPayload: hpbsRow?.payload,
      allDatasetsByRegion,
    };
  } catch (err) {
    console.error('[Supabase] loadWilayahDatasets exception:', err);
    return { rows: [] };
  }
}
