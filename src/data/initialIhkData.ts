import {
  IHK_REGIONS,
  IhkCommodityItem,
  IhkCompleteDataset,
  IhkMonthOption,
  IhkRegionDataset,
} from '../types/ihk';

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Generate months from Januari 2024 to Agustus 2026 (32 months)
export const generateIhkMonths = (): IhkMonthOption[] => {
  const months: IhkMonthOption[] = [];

  // 2024: Jan - Des
  for (let m = 1; m <= 12; m++) {
    const id = `2024-${String(m).padStart(2, '0')}`;
    months.push({
      id,
      label: `${MONTH_NAMES_FULL[m - 1]} 2024`,
      shortLabel: `${MONTH_NAMES_SHORT[m - 1]} '24`,
      year: 2024,
      month: m,
    });
  }

  // 2025: Jan - Des
  for (let m = 1; m <= 12; m++) {
    const id = `2025-${String(m).padStart(2, '0')}`;
    months.push({
      id,
      label: `${MONTH_NAMES_FULL[m - 1]} 2025`,
      shortLabel: `${MONTH_NAMES_SHORT[m - 1]} '25`,
      year: 2025,
      month: m,
    });
  }

  // 2026: Jan - Agu
  for (let m = 1; m <= 8; m++) {
    const id = `2026-${String(m).padStart(2, '0')}`;
    months.push({
      id,
      label: `${MONTH_NAMES_FULL[m - 1]} 2026`,
      shortLabel: `${MONTH_NAMES_SHORT[m - 1]} '26`,
      year: 2026,
      month: m,
    });
  }

  return months;
};

// Master benchmark list directly matching the user's Excel sheet tidur6106
export interface MasterIhkBenchmarkItem {
  no: number;
  code: string;
  name: string;
  category: string;
  valJan24: number;
  valAgu26: number;
}

