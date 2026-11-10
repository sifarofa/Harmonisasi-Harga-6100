import { CommodityCategory, MonthlyHarmonizationDataset, PriceStatus, RegionInfo } from '../types';
import publishedHarmonizationJson from './publishedDatasets.json';

export const DEFAULT_REGIONS: RegionInfo[] = [
  { id: 'sambas', name: 'Sambas', type: 'Kabupaten', code: '6101' },
  { id: 'bengkayang', name: 'Bengkayang', type: 'Kabupaten', code: '6102' },
  { id: 'landak', name: 'Landak', type: 'Kabupaten', code: '6103' },
  { id: 'mempawah', name: 'Mempawah', type: 'Kabupaten', code: '6104' },
  { id: 'sanggau', name: 'Sanggau', type: 'Kabupaten', code: '6105' },
  { id: 'ketapang', name: 'Ketapang', type: 'Kabupaten', code: '6106' },
  { id: 'sintang', name: 'Sintang', type: 'Kabupaten', code: '6107' },
  { id: 'kapuas_hulu', name: 'Kapuas Hulu', type: 'Kabupaten', code: '6108' },
  { id: 'sekadau', name: 'Sekadau', type: 'Kabupaten', code: '6109' },
  { id: 'melawi', name: 'Melawi', type: 'Kabupaten', code: '6110' },
  { id: 'kayong_utara', name: 'Kayong Utara', type: 'Kabupaten', code: '6111' },
  { id: 'kubu_raya', name: 'Kubu Raya', type: 'Kabupaten', code: '6112' },
  { id: 'pontianak', name: 'Kota Pontianak', type: 'Kota', code: '6171' },
  { id: 'singkawang', name: 'Kota Singkawang', type: 'Kota', code: '6172' },
];

export interface MasterCommodity {
  no: number;
  name: string;
  category: CommodityCategory;
  unit: string;
}

export const MASTER_COMMODITIES: MasterCommodity[] = [
  { no: 1, name: 'BAHAN BAKAR RUMAH TANGGA', category: 'Energi & Bahan Bakar', unit: 'Tabung' },
  { no: 2, name: 'BAWANG MERAH', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 3, name: 'BAWANG PUTIH', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 4, name: 'BENSIN', category: 'Energi & Bahan Bakar', unit: 'Liter' },
  { no: 5, name: 'BERAS/ GABAH', category: 'Pangan Pokok', unit: 'Kg' },
  { no: 6, name: 'CABAI MERAH', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 7, name: 'CABAI RAWIT', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 8, name: 'CAT TEMBOK', category: 'Bahan Bangunan', unit: 'Kaleng' },
  { no: 9, name: 'DAGING AYAM RAS', category: 'Daging & Unggas', unit: 'Kg' },
  { no: 10, name: 'DAGING SAPI', category: 'Daging & Unggas', unit: 'Kg' },
  { no: 11, name: 'EMAS PERHIASAN', category: 'Lainnya / Jasa', unit: 'Gram' },
  { no: 12, name: 'GULA PASIR', category: 'Pangan Pokok', unit: 'Kg' },
  { no: 13, name: 'IKAN KEMBUNG', category: 'Ikan & Hasil Laut', unit: 'Kg' },
  { no: 14, name: 'IKAN TONGKOL/ IKAN AMBU-AMBU', category: 'Ikan & Hasil Laut', unit: 'Kg' },
  { no: 15, name: 'JAGUNG MANIS', category: 'Pangan Pokok', unit: 'Kg' },
  { no: 16, name: 'JERUK', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 17, name: 'KARET', category: 'Lainnya / Jasa', unit: 'Kg' },
  { no: 18, name: 'MIE KERING INSTANT', category: 'Pangan Pokok', unit: 'Bks' },
  { no: 19, name: 'MINYAK GORENG', category: 'Bahan Olahan & Minyak', unit: 'Liter' },
  { no: 20, name: 'PEMELIHARAAN/SERVICE', category: 'Lainnya / Jasa', unit: 'Jasa' },
  { no: 21, name: 'PISANG', category: 'Bumbu & Hortikultura', unit: 'Sisir' },
  { no: 22, name: 'SAWI HIJAU', category: 'Bumbu & Hortikultura', unit: 'Ikat' },
  { no: 23, name: 'SAWI PUTIH/PECAY/PITSAI', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 24, name: 'SAWIT', category: 'Lainnya / Jasa', unit: 'Kg' },
  { no: 25, name: 'SEMEN', category: 'Bahan Bangunan', unit: 'Sak' },
  { no: 26, name: 'SENG', category: 'Bahan Bangunan', unit: 'Lembar' },
  { no: 27, name: 'SIGARET KRETEK MESIN (SKM)', category: 'Rokok & Tembakau', unit: 'Bks' },
  { no: 28, name: 'SIGARET KRETEK TANGAN (SKT)', category: 'Rokok & Tembakau', unit: 'Bks' },
  { no: 29, name: 'SIGARET PUTIH MESIN (SPM)', category: 'Rokok & Tembakau', unit: 'Bks' },
  { no: 30, name: 'SUSU BUBUK', category: 'Bahan Olahan & Minyak', unit: 'Kotak' },
  { no: 31, name: 'SUSU BUBUK UNTUK BALITA', category: 'Bahan Olahan & Minyak', unit: 'Kotak' },
  { no: 32, name: 'TAHU MENTAH', category: 'Pangan Pokok', unit: 'Pcs' },
  { no: 33, name: 'TARIF GUNTING RAMBUT PRIA', category: 'Lainnya / Jasa', unit: 'Jasa' },
  { no: 34, name: 'TELUR AYAM RAS', category: 'Daging & Unggas', unit: 'Kg' },
  { no: 35, name: 'TEMPE', category: 'Pangan Pokok', unit: 'Pcs' },
  { no: 36, name: 'TEPUNG TERIGU', category: 'Pangan Pokok', unit: 'Kg' },
  { no: 37, name: 'TOMAT', category: 'Bumbu & Hortikultura', unit: 'Kg' },
  { no: 38, name: 'UDANG BASAH', category: 'Ikan & Hasil Laut', unit: 'Kg' },
];

