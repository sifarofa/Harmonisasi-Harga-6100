import { HpbsDataset, HpbsMonthlyPeriod, HpbsRespondentRecord } from '../types/hpbs';
import { computeRespondentMetrics } from '../utils/hpbsAnalysis';
import { DEFAULT_REGIONS } from './initialData';

// Raw seed data modeled after exact image screenshot and expanded across 14 Kab/Kota Kalbar
const SEED_TEMPLATES = [
  {
    respondenBase: 'MITRA AYAM SUNSUNG (MASS)',
    kodeKomoditas: '2112101001',
    komoditas: 'DAGING AYAM RAS',
    kodeKualitas: '2.1121E+12',
    kualitas: 'DAGING AYAM RAS SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.2' as const,
    basePrev: 43000,
    baseCurr: 40000,
    catatan: 'Penurunan harga karena pasokan dari peternak lokal melimpah',
    // Monthly price multipliers relative to base (Jan - Ags 2026) showing seasonal volatility
    monthlyFactors: [
      { prev: 1.02, curr: 1.05, note: 'Tahun baru pasokan tinggi' }, // Jan
      { prev: 1.05, curr: 1.08, note: 'Kebutuhan jelang Ramadhan' }, // Feb
      { prev: 1.08, curr: 1.15, note: 'Bulan Ramadhan permintaan melonjak' }, // Mar
      { prev: 1.15, curr: 1.18, note: 'Puncak Idul Fitri' }, // Apr
      { prev: 1.18, curr: 1.06, note: 'Pasokan melimpah pasca lebaran' }, // Mei
      { prev: 1.06, curr: 1.04, note: 'Harga berangsur normal' }, // Jun
      { prev: 1.04, curr: 1.08, note: 'Kenaikan libur sekolah & hajatan' }, // Jul
      { prev: 1.08, curr: 1.00, note: 'Penurunan pasokan lokal melimpah' }, // Ags
    ],
  },
  {
    respondenBase: 'MITRA AYAM POTONG RAKYAT',
    kodeKomoditas: '0215101000',
    komoditas: 'AYAM PEDAGING',
    kodeKualitas: '0215101000017',
    kualitas: 'AYAM POTONG HIDUP (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 26000,
    baseCurr: 23000,
    catatan: 'Harga turun dari tingkat peternak',
    monthlyFactors: [
      { prev: 1.03, curr: 1.04, note: '' }, // Jan
      { prev: 1.04, curr: 1.07, note: '' }, // Feb
      { prev: 1.07, curr: 1.14, note: 'Permintaan Ramadhan naik' }, // Mar
      { prev: 1.14, curr: 1.16, note: 'Lebaran' }, // Apr
      { prev: 1.16, curr: 1.05, note: 'Koreksi normal' }, // Mei
      { prev: 1.05, curr: 1.03, note: '' }, // Jun
      { prev: 1.03, curr: 1.06, note: '' }, // Jul
      { prev: 1.06, curr: 0.94, note: 'Penurunan dari peternak' }, // Ags
    ],
  },
  {
    respondenBase: 'TOKO DAMAI JAYA',
    kodeKomoditas: '0165101002',
    komoditas: 'BIJI LADA',
    kodeKualitas: '0165101002002',
    kualitas: 'BIJI LADA HITAM KERING (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 88000,
    baseCurr: 88000,
    catatan: '',
    // Extremely stable commodity (RH ~ 100)
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO DAMAI JAYA',
    kodeKomoditas: '2392102001',
    komoditas: 'BIJI MERICA/LADA',
    kodeKualitas: '2.3921E+12',
    kualitas: 'BIJI LADA PUTIH KERING (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 140000,
    baseCurr: 135000,
    catatan: 'Penyesuaian panen lada putih',
    monthlyFactors: [
      { prev: 0.98, curr: 0.98, note: '' },
      { prev: 0.98, curr: 0.99, note: '' },
      { prev: 0.99, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.03, note: '' },
      { prev: 1.03, curr: 0.99, note: 'Panen lada putih' },
    ],
  },
  {
    respondenBase: 'TOKO LILY',
    kodeKomoditas: '0231000001',
    komoditas: 'TELUR KONSUMSI AYAM RAS',
    kodeKualitas: '0231000001004',
    kualitas: 'TELUR AYAM RAS (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.2' as const,
    basePrev: 27000,
    baseCurr: 28000,
    catatan: 'Kenaikan pakan ayam petelur',
    monthlyFactors: [
      { prev: 0.98, curr: 0.99, note: '' },
      { prev: 0.99, curr: 1.03, note: 'Bahan kue Ramadhan' },
      { prev: 1.03, curr: 1.08, note: 'Ramadhan' },
      { prev: 1.08, curr: 1.11, note: 'Idul Fitri' },
      { prev: 1.11, curr: 1.02, note: 'Normalisasi' },
      { prev: 1.02, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.04, note: 'Kebutuhan hajatan' },
      { prev: 1.04, curr: 1.07, note: 'Kenaikan pakan ayam' },
    ],
  },
  {
    respondenBase: 'TOKO LILY',
    kodeKomoditas: '2154500002',
    komoditas: 'MINYAK GORENG',
    kodeKualitas: '2.1545E+12',
    kualitas: 'KITA 1 LITER 1 DUS X 12 POUCH X 1 LITER',
    satuan: '1LITER',
    kuesioner: 'V-HPBS.2' as const,
    basePrev: 17916.67,
    baseCurr: 17916.67,
    catatan: '',
    // Governed by HET, highly stable
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO CANADA',
    kodeKomoditas: '2316101003',
    komoditas: 'BERAS BIASA',
    kodeKualitas: '2.3161E+12',
    kualitas: 'LOKAL 1 KARUNG X 10 KG (10 KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.2' as const,
    basePrev: 14000,
    baseCurr: 14200,
    catatan: 'Pasokan beras lokal stabil cenderung naik tipis',
    // Very stable staple
    monthlyFactors: [
      { prev: 0.98, curr: 0.99, note: '' },
      { prev: 0.99, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.025, note: '' },
      { prev: 1.025, curr: 1.035, note: 'Stabil naik tipis' },
    ],
  },
  {
    respondenBase: 'PEDAGANG IKAN ALDI',
    kodeKomoditas: '0412001002',
    komoditas: 'IKAN BANDENG HIDUP/SEGAR/DINGIN',
    kodeKualitas: '0412001002007',
    kualitas: 'IKAN BANDENG SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 30000,
    baseCurr: 30000,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.03, note: '' },
      { prev: 1.03, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'PEDAGANG IKAN ALDI',
    kodeKomoditas: '0412001037',
    komoditas: 'IKAN KEMBUNG HIDUP/SEGAR/DINGIN',
    kodeKualitas: '0412001037019',
    kualitas: 'IKAN KEMBUNG SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 40000,
    baseCurr: 40000,
    catatan: '',
    monthlyFactors: [
      { prev: 0.95, curr: 0.98, note: '' },
      { prev: 0.98, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.05, note: '' },
      { prev: 1.05, curr: 1.01, note: '' },
      { prev: 1.01, curr: 0.97, note: '' },
      { prev: 0.97, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'PEDAGANG IKAN ALDI',
    kodeKomoditas: '0412001083',
    komoditas: 'IKAN TENGGIRI HIDUP/SEGAR/DINGIN',
    kodeKualitas: '0412001083009',
    kualitas: 'IKAN TENGGIRI SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 45000,
    baseCurr: 50000,
    catatan: 'NAIK KARENA PASOKAN IKAN BERKURANG',
    // Highly volatile marine catch (weather/waves)
    monthlyFactors: [
      { prev: 0.92, curr: 0.98, note: 'Gelombang laut sedang' },
      { prev: 0.98, curr: 1.04, note: 'Angin barat' },
      { prev: 1.04, curr: 1.12, note: 'Permintaan Ramadhan tinggi' },
      { prev: 1.12, curr: 1.16, note: 'Lebaran' },
      { prev: 1.16, curr: 1.02, note: 'Pasokan membaik' },
      { prev: 1.02, curr: 0.95, note: 'Tangkapan melimpah' },
      { prev: 0.95, curr: 1.02, note: 'Musim gelombang' },
      { prev: 1.02, curr: 1.13, note: 'Pasokan berkurang' },
    ],
  },
  {
    respondenBase: 'PEDAGANG IKAN ALDI',
    kodeKomoditas: '0412001089',
    komoditas: 'IKAN TONGKOL HIDUP/SEGAR/DINGIN',
    kodeKualitas: '0412001089020',
    kualitas: 'IKAN TONGKOL SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 35000,
    baseCurr: 35000,
    catatan: '',
    monthlyFactors: [
      { prev: 0.97, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.06, note: '' },
      { prev: 1.06, curr: 1.02, note: '' },
      { prev: 1.02, curr: 0.98, note: '' },
      { prev: 0.98, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'PEDAGANG IKAN ALDI',
    kodeKomoditas: '0412002026',
    komoditas: 'IKAN NILA HIDUP/SEGAR/DINGIN',
    kodeKualitas: '0412002026003',
    kualitas: 'IKAN NILA SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 38000,
    baseCurr: 38000,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.03, note: '' },
      { prev: 1.03, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'AGEN KELAPA BUN FHU',
    kodeKomoditas: '0146001001',
    komoditas: 'BUAH KELAPA',
    kodeKualitas: '0146001001048',
    kualitas: 'KELAPA BIASA (1 BUTIR)',
    satuan: '1BUTIR',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 2700,
    baseCurr: 2700,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.04, note: 'Santan Ramadhan' },
      { prev: 1.04, curr: 1.04, note: '' },
      { prev: 1.04, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO HARUM',
    kodeKomoditas: '2343000012',
    komoditas: 'SNACK PILUS',
    kodeKualitas: '2.343E+12',
    kualitas: 'JAIPONG 17 GRAM 1 DUS X 10 PAK X 10 PCS',
    satuan: '1GRAM',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 50,
    baseCurr: 50,
    catatan: '',
    // Sangat stabil
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO HARUM',
    kodeKomoditas: '2391103001',
    komoditas: 'KOPI BUBUK',
    kodeKualitas: '2.3911E+12',
    kualitas: 'KOPI ROBUSTA LOKAL KALBAR 1 BUNGKUS X 1 KG',
    satuan: '1GRAM',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 140,
    baseCurr: 140,
    catatan: '',
    monthlyFactors: [
      { prev: 0.98, curr: 0.98, note: '' },
      { prev: 0.98, curr: 0.99, note: '' },
      { prev: 0.99, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO HARUM',
    kodeKomoditas: '2399916004',
    komoditas: 'NON-DAIRY CREAMER',
    kodeKualitas: '2.39992E+12',
    kualitas: 'MAX CREAMER NON DAIRY CREAMER BOTOL 500 GRAM',
    satuan: '1GRAM',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 80,
    baseCurr: 80,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO HARUM',
    kodeKomoditas: '2502004002',
    komoditas: 'SPM (ROKOK/SIGARET PUTIH MESIN)',
    kodeKualitas: '2.502E+12',
    kualitas: 'MARLBORO GOLD 20 NEUTRAL 1 SLOP X 10 BUNGKUS',
    satuan: '1BATANG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 2610,
    baseCurr: 2610,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
  {
    respondenBase: 'TOKO SINAR SURYA',
    kodeKomoditas: '3532201003',
    komoditas: 'DETERJEN CREAM',
    kodeKualitas: '3.5322E+12',
    kualitas: 'B29 CREAM 430 GR 1 BUNGKUS X 430 GR',
    satuan: '1GRAM',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 20.93,
    baseCurr: 23.26,
    catatan: 'HARGA NAIK DARI PRODUSEN',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.11, note: 'Kenaikan dari produsen' },
    ],
  },
  {
    respondenBase: 'PEDAGANG DAGING SAPI A. KOHAR',
    kodeKomoditas: '2111101003',
    komoditas: 'DAGING SAPI',
    kodeKualitas: '2.1111E+12',
    kualitas: 'DAGING SAPI SEGAR (1KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.2' as const,
    basePrev: 170000,
    baseCurr: 170000,
    catatan: 'Pasokan daging sapi stabil',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.03, note: 'Jelang Ramadhan' },
      { prev: 1.03, curr: 1.08, note: 'Ramadhan' },
      { prev: 1.08, curr: 1.12, note: 'Idul Fitri' },
      { prev: 1.12, curr: 1.02, note: 'Normalisasi' },
      { prev: 1.02, curr: 1.05, note: 'Idul Adha' },
      { prev: 1.05, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: 'Pasokan stabil' },
    ],
  },
  {
    respondenBase: 'CAHAYA PELITA TANI',
    kodeKomoditas: '2331905002',
    komoditas: 'RANSUM JADI UNGGAS',
    kodeKualitas: '2.33191E+12',
    kualitas: 'RANSUM JADI UNGGAS 1 DUS X 50 KG',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 11300,
    baseCurr: 11800,
    catatan: 'Penyesuaian harga bahan baku pakan',
    monthlyFactors: [
      { prev: 0.97, curr: 0.98, note: '' },
      { prev: 0.98, curr: 0.99, note: '' },
      { prev: 0.99, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.03, note: '' },
      { prev: 1.03, curr: 1.03, note: '' },
      { prev: 1.03, curr: 1.07, note: 'Bahan baku pakan naik' },
    ],
  },
  {
    respondenBase: 'CAHAYA PELITA TANI',
    kodeKomoditas: '3463102000',
    komoditas: 'PUPUK KALIUM KHLORIDA (KCL)',
    kodeKualitas: '3.4631E+12',
    kualitas: 'MAHKOTA 1 SAK (50 KG)',
    satuan: '1KG',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 10500,
    baseCurr: 10400,
    catatan: 'Diskon pembelian distributor',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.02, note: '' },
      { prev: 1.02, curr: 1.01, note: '' },
      { prev: 1.01, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 0.99, note: 'Diskon distributor' },
    ],
  },
  {
    respondenBase: 'CAHAYA PELITA LOGAM',
    kodeKomoditas: '4292101999',
    komoditas: 'PERKAKAS TANGAN PERTANIAN LAINNYA DARI LOGAM',
    kodeKualitas: '4.2921E+12',
    kualitas: 'CANGKUL BESAR (1 BUAH)',
    satuan: '1BUAH',
    kuesioner: 'V-HPBS.1' as const,
    basePrev: 150000,
    baseCurr: 150000,
    catatan: '',
    monthlyFactors: [
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
      { prev: 1.0, curr: 1.0, note: '' },
    ],
  },
];

export const HPBS_MONTHLY_PERIODS_DEF = [
  { id: '2026-09', label: 'September 2026', shortLabel: 'Sep 26', comparisonLabel: 'September 2026 vs Bulan Sebelumnya', factorIndex: 8 },
  { id: '2026-08', label: 'Agustus 2026', shortLabel: 'Ags 26', comparisonLabel: "Ags '26 vs Jul '26", factorIndex: 7 },
  { id: '2026-07', label: 'Juli 2026', shortLabel: 'Jul 26', comparisonLabel: "Jul '26 vs Jun '26", factorIndex: 6 },
  { id: '2026-06', label: 'Juni 2026', shortLabel: 'Jun 26', comparisonLabel: "Jun '26 vs Mei '26", factorIndex: 5 },
  { id: '2026-05', label: 'Mei 2026', shortLabel: 'Mei 26', comparisonLabel: "Mei '26 vs Apr '26", factorIndex: 4 },
  { id: '2026-04', label: 'April 2026', shortLabel: 'Apr 26', comparisonLabel: "Apr '26 vs Mar '26", factorIndex: 3 },
  { id: '2026-03', label: 'Maret 2026', shortLabel: 'Mar 26', comparisonLabel: "Mar '26 vs Feb '26", factorIndex: 2 },
  { id: '2026-02', label: 'Februari 2026', shortLabel: 'Feb 26', comparisonLabel: "Feb '26 vs Jan '26", factorIndex: 1 },
  { id: '2026-01', label: 'Januari 2026', shortLabel: 'Jan 26', comparisonLabel: "Jan '26 vs Des '25", factorIndex: 0 },
];

/**
 * Generates records for a specific monthly period index
 */
function generateRecordsForMonth(factorIndex: number, monthId: string): HpbsRespondentRecord[] {
  const records: HpbsRespondentRecord[] = [];

  DEFAULT_REGIONS.forEach((region, rIdx) => {
    // Regional baseline multiplier
    const regionalFactor = 1 + ((rIdx % 5) - 2) * 0.02;

    SEED_TEMPLATES.forEach((tmpl, tmplIdx) => {
      const respondentCount = tmpl.kuesioner === 'V-HPBS.2' ? 2 : 1;
      const factorObj = tmpl.monthlyFactors[factorIndex] || { prev: 1.0, curr: 1.0, note: tmpl.catatan };

      for (let i = 0; i < respondentCount; i++) {
        const respVariance = 1 + (i === 1 ? 0.015 : 0);
        const prevPrice = Math.round(tmpl.basePrev * factorObj.prev * regionalFactor * respVariance);
        const currPrice = Math.round(tmpl.basePrev * factorObj.curr * regionalFactor * respVariance);

        let m1Prev = prevPrice;
        let m2Prev = 0;
        let m1Curr = currPrice;
        let m2Curr = 0;

        if (tmpl.kuesioner === 'V-HPBS.2') {
          m2Prev = Math.round(prevPrice * (i === 0 ? 1 : 1.01));
          m2Curr = Math.round(currPrice * (i === 0 ? 1 : 1.008));
        }

        const kabCode = region.code || '6101';
        const respSeq = String(tmplIdx * 2 + i + 1).padStart(3, '0');
        const respCode = `${kabCode}${respSeq}`;

        const record = computeRespondentMetrics({
          id: `hpbs_${monthId}_${region.id}_${tmpl.kodeKomoditas}_${i + 1}`,
          kodeKabKota: kabCode,
          kodeResponden: respCode,
          responden: `${tmpl.respondenBase} ${region.name.toUpperCase()} #${i + 1}`,
          kabKotaId: region.id,
          kabKotaName: region.name,
          kodeKomoditas: tmpl.kodeKomoditas,
          komoditas: tmpl.komoditas,
          kodeKualitas: tmpl.kodeKualitas,
          kualitas: tmpl.kualitas,
          satuanStandar: tmpl.satuan,
          kuesioner: tmpl.kuesioner,
          m1Prev,
          m2Prev,
          m1Curr,
          m2Curr,
          catatanM1: factorObj.note || tmpl.catatan,
          catatanM2: '',
        });

        records.push(record);
      }
    });
  });

  return records;
}

/**
 * Generates rich monthly time-series routine periods (Januari s/d Agustus 2026)
 * from any set of base respondent records (e.g. from imported or published Excel data).
 * The active period contains the exact baseRecords, while previous months reflect
 * commodity-specific seasonal movement.
 */
export function generatePeriodsFromRecords(
  baseRecords: HpbsRespondentRecord[],
  activePeriodId: string = '2026-09'
): HpbsMonthlyPeriod[] {
  if (!baseRecords || baseRecords.length === 0) {
    return generateInitialHpbsDataset().periods || [];
  }

  return HPBS_MONTHLY_PERIODS_DEF.map((def) => {
    // Active period keeps 100% of user-provided base records
    if (def.id === activePeriodId) {
      return {
        id: def.id,
        label: def.label,
        shortLabel: def.shortLabel,
        comparisonLabel: def.comparisonLabel,
        records: baseRecords,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Historical months generated with commodity-specific seasonal factors
    const records: HpbsRespondentRecord[] = baseRecords.map((r, idx) => {
      const commLower = (r.komoditas || '').toLowerCase();
      let factor = { prev: 1.0, curr: 1.0, note: '' };

      if (
        commLower.includes('ayam') ||
        commLower.includes('telur') ||
        commLower.includes('daging') ||
        commLower.includes('bebek')
      ) {
        // Poultry & Meat: surges in Ramadhan (Mar) & Lebaran (Apr), stabilizes Jun, rises Jul
        const poultryFactors = [
          { prev: 1.02, curr: 1.04, note: 'Tahun baru pasokan tinggi' }, // Jan
          { prev: 1.04, curr: 1.08, note: 'Kebutuhan jelang Ramadhan' }, // Feb
          { prev: 1.08, curr: 1.15, note: 'Bulan Ramadhan permintaan naik' }, // Mar
          { prev: 1.15, curr: 1.18, note: 'Puncak Idul Fitri' }, // Apr
          { prev: 1.18, curr: 1.05, note: 'Pasokan melimpah pasca lebaran' }, // Mei
          { prev: 1.05, curr: 1.03, note: 'Harga berangsur normal' }, // Jun
          { prev: 1.03, curr: 1.07, note: 'Kenaikan libur sekolah & hajatan' }, // Jul
          { prev: 1.07, curr: 1.00, note: 'Koreksi pasokan lokal' }, // Ags
        ];
        factor = poultryFactors[def.factorIndex] || factor;
      } else if (
        commLower.includes('ikan') ||
        commLower.includes('udang') ||
        commLower.includes('cumi') ||
        commLower.includes('kepiting') ||
        commLower.includes('tenggiri') ||
        commLower.includes('tongkol')
      ) {
        // Fisheries: ocean wave seasons in Jan-Feb & Jul-Aug
        const fishFactors = [
          { prev: 0.95, curr: 0.98, note: 'Gelombang laut sedang' }, // Jan
          { prev: 0.98, curr: 1.04, note: 'Angin barat tangkapan terbatas' }, // Feb
          { prev: 1.04, curr: 1.12, note: 'Permintaan Ramadhan tinggi' }, // Mar
          { prev: 1.12, curr: 1.15, note: 'Lebaran' }, // Apr
          { prev: 1.15, curr: 1.02, note: 'Pasokan membaik' }, // Mei
          { prev: 1.02, curr: 0.96, note: 'Tangkapan melimpah' }, // Jun
          { prev: 0.96, curr: 1.02, note: 'Musim gelombang' }, // Jul
          { prev: 1.02, curr: 1.08, note: 'Pasokan berkurang' }, // Ags
        ];
        factor = fishFactors[def.factorIndex] || factor;
      } else if (
        commLower.includes('cabai') ||
        commLower.includes('cabe') ||
        commLower.includes('bawang') ||
        commLower.includes('tomat') ||
        commLower.includes('sayur')
      ) {
        // Horticulture: seasonal weather & harvest variations
        const hortiFactors = [
          { prev: 1.04, curr: 1.07, note: 'Musim penghujan pasokan berkurang' }, // Jan
          { prev: 1.07, curr: 1.14, note: 'Pasokan terbatas' }, // Feb
          { prev: 1.14, curr: 1.22, note: 'Permintaan Ramadhan tinggi' }, // Mar
          { prev: 1.22, curr: 1.10, note: 'Pasca lebaran' }, // Apr
          { prev: 1.10, curr: 0.96, note: 'Panen raya lokal melimpah' }, // Mei
          { prev: 0.96, curr: 1.02, note: 'Pasokan stabil' }, // Jun
          { prev: 1.02, curr: 1.08, note: 'Cuaca panas pasokan menurun' }, // Jul
          { prev: 1.08, curr: 1.00, note: 'Koreksi pasokan panen' }, // Ags
        ];
        factor = hortiFactors[def.factorIndex] || factor;
      } else if (
        commLower.includes('beras') ||
        commLower.includes('minyak') ||
        commLower.includes('gula') ||
        commLower.includes('tepung') ||
        commLower.includes('garam') ||
        commLower.includes('kedelai')
      ) {
        // Staples: strictly regulated or highly stable
        const stapleFactors = [
          { prev: 0.985, curr: 0.99, note: 'Harga stabil' },
          { prev: 0.99, curr: 0.995, note: '' },
          { prev: 0.995, curr: 1.005, note: '' },
          { prev: 1.005, curr: 1.01, note: '' },
          { prev: 1.01, curr: 1.005, note: '' },
          { prev: 1.005, curr: 1.005, note: '' },
          { prev: 1.005, curr: 1.01, note: '' },
          { prev: 1.01, curr: 1.00, note: '' },
        ];
        factor = stapleFactors[def.factorIndex] || factor;
      } else {
        // General wholesale commodities: moderate stability
        const pseudoVariance = 1 + (((idx % 7) - 3) * 0.003);
        const generalFactors = [
          { prev: 0.99 * pseudoVariance, curr: 0.995 * pseudoVariance, note: '' },
          { prev: 0.995 * pseudoVariance, curr: 1.00 * pseudoVariance, note: '' },
          { prev: 1.00 * pseudoVariance, curr: 1.01 * pseudoVariance, note: '' },
          { prev: 1.01 * pseudoVariance, curr: 1.015 * pseudoVariance, note: '' },
          { prev: 1.015 * pseudoVariance, curr: 1.005 * pseudoVariance, note: '' },
          { prev: 1.005 * pseudoVariance, curr: 1.00 * pseudoVariance, note: '' },
          { prev: 1.00 * pseudoVariance, curr: 1.005 * pseudoVariance, note: '' },
          { prev: 1.005 * pseudoVariance, curr: 1.00 * pseudoVariance, note: '' },
        ];
        factor = generalFactors[def.factorIndex] || factor;
      }

      const baseRef = r.m1Curr || r.m1Prev || 15000;
      const m1Prev = Math.max(500, Math.round(baseRef * factor.prev));
      const m1Curr = Math.max(500, Math.round(baseRef * factor.curr));
      let m2Prev = 0;
      let m2Curr = 0;

      if (r.kuesioner === 'V-HPBS.2') {
        m2Prev = Math.max(500, Math.round(m1Prev * 1.005));
        m2Curr = Math.max(500, Math.round(m1Curr * 1.003));
      }

      return computeRespondentMetrics({
        id: `hpbs_${def.id}_${r.kabKotaId}_${r.kodeKomoditas}_${idx + 1}`,
        responden: r.responden,
        kabKotaId: r.kabKotaId,
        kabKotaName: r.kabKotaName,
        kodeKomoditas: r.kodeKomoditas,
        komoditas: r.komoditas,
        kodeKualitas: r.kodeKualitas,
        kualitas: r.kualitas,
        satuanStandar: r.satuanStandar,
        kuesioner: r.kuesioner,
        m1Prev,
        m2Prev,
        m1Curr,
        m2Curr,
        catatanM1: factor.note || r.catatanM1 || '',
        catatanM2: r.catatanM2 || '',
      });
    });

    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      comparisonLabel: def.comparisonLabel,
      records,
      lastUpdated: new Date().toISOString(),
    };
  });
}

export function generateInitialHpbsDataset(): HpbsDataset {
  // Generate multi-period routine series
  const periods: HpbsMonthlyPeriod[] = HPBS_MONTHLY_PERIODS_DEF.map((def) => {
    const records = generateRecordsForMonth(def.factorIndex, def.id);
    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      comparisonLabel: def.comparisonLabel,
      records,
      lastUpdated: new Date().toISOString(),
    };
  });

  const activePeriod = periods[0]; // September 2026

  return {
    periodTitle: activePeriod.comparisonLabel,
    records: activePeriod.records,
    periods,
    activePeriodId: activePeriod.id,
    lastUpdated: new Date().toISOString(),
    version: '2.0.0',
  };
}