export const MASTER_IHK_COMMODITIES: MasterIhkBenchmarkItem[] = [
  { no: 1, code: '0111001', name: 'BERAS', category: 'Padi-padian & Serealia', valJan24: 137.49, valAgu26: 145.11 },
  { no: 2, code: '0111008', name: 'TEPUNG TERIGU', category: 'Padi-padian & Serealia', valJan24: 108.02, valAgu26: 108.54 },
  { no: 3, code: '0111013', name: 'BISKUIT', category: 'Makanan Olahan & Roti', valJan24: 106.81, valAgu26: 111.97 },
  { no: 4, code: '0111017', name: 'MAKANAN RINGAN/SNACK', category: 'Makanan Olahan & Roti', valJan24: 93.47, valAgu26: 99.88 },
  { no: 5, code: '0111018', name: 'ROTI MANIS', category: 'Makanan Olahan & Roti', valJan24: 115.16, valAgu26: 116.73 },
  { no: 6, code: '0111021', name: 'WAFER', category: 'Makanan Olahan & Roti', valJan24: 100.65, valAgu26: 98.29 },
  { no: 7, code: '0111025', name: 'DONAT', category: 'Makanan Olahan & Roti', valJan24: 93.87, valAgu26: 96.52 },
  { no: 8, code: '0111047', name: 'MIE KERING INSTANT', category: 'Makanan Olahan & Roti', valJan24: 101.43, valAgu26: 101.00 },
  { no: 9, code: '0112001', name: 'AYAM HIDUP', category: 'Daging & Unggas', valJan24: 109.73, valAgu26: 110.55 },
  { no: 10, code: '0112003', name: 'DAGING AYAM RAS', category: 'Daging & Unggas', valJan24: 104.87, valAgu26: 95.95 },
  { no: 11, code: '0112008', name: 'DAGING SAPI', category: 'Daging & Unggas', valJan24: 101.62, valAgu26: 118.30 },
  { no: 12, code: '0112026', name: 'SOSIS', category: 'Daging Olahan', valJan24: 102.35, valAgu26: 109.57 },
  { no: 13, code: '0112027', name: 'NUGGET', category: 'Daging Olahan', valJan24: 102.73, valAgu26: 112.79 },
  { no: 14, code: '0113001', name: 'IKAN BANDENG/IKAN BOLU', category: 'Ikan & Hasil Laut', valJan24: 111.51, valAgu26: 124.82 },
  { no: 15, code: '0113003', name: 'IKAN BAUNG', category: 'Ikan & Hasil Laut', valJan24: 110.68, valAgu26: 220.53 },
  { no: 16, code: '0113004', name: 'IKAN BAWAL', category: 'Ikan & Hasil Laut', valJan24: 99.40, valAgu26: 101.70 },
  { no: 17, code: '0113019', name: 'IKAN KAKAP MERAH', category: 'Ikan & Hasil Laut', valJan24: 96.29, valAgu26: 100.66 },
  { no: 18, code: '0113024', name: 'IKAN KEMBUNG/IKAN GEMBUNG/IKAN BANYAR', category: 'Ikan & Hasil Laut', valJan24: 124.07, valAgu26: 153.20 },
  { no: 19, code: '0113030', name: 'IKAN LELE', category: 'Ikan & Hasil Laut', valJan24: 86.46, valAgu26: 96.93 },
  { no: 20, code: '0113036', name: 'IKAN NILA', category: 'Ikan & Hasil Laut', valJan24: 120.54, valAgu26: 149.94 },
  { no: 21, code: '0113039', name: 'IKAN PATIN', category: 'Ikan & Hasil Laut', valJan24: 109.24, valAgu26: 125.60 },
  { no: 22, code: '0113044', name: 'IKAN SENANGIN', category: 'Ikan & Hasil Laut', valJan24: 156.12, valAgu26: 197.70 },
  { no: 23, code: '0113050', name: 'IKAN TENGGIRI', category: 'Ikan & Hasil Laut', valJan24: 121.31, valAgu26: 162.22 },
  { no: 24, code: '0113051', name: 'IKAN TERI', category: 'Ikan & Hasil Laut', valJan24: 103.98, valAgu26: 88.63 },
  { no: 25, code: '0113053', name: 'IKAN TONGKOL/ IKAN AMBU-AMBU', category: 'Ikan & Hasil Laut', valJan24: 97.40, valAgu26: 124.07 },
  { no: 26, code: '0113228', name: 'IKAN DALAM KALENG', category: 'Ikan Olahan', valJan24: 122.80, valAgu26: 132.35 },
  { no: 27, code: '0113236', name: 'IKAN ASIN PEDA', category: 'Ikan Olahan', valJan24: 135.17, valAgu26: 126.57 },
  { no: 28, code: '0113240', name: 'IKAN ASIN TERI', category: 'Ikan Olahan', valJan24: 100.24, valAgu26: 111.24 },
  { no: 29, code: '0113311', name: 'CUMI-CUMI', category: 'Ikan & Hasil Laut', valJan24: 132.20, valAgu26: 162.89 },
  { no: 30, code: '0113314', name: 'UDANG BASAH', category: 'Ikan & Hasil Laut', valJan24: 39.71, valAgu26: 43.30 },
  { no: 31, code: '0114002', name: 'SUSU CAIR KEMASAN', category: 'Susu & Olahan Susu', valJan24: 108.47, valAgu26: 118.66 },
  { no: 32, code: '0114005', name: 'SUSU BUBUK', category: 'Susu & Olahan Susu', valJan24: 106.25, valAgu26: 108.15 },
  { no: 33, code: '0114006', name: 'SUSU KENTAL MANIS', category: 'Susu & Olahan Susu', valJan24: 111.20, valAgu26: 112.90 },
  { no: 34, code: '0114017', name: 'TELUR AYAM KAMPUNG', category: 'Telur', valJan24: 100.00, valAgu26: 89.60 },
  { no: 35, code: '0114018', name: 'TELUR AYAM RAS', category: 'Telur', valJan24: 98.15, valAgu26: 102.84 },
  { no: 36, code: '0115002', name: 'MINYAK GORENG', category: 'Minyak & Lemak', valJan24: 90.95, valAgu26: 116.48 },
  { no: 37, code: '0116007', name: 'PISANG', category: 'Buah-buahan', valJan24: 97.20, valAgu26: 104.79 },
  { no: 38, code: '0116009', name: 'KELAPA MUDA', category: 'Buah-buahan', valJan24: 100.17, valAgu26: 109.09 },
  { no: 39, code: '0116050', name: 'JERUK', category: 'Buah-buahan', valJan24: 98.23, valAgu26: 107.33 },
  { no: 40, code: '0117001', name: 'CABAI MERAH', category: 'Bumbu & Sayuran', valJan24: 105.40, valAgu26: 122.80 },
  { no: 41, code: '0117003', name: 'CABAI RAWIT', category: 'Bumbu & Sayuran', valJan24: 112.30, valAgu26: 138.50 },
  { no: 42, code: '0117006', name: 'BAWANG MERAH', category: 'Bumbu & Sayuran', valJan24: 104.20, valAgu26: 115.10 },
  { no: 43, code: '0117008', name: 'BAWANG PUTIH', category: 'Bumbu & Sayuran', valJan24: 102.10, valAgu26: 111.45 },
  { no: 44, code: '0118001', name: 'GULA PASIR', category: 'Gula & Bumbu', valJan24: 101.50, valAgu26: 108.70 },
  { no: 45, code: '0118012', name: 'TAHU MENTAH', category: 'Kacang-kacangan & Olahan', valJan24: 100.00, valAgu26: 101.20 },
  { no: 46, code: '0118014', name: 'TEMPE KEDELAI', category: 'Kacang-kacangan & Olahan', valJan24: 99.80, valAgu26: 101.50 },
];