// Commodity absence mapping (regencies that don't produce / trade certain commodities)
const REGION_EXCLUSIONS: Record<number, string[]> = {
  11: ['sekadau', 'melawi', 'landak', 'kayong_utara'], // Emas Perhiasan (hanya disurvei di perkotaan/sentra tertentu)
  13: ['kapuas_hulu', 'sintang', 'melawi', 'sekadau'], // Ikan Kembung (Laut) tidak tersedia segar di pedalaman hulu
  14: ['kapuas_hulu', 'melawi'],                         // Ikan Tongkol
  17: ['pontianak', 'singkawang'],                      // Karet (bukan di perkotaan)
  24: ['pontianak', 'singkawang'],                      // Sawit (bukan di perkotaan)
  20: ['landak', 'sekadau', 'melawi'],                  // Jasa servis tertentu
  38: ['kapuas_hulu', 'melawi'],                         // Udang laut segar
};

// Snapshot data for Month 1 (Januari 2024) matching the uploaded spreadsheet image
const JANUARI_STATUS_MAP: Record<number, Record<string, PriceStatus>> = {
  1: { sambas: '0', bengkayang: '0', landak: '0', mempawah: 'STABIL', sanggau: 'STABIL', ketapang: 'TURUN', sintang: 'STABIL', kapuas_hulu: 'NAIK', sekadau: 'STABIL' },
  2: { sambas: 'TURUN', bengkayang: 'STABIL', landak: 'STABIL', mempawah: 'STABIL', sanggau: 'TURUN', ketapang: 'TURUN', sintang: 'NAIK', kapuas_hulu: 'NAIK', sekadau: 'STABIL' },
  3: { sambas: 'TURUN', bengkayang: 'STABIL', landak: 'TURUN', mempawah: '0', sanggau: 'TURUN', ketapang: 'TURUN', sintang: 'TURUN', kapuas_hulu: 'NAIK', sekadau: 'STABIL' },
  4: { sambas: 'NAIK', bengkayang: '0', landak: '0', mempawah: 'NAIK', sanggau: '0', ketapang: 'NAIK', sintang: 'TURUN', kapuas_hulu: 'NAIK', sekadau: '0' },
  5: { sambas: 'STABIL', bengkayang: 'TURUN', landak: 'NAIK', mempawah: 'STABIL', sanggau: 'NAIK', ketapang: 'STABIL', sintang: 'NAIK', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  6: { sambas: 'NAIK', bengkayang: 'STABIL', landak: 'NAIK', mempawah: 'STABIL', sanggau: 'NAIK', ketapang: '0', sintang: 'NAIK', kapuas_hulu: 'STABIL', sekadau: 'NAIK' },
  7: { sambas: 'NAIK', bengkayang: 'STABIL', landak: 'NAIK', mempawah: 'STABIL', sanggau: 'NAIK', ketapang: 'STABIL', sintang: 'NAIK', kapuas_hulu: 'STABIL', sekadau: 'TURUN' },
  8: { sambas: 'STABIL', bengkayang: 'STABIL', landak: 'STABIL', mempawah: '0', sanggau: 'STABIL', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  9: { sambas: 'NAIK', bengkayang: 'NAIK', landak: 'TURUN', mempawah: 'NAIK', sanggau: 'TURUN', ketapang: 'STABIL', sintang: 'TURUN', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  10: { sambas: 'STABIL', bengkayang: 'STABIL', landak: 'TURUN', mempawah: 'STABIL', sanggau: '0', ketapang: 'STABIL', sintang: 'TURUN', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  11: { sambas: 'NAIK', bengkayang: 'STABIL', landak: 'KOSONG', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: 'STABIL', sekadau: 'KOSONG' },
  12: { sambas: 'TURUN', bengkayang: 'STABIL', landak: '0', mempawah: 'STABIL', sanggau: 'TURUN', ketapang: 'NAIK', sintang: 'TURUN', kapuas_hulu: 'STABIL', sekadau: 'TURUN' },
  13: { sambas: 'NAIK', bengkayang: 'STABIL', landak: '0', mempawah: 'NAIK', sanggau: '0', ketapang: 'STABIL', sintang: 'KOSONG', kapuas_hulu: 'KOSONG', sekadau: 'KOSONG' },
  14: { sambas: 'NAIK', bengkayang: 'STABIL', landak: '0', mempawah: 'NAIK', sanggau: '0', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'KOSONG', sekadau: 'STABIL' },
  15: { sambas: 'STABIL', bengkayang: '0', landak: 'STABIL', mempawah: 'STABIL', sanggau: 'STABIL', ketapang: '0', sintang: 'STABIL', kapuas_hulu: 'NAIK', sekadau: 'STABIL' },
  16: { sambas: 'NAIK', bengkayang: '0', landak: 'TURUN', mempawah: 'STABIL', sanggau: 'STABIL', ketapang: '0', sintang: 'STABIL', kapuas_hulu: '0', sekadau: '0' },
  17: { sambas: 'NAIK', bengkayang: 'NAIK', landak: 'STABIL', mempawah: '0', sanggau: 'STABIL', ketapang: 'TURUN', sintang: '0', kapuas_hulu: '0', sekadau: 'STABIL' },
  18: { sambas: 'STABIL', bengkayang: 'STABIL', landak: 'NAIK', mempawah: '0', sanggau: 'TURUN', ketapang: '0', sintang: '0', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  19: { sambas: '0', bengkayang: '0', landak: '0', mempawah: '0', sanggau: 'NAIK', ketapang: 'STABIL', sintang: 'TURUN', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  20: { sambas: '0', bengkayang: '0', landak: 'KOSONG', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: 'KOSONG' },
  21: { sambas: 'STABIL', bengkayang: '0', landak: 'STABIL', mempawah: 'STABIL', sanggau: '0', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'STABIL', sekadau: '0' },
  22: { sambas: 'TURUN', bengkayang: 'STABIL', landak: 'STABIL', mempawah: 'NAIK', sanggau: '0', ketapang: 'NAIK', sintang: 'TURUN', kapuas_hulu: 'STABIL', sekadau: '0' },
  23: { sambas: 'TURUN', bengkayang: '0', landak: 'STABIL', mempawah: 'STABIL', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: 'STABIL', sekadau: 'STABIL' },
  24: { sambas: 'NAIK', bengkayang: 'NAIK', landak: 'NAIK', mempawah: 'TURUN', sanggau: 'NAIK', ketapang: 'NAIK', sintang: 'NAIK', kapuas_hulu: '0', sekadau: 'STABIL' },
  25: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: 'TURUN', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  26: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: 'NAIK', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  27: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: 'NAIK', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'STABIL', sekadau: '0' },
  28: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: 'NAIK', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'STABIL', sekadau: '0' },
  29: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: 'TURUN', sanggau: '0', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'STABIL', sekadau: '0' },
  30: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: 'NAIK', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  31: { sambas: '0', bengkayang: '0', landak: '0', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  32: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  33: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  34: { sambas: '0', bengkayang: 'NAIK', landak: 'TURUN', mempawah: '0', sanggau: 'TURUN', ketapang: 'STABIL', sintang: 'STABIL', kapuas_hulu: 'STABIL', sekadau: '0' },
  35: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: '0', ketapang: '0', sintang: '0', kapuas_hulu: '0', sekadau: '0' },
  36: { sambas: '0', bengkayang: 'STABIL', landak: '0', mempawah: '0', sanggau: '0', ketapang: '0', sintang: 'STABIL', kapuas_hulu: '0', sekadau: '0' },
  37: { sambas: 'TURUN', bengkayang: 'STABIL', landak: '0', mempawah: 'NAIK', sanggau: 'TURUN', ketapang: 'STABIL', sintang: 'TURUN', kapuas_hulu: '0', sekadau: 'STABIL' },
  38: { sambas: 'NAIK', bengkayang: 'STABIL', landak: '0', mempawah: 'NAIK', sanggau: '0', ketapang: 'STABIL', sintang: '0', kapuas_hulu: 'KOSONG', sekadau: 'KOSONG' },
};

// Helper to determine dominant overall status from regional map, ignoring empty/kosong regions
export function computeOverallStatus(regions: Record<string, { status: PriceStatus }>): PriceStatus {
  let naik = 0;
  let turun = 0;
  let stabil = 0;
  let kosong = 0;

  Object.values(regions || {}).forEach((r) => {
    const st = r?.status;
    if (st === 'NAIK') naik++;
    else if (st === 'TURUN') turun++;
    else if (st === 'STABIL') stabil++;
    else if (st === 'KOSONG' || st === '-' || st === '0' || !st) kosong++;
  });

  const active = naik + turun + stabil;
  if (active === 0) return 'KOSONG';
  if (naik > turun && naik >= stabil) return 'NAIK';
  if (turun > naik && turun >= stabil) return 'TURUN';
  if (stabil >= naik && stabil >= turun) return 'STABIL';
  if (naik > turun) return 'NAIK';
  if (turun > naik) return 'TURUN';
  return 'STABIL';
}

// Generate monthly datasets spanning official 2026 published periods or fallback
export function generateInitialDatasets(): MonthlyHarmonizationDataset[] {
  // If publishedHarmonizationJson exists and has 2026 data, use it
  if (
    Array.isArray(publishedHarmonizationJson) &&
    publishedHarmonizationJson.length > 0 &&
    publishedHarmonizationJson.some((p: any) => p.year >= 2026)
  ) {
    return JSON.parse(JSON.stringify(publishedHarmonizationJson));
  }

  const months = [
    { id: '2026-01', year: 2026, month: 1, label: 'Januari 2026' },
    { id: '2026-02', year: 2026, month: 2, label: 'Februari 2026' },
    { id: '2026-03', year: 2026, month: 3, label: 'Maret 2026' },
    { id: '2026-04', year: 2026, month: 4, label: 'April 2026' },
    { id: '2026-05', year: 2026, month: 5, label: 'Mei 2026' },
    { id: '2026-06', year: 2026, month: 6, label: 'Juni 2026' },
    { id: '2026-07', year: 2026, month: 7, label: 'Juli 2026' },
    { id: '2026-08', year: 2026, month: 8, label: 'Agustus 2026' },
    { id: '2026-09', year: 2026, month: 9, label: 'September 2026' },
  ];

  return months.map((m, mIdx) => {
    const commodities = MASTER_COMMODITIES.map((c) => {
      const regionData: Record<string, any> = {};
      const excludedRegions = REGION_EXCLUSIONS[c.no] || [];

      DEFAULT_REGIONS.forEach((reg) => {
        const isExcluded = excludedRegions.includes(reg.id);
        let status: PriceStatus = 'STABIL';

        if (isExcluded) {
          status = 'KOSONG';
        } else if (mIdx === 0) {
          // Month 1: Use exact screenshot map
          const janStatus = JANUARI_STATUS_MAP[c.no]?.[reg.id];
          status = janStatus !== undefined ? janStatus : (c.no % 2 === 0 ? 'STABIL' : '0');
        } else {
          // Subsequent months simulate realistic seasonal economic time series:
          // Highly volatile: Cabai Merah (6), Cabai Rawit (7), Bawang Merah (2), Daging Ayam Ras (9), Telur Ayam (34), Tomat (37)
          if ([2, 6, 7, 9, 34, 37].includes(c.no)) {
            const patterns: ('NAIK' | 'TURUN' | 'STABIL')[][] = [
              ['NAIK', 'NAIK', 'TURUN', 'TURUN', 'NAIK', 'STABIL'],
              ['TURUN', 'NAIK', 'NAIK', 'TURUN', 'NAIK', 'TURUN'],
              ['NAIK', 'TURUN', 'NAIK', 'NAIK', 'TURUN', 'NAIK'],
              ['STABIL', 'NAIK', 'NAIK', 'TURUN', 'NAIK', 'NAIK'],
            ];
            const p = patterns[(c.no + reg.name.length) % patterns.length];
            status = p[mIdx % p.length];
          } else if ([5, 12, 19].includes(c.no)) {
            // Moderately fluctuating: Beras (5), Gula Pasir (12), Minyak Goreng (19)
            const p: ('STABIL' | 'NAIK' | 'TURUN' | 'STABIL')[] = ['STABIL', 'NAIK', 'STABIL', 'STABIL', 'NAIK', 'TURUN'];
            status = p[(mIdx + reg.name.length) % p.length];
          } else if ([1, 4, 8, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36].includes(c.no)) {
            // Highly stable commodities: Semen, Bahan Bakar, Seng, Tahu, Tempe, Rokok, Susu, Terigu
            const randomFlicker = (c.no * 7 + mIdx * 11 + reg.name.length) % 15;
            if (randomFlicker === 0) status = 'NAIK';
            else if (randomFlicker === 1) status = 'TURUN';
            else status = 'STABIL';
          } else {
            // Mild seasonal
            const p: ('STABIL' | 'NAIK' | 'TURUN' | '0')[] = ['STABIL', 'STABIL', 'NAIK', 'STABIL', 'TURUN', '0'];
            status = p[(mIdx + c.no) % p.length];
          }
        }

        // Generate realistic 4 price levels:
        // 1. Harga Produsen Perdesaan (HPG)
        // 2. Harga Konsumen Perdesaan (HKD)
        // 3. Harga Perdagangan Besar (HPB / Grosir)
        // 4. Harga Konsumen (HK / Eceran Kota)
        let produsenDesaStatus: PriceStatus = status;
        let konsumenDesaStatus: PriceStatus = status;
        let perdaganganBesarStatus: PriceStatus = status;
        const konsumenStatus: PriceStatus = status;

        if (status === 'KOSONG' || status === '-') {
          produsenDesaStatus = 'KOSONG';
          konsumenDesaStatus = 'KOSONG';
          perdaganganBesarStatus = 'KOSONG';
        } else {
          // Is this regency a primary rural producer of this commodity?
          const isAgricultural = [2, 5, 6, 7, 15, 16, 21, 22, 23, 37].includes(c.no);
          const isLivestock = [9, 10, 34].includes(c.no);
          const isFishery = [13, 14, 38].includes(c.no);
          const isManufactured = [1, 4, 8, 12, 18, 19, 25, 26, 27, 28, 29, 30, 31, 36].includes(c.no);

          if (isManufactured) {
            // Manufactured goods (semen, minyak goreng, rokok, dsb.) didistribusikan dari kota/pelabuhan
            if (['pontianak', 'kubu_raya'].includes(reg.id)) {
              produsenDesaStatus = status;
            } else {
              produsenDesaStatus = 'KOSONG'; // Tidak ada produsen desa lokal
            }
            perdaganganBesarStatus = status;
            konsumenDesaStatus = status;
          } else if (isFishery && !['sambas', 'mempawah', 'ketapang', 'kayong_utara', 'singkawang'].includes(reg.id)) {
            // Wilayah daratan/pegunungan bukan produsen ikan laut
            produsenDesaStatus = 'KOSONG';
            perdaganganBesarStatus = status;
            konsumenDesaStatus = status;
          } else if (isAgricultural || isLivestock) {
            // In agriculture, farm gate changes might happen before wholesale and retail
            const seed = (c.no * 13 + mIdx * 7 + reg.name.length) % 12;
            if (seed === 0 && status === 'NAIK') {
              produsenDesaStatus = 'STABIL';
              konsumenDesaStatus = 'NAIK';
              perdaganganBesarStatus = 'NAIK';
            } else if (seed === 1 && status === 'STABIL') {
              // Lag transmisi: desa naik duluan
              produsenDesaStatus = 'NAIK';
              konsumenDesaStatus = 'NAIK';
              perdaganganBesarStatus = 'STABIL';
            } else if (seed === 2 && status === 'TURUN') {
              produsenDesaStatus = 'TURUN';
              konsumenDesaStatus = 'TURUN';
              perdaganganBesarStatus = 'STABIL';
            } else if (seed === 3 && status === 'NAIK') {
              // Disparitas desa vs kota
              produsenDesaStatus = 'STABIL';
              konsumenDesaStatus = 'STABIL';
              perdaganganBesarStatus = 'NAIK';
            } else {
              produsenDesaStatus = status;
              konsumenDesaStatus = status;
              perdaganganBesarStatus = status;
            }
          }
        }

        regionData[reg.id] = {
          status: status,
          produsenDesaStatus,
          konsumenDesaStatus,
          perdaganganBesarStatus,
          konsumenStatus,
          // Compat aliases
          produsenStatus: produsenDesaStatus,
          grosirStatus: perdaganganBesarStatus,
          hasCommodity: status !== 'KOSONG' && status !== '-',
          hpg: produsenDesaStatus === 'NAIK' ? 1 : produsenDesaStatus === 'TURUN' ? -1 : produsenDesaStatus === 'STABIL' ? 0 : null,
          hkd: konsumenDesaStatus === 'NAIK' ? 1 : konsumenDesaStatus === 'TURUN' ? -1 : konsumenDesaStatus === 'STABIL' ? 0 : null,
          hpb: perdaganganBesarStatus === 'NAIK' ? 1 : perdaganganBesarStatus === 'TURUN' ? -1 : perdaganganBesarStatus === 'STABIL' ? 0 : null,
          hk: konsumenStatus === 'NAIK' ? 1 : konsumenStatus === 'TURUN' ? -1 : konsumenStatus === 'STABIL' ? 0 : null,
        };
      });

      const overall = computeOverallStatus(regionData);

      // Compute overall per price level (4 Levels)
      const produsenDesaRegions: Record<string, { status: PriceStatus }> = {};
      const konsumenDesaRegions: Record<string, { status: PriceStatus }> = {};
      const perdaganganBesarRegions: Record<string, { status: PriceStatus }> = {};
      const konsumenRegions: Record<string, { status: PriceStatus }> = {};

      Object.entries(regionData).forEach(([regId, rd]) => {
        produsenDesaRegions[regId] = { status: rd.produsenDesaStatus || 'KOSONG' };
        konsumenDesaRegions[regId] = { status: rd.konsumenDesaStatus || 'KOSONG' };
        perdaganganBesarRegions[regId] = { status: rd.perdaganganBesarStatus || 'KOSONG' };
        konsumenRegions[regId] = { status: rd.konsumenStatus || rd.status || 'KOSONG' };
      });

      const overallProdDesa = computeOverallStatus(produsenDesaRegions);
      const overallKonsDesa = computeOverallStatus(konsumenDesaRegions);
      const overallPB = computeOverallStatus(perdaganganBesarRegions);
      const overallKons = computeOverallStatus(konsumenRegions);

      return {
        id: `c_${c.no}`,
        no: c.no,
        name: c.name,
        category: c.category,
        unit: c.unit,
        regions: regionData,
        overallStatus: overall,
        overallProdusenDesaStatus: overallProdDesa,
        overallKonsumenDesaStatus: overallKonsDesa,
        overallPerdaganganBesarStatus: overallPB,
        overallKonsumenStatus: overallKons,
        // Compat aliases
        overallProdusenStatus: overallProdDesa,
        overallGrosirStatus: overallPB,
      };
    });

    return {
      id: m.id,
      year: m.year,
      month: m.month,
      monthLabel: m.label,
      notes: `Rekapitulasi harmonisasi data pemantauan harga ${m.label}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commodities: commodities,
    };
  });
}