// Helper to generate a realistic smooth interpolated time series between start and end with realistic monthly fluctuation
const generateTimeSeries = (
  valStart: number,
  valEnd: number,
  months: IhkMonthOption[],
  variationSeed: number = 1
): Record<string, number> => {
  const result: Record<string, number> = {};
  const totalMonths = months.length;

  months.forEach((m, idx) => {
    if (idx === 0) {
      result[m.id] = valStart;
      return;
    }
    if (idx === totalMonths - 1) {
      result[m.id] = valEnd;
      return;
    }

    const progress = idx / (totalMonths - 1);
    // Linear trend
    const baseLinear = valStart + (valEnd - valStart) * progress;

    // Small realistic seasonal wave
    const wave = Math.sin((idx + variationSeed * 2) * 0.5) * ((valEnd - valStart) * 0.08 || 0.4);
    const calculated = Math.round((baseLinear + wave) * 100) / 100;
    result[m.id] = Math.max(10, calculated);
  });

  return result;
};

// Generate full initial IHK dataset for all 5 BPS IHK regions
export const generateInitialIhkDataset = (): IhkCompleteDataset => {
  const months = generateIhkMonths();
  const regions: Record<string, IhkRegionDataset> = {};

  // Regional multipliers to simulate realistic price index variations between Ketapang, Sintang, Kayong Utara, Pontianak, Singkawang
  const regionalMultipliers: Record<string, { factorStart: number; factorEnd: number; seed: number }> = {
    tidur6106: { factorStart: 1.00, factorEnd: 1.00, seed: 1 }, // Ketapang (exact match user screenshot)
    tidur6107: { factorStart: 1.015, factorEnd: 1.02, seed: 2 }, // Sintang
    tidur6111: { factorStart: 1.025, factorEnd: 1.03, seed: 3 }, // Kayong Utara
    tidur6171: { factorStart: 0.985, factorEnd: 0.99, seed: 4 }, // Pontianak (Kota Besar)
    tidur6172: { factorStart: 0.992, factorEnd: 0.995, seed: 5 }, // Singkawang
  };

  IHK_REGIONS.forEach((reg) => {
    const mult = regionalMultipliers[reg.id] || { factorStart: 1, factorEnd: 1, seed: 1 };

    const items: IhkCommodityItem[] = MASTER_IHK_COMMODITIES.map((c) => {
      // If it's Ketapang, use exact values from screenshot
      const isKetapang = reg.id === 'tidur6106';
      const startVal = isKetapang ? c.valJan24 : Math.round(c.valJan24 * mult.factorStart * 100) / 100;
      const endVal = isKetapang ? c.valAgu26 : Math.round(c.valAgu26 * mult.factorEnd * 100) / 100;

      const monthlyValues = generateTimeSeries(startVal, endVal, months, mult.seed + c.no);

      return {
        no: c.no,
        code: c.code,
        name: c.name,
        category: c.category,
        monthlyValues,
      };
    });

    regions[reg.id] = {
      regionId: reg.id,
      sheetName: reg.sheetName,
      regionName: reg.name,
      regionCode: reg.code,
      items,
    };
  });

  return {
    availableMonths: months,
    regions,
    lastUpdated: new Date().toISOString(),
    version: '1.0.0',
  };
};
