import * as XLSX from 'xlsx';
import {
  CommodityMonthlyPoint,
  CommodityStabilityAnalysis,
  HpbsCommodityAggregation,
  HpbsDataset,
  HpbsMonthlyPeriod,
  HpbsQuestionnaireType,
  HpbsRegionalCommodityAggregation,
  HpbsRespondentRecord,
  StabilityLevel,
} from '../types/hpbs';
import { DEFAULT_REGIONS } from '../data/initialData';
import { OFFICIAL_SAMBAS_BPS_ROWS } from '../data/sambasHpbsTemplate';

/**
 * Calculates the geometric mean of an array of positive numbers.
 * G = exp( (1/n) * sum(ln(x)) )
 */
export function calculateGeometricMean(values: number[]): number {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v) && v > 0);
  if (valid.length === 0) return 0;
  if (valid.length === 1) return valid[0];

  const sumLn = valid.reduce((acc, val) => acc + Math.log(val), 0);
  return Math.exp(sumLn / valid.length);
}

/**
 * Computes respondent-level geometric prices and Relatif Harga (RH)
 */
export function computeRespondentMetrics(
  record: Omit<HpbsRespondentRecord, 'rhM1' | 'rhM2' | 'geoPrev' | 'geoCurr' | 'rh' | 'status'>
): HpbsRespondentRecord {
  const { kuesioner, m1Prev, m2Prev, m1Curr, m2Curr } = record;

  let geoPrev = 0;
  let geoCurr = 0;
  let rhM1 = 0;
  let rhM2 = 0;

  if (kuesioner === 'V-HPBS.1') {
    // Bulanan: hanya M1 dicacah
    geoPrev = m1Prev > 0 ? m1Prev : 0;
    geoCurr = m1Curr > 0 ? m1Curr : 0;
    rhM1 = m1Prev > 0 ? (m1Curr / m1Prev) * 100 : 0;
    rhM2 = 0;
  } else {
    // Mingguan (V-HPBS.2): dicacah 2 kali (M1 dan M2)
    const prevItems = [m1Prev, m2Prev].filter((v) => v > 0);
    geoPrev = prevItems.length > 0 ? calculateGeometricMean(prevItems) : 0;

    const currItems = [m1Curr, m2Curr].filter((v) => v > 0);
    geoCurr = currItems.length > 0 ? calculateGeometricMean(currItems) : 0;

    rhM1 = m1Prev > 0 ? (m1Curr / m1Prev) * 100 : 0;
    rhM2 = m2Prev > 0 ? (m2Curr / m2Prev) * 100 : 0;
  }

  const rh = geoPrev > 0 ? (geoCurr / geoPrev) * 100 : 100;
  const status: 'NAIK' | 'TURUN' | 'STABIL' =
    rh > 100.005 ? 'NAIK' : rh < 99.995 ? 'TURUN' : 'STABIL';

  return {
    ...record,
    rhM1: Number(rhM1.toFixed(2)),
    rhM2: Number(rhM2.toFixed(2)),
    geoPrev: Number(geoPrev.toFixed(2)),
    geoCurr: Number(geoCurr.toFixed(2)),
    rh: Number(rh.toFixed(2)),
    status,
  };
}

/**
 * Validates whether an HPBS respondent record is a genuine, non-empty survey entry.
 * Filters out blank/padding rows, template instruction headers/footers, and zero-price rows.
 */
export function isValidHpbsRecord(
  record: Partial<HpbsRespondentRecord> | null | undefined
): boolean {
  if (!record) return false;

  const rawKom = (record.komoditas || '').trim();
  const rawKodeKom = (record.kodeKomoditas || '').trim();
  // Must have at least a commodity name or commodity code
  if (!rawKom && !rawKodeKom) return false;

  const upperKom = rawKom.toUpperCase();
  // Skip spreadsheet guide, summary, and aggregate rows (not actual survey points)
  if (
    upperKom === 'TOTAL' ||
    upperKom === 'JUMLAH' ||
    upperKom === 'RATA-RATA' ||
    upperKom === 'KOMODITAS LAINNYA' ||
    upperKom.includes('PETUNJUK PENGISIAN') ||
    upperKom.includes('KETERANGAN PENGISIAN') ||
    upperKom.includes('RELATIF HARGA MINGGU')
  ) {
    return false;
  }

  // Also filter if commodity text is simply placeholder / header text
  if (
    upperKom.includes('KODE KOMODITAS') ||
    upperKom.includes('NAMA KOMODITAS') ||
    upperKom.includes('KODE SPESIFIKASI') ||
    upperKom.includes('DESKRIPSI DETAIL') ||
    upperKom.includes('SATUAN STANDAR') ||
    upperKom.includes('JENIS FORMULIR') ||
    upperKom.includes('CATATAN PETUGAS')
  ) {
    return false;
  }

  const rawResp = (record.responden || '').toUpperCase();
  if (
    rawResp.includes('PETUNJUK PENGISIAN') ||
    rawResp.includes('RELATIF HARGA MINGGU') ||
    rawResp.includes('HARGA MINGGU KE-') ||
    rawResp.includes('DIHITUNG OTOMATIS') ||
    rawResp.includes('KHUSUS V-HPBS') ||
    rawResp.includes('NAMA TOKO, USAHA') ||
    rawResp.includes('KODE KOMODITAS STANDAR') ||
    rawResp.includes('NAMA KOMODITAS / BARANG') ||
    rawResp.includes('KODE SPESIFIKASI KUALITAS') ||
    rawResp.includes('DESKRIPSI DETAIL SPESIFIKASI') ||
    rawResp.includes('SATUAN STANDAR PENCACAHAN') ||
    rawResp.includes('JENIS FORMULIR: V-HPBS') ||
    rawResp.includes('CATATAN PETUGAS JIKA')
  ) {
    return false;
  }

  // Must have at least one identifier (region, respondent, or code)
  const hasIdentifier =
    Boolean(record.kabKotaId) ||
    Boolean(record.kabKotaName) ||
    Boolean(record.kodeKabKota) ||
    Boolean(record.responden) ||
    Boolean(record.kodeResponden);

  if (!hasIdentifier) {
    return false;
  }

  return true;
}

/**
 * Filters an array of respondent records, returning only valid records.
 */
export function filterValidHpbsRecords(
  records: HpbsRespondentRecord[] | null | undefined
): HpbsRespondentRecord[] {
  if (!Array.isArray(records)) return [];
  return records.filter(isValidHpbsRecord);
}

/**
 * Aggregates respondent data into:
 * 1. Per-Commodity per Kab/Kota
 * 2. Per-Commodity Agregat Se-Kalimantan Barat (Rata-rata Geometri seluruh Kab/Kota)
 */
export function aggregateHpbsData(
  records: HpbsRespondentRecord[],
  commodityNotes?: Record<string, string>
): HpbsCommodityAggregation[] {
  // Discard empty rows, template guide notes, or 0 0 price commodities (such as "KOMODITAS LAINNYA")
  const validRecords = filterValidHpbsRecords(records);

  // Group by commodity code
  const commMap = new Map<string, HpbsRespondentRecord[]>();
  for (const rec of validRecords) {
    const list = commMap.get(rec.kodeKomoditas) || [];
    list.push(rec);
    commMap.set(rec.kodeKomoditas, list);
  }

  const results: HpbsCommodityAggregation[] = [];

  commMap.forEach((commRecords, kodeKomoditas) => {
    const first = commRecords[0];
    const komoditas = first.komoditas;
    const satuanStandar = first.satuanStandar;
    const kuesioner = first.kuesioner;

    // Group by Kab/Kota
    const regMap = new Map<string, HpbsRespondentRecord[]>();
    for (const rec of commRecords) {
      const rList = regMap.get(rec.kabKotaId) || [];
      rList.push(rec);
      regMap.set(rec.kabKotaId, rList);
    }

    const regionalData: Record<string, HpbsRegionalCommodityAggregation> = {};
    const regGeoPrevList: number[] = [];
    const regGeoCurrList: number[] = [];

    regMap.forEach((regRecords, kabKotaId) => {
      const regName = regRecords[0].kabKotaName;
      // Rata-rata geometri harga N-1 dan N di kab/kota ini
      const validPrev = regRecords.map((r) => r.geoPrev).filter((v) => v > 0);
      const validCurr = regRecords.map((r) => r.geoCurr).filter((v) => v > 0);

      const geoPrev = calculateGeometricMean(validPrev);
      const geoCurr = calculateGeometricMean(validCurr);
      const rh = geoPrev > 0 ? (geoCurr / geoPrev) * 100 : 100;
      const status: 'NAIK' | 'TURUN' | 'STABIL' =
        rh > 100.005 ? 'NAIK' : rh < 99.995 ? 'TURUN' : 'STABIL';

      if (geoPrev > 0) regGeoPrevList.push(geoPrev);
      if (geoCurr > 0) regGeoCurrList.push(geoCurr);

      regionalData[kabKotaId] = {
        kabKotaId,
        kabKotaName: regName,
        kodeKomoditas,
        komoditas,
        kuesioner,
        respondentCount: regRecords.length,
        geoPrev: Number(geoPrev.toFixed(2)),
        geoCurr: Number(geoCurr.toFixed(2)),
        rh: Number(rh.toFixed(2)),
        status,
        percentChange: Number((rh - 100).toFixed(2)),
        respondents: regRecords,
      };
    });

    // Hitung Agregat Se-Kalimantan Barat:
    // Sesuai standar metodologi resmi BPS (persis hitungan Excel), angka agregat provinsi dihitung
    // sebagai rata-rata geometri seluruh titik pantau responden pedagang se-Kalimantan Barat
    const allCommValidPrev = commRecords.map((r) => r.geoPrev).filter((v) => v > 0);
    const allCommValidCurr = commRecords.map((r) => r.geoCurr).filter((v) => v > 0);
    const kalbarGeoPrev = calculateGeometricMean(allCommValidPrev);
    const kalbarGeoCurr = calculateGeometricMean(allCommValidCurr);
    const kalbarRh = kalbarGeoPrev > 0 ? (kalbarGeoCurr / kalbarGeoPrev) * 100 : 100;
    const kalbarStatus: 'NAIK' | 'TURUN' | 'STABIL' =
      kalbarRh > 100.005 ? 'NAIK' : kalbarRh < 99.995 ? 'TURUN' : 'STABIL';
    const percentChange = kalbarRh - 100;

    // Find highest & lowest region RH
    let highestRegion: { kabKotaName: string; rh: number } | undefined;
    let lowestRegion: { kabKotaName: string; rh: number } | undefined;

    const regList = Object.values(regionalData);
    if (regList.length > 0) {
      const sortedByRh = [...regList].sort((a, b) => b.rh - a.rh);
      highestRegion = { kabKotaName: sortedByRh[0].kabKotaName, rh: sortedByRh[0].rh };
      lowestRegion = {
        kabKotaName: sortedByRh[sortedByRh.length - 1].kabKotaName,
        rh: sortedByRh[sortedByRh.length - 1].rh,
      };
    }

    // Collect all field notes from respondent enumerators for this commodity
    const respondentNotes: { note: string; regName?: string; responden?: string }[] = [];
    const seenNotes = new Set<string>();
    for (const r of commRecords) {
      const rawNotes = [r.catatanM1, r.catatanM2, r.adjustmentNote]
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0 && s.trim() !== '-');
      for (const raw of rawNotes) {
        const trimmed = raw.trim();
        const key = `${r.kabKotaName || ''}_${trimmed.toLowerCase()}`;
        if (!seenNotes.has(key)) {
          seenNotes.add(key);
          respondentNotes.push({
            note: trimmed,
            regName: r.kabKotaName,
            responden: r.responden,
          });
        }
      }
    }

    // Custom note set by user/analyst for this specific commodity
    const customNote = commodityNotes?.[kodeKomoditas]?.trim() || undefined;

    // Compiled catatan for provincial aggregate
    let catatan = customNote;
    if (!catatan && respondentNotes.length > 0) {
      catatan = respondentNotes.map((rn) => (rn.regName ? `${rn.note} (${rn.regName})` : rn.note)).join('; ');
    }

    results.push({
      kodeKomoditas,
      komoditas,
      satuanStandar,
      kuesioner,
      totalRespondents: commRecords.length,
      monitoredRegionsCount: Object.keys(regionalData).length,
      kalbarGeoPrev: Number(kalbarGeoPrev.toFixed(2)),
      kalbarGeoCurr: Number(kalbarGeoCurr.toFixed(2)),
      kalbarRh: Number(kalbarRh.toFixed(2)),
      status: kalbarStatus,
      percentChange: Number(percentChange.toFixed(2)),
      regionalData,
      highestRegion,
      lowestRegion,
      catatan: catatan || undefined,
      customNote,
      respondentNotes: respondentNotes.length > 0 ? respondentNotes : undefined,
    });
  });

  // Sort by Komoditas name
  results.sort((a, b) => a.komoditas.localeCompare(b.komoditas));
  return results;
}

/**
 * Parses numeric price values from Excel, supporting Indonesian and International formatting:
 * e.g. "Rp 14.500", "14.500,50", "14,500.50", 14500, "-" -> 0
 */
export function parsePriceValue(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  const str = String(val).trim();
  if (!str || str === '-' || str === 'n/a' || str === 'null') return 0;

  let cleaned = str.replace(/[Rr][Pp]\.?/g, '').replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  // Dot as thousand separator with comma decimal: e.g. "14.500,50" -> "14500.50"
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Check if dot represents thousands separator: "15.000" or "1.500.000"
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      // US thousands: 14,500
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Indonesian decimal: 14500,5
      cleaned = cleaned.replace(',', '.');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Dynamic mapping of BPS codes to DEFAULT_REGIONS IDs
const BPS_KAB_KOTA_MAP: Record<string, string> = {
  '6101': 'sambas',
  '6102': 'bengkayang',
  '6103': 'landak',
  '6104': 'mempawah',
  '6105': 'sanggau',
  '6106': 'ketapang',
  '6107': 'sintang',
  '6108': 'kapuas_hulu',
  '6109': 'sekadau',
  '6110': 'melawi',
  '6111': 'kayong_utara',
  '6112': 'kubu_raya',
  '6171': 'pontianak',
  '6172': 'singkawang',
};

/**
 * Matches input string (code or name) to a Kalimantan Barat region.
 * Guaranteed to never return undefined or null.
 */
export function matchKabKota(
  inputStr: string,
  sheetName = '',
  fileName = ''
): typeof DEFAULT_REGIONS[0] {
  const fallback = DEFAULT_REGIONS[0] || {
    id: 'sambas',
    name: 'Sambas',
    type: 'Kabupaten' as const,
    code: '6101',
  };

  const normInput = (inputStr || '').toLowerCase().trim();
  const normSheet = (sheetName || '').toLowerCase().trim();
  const normFile = (fileName || '').toLowerCase().trim();

  // 1. Check direct BPS code digits (e.g. 6171, 6101, 6172)
  const digits = normInput.replace(/\D/g, '');
  if (digits) {
    if (BPS_KAB_KOTA_MAP[digits]) {
      const regId = BPS_KAB_KOTA_MAP[digits];
      const found = DEFAULT_REGIONS.find((r) => r.id === regId);
      if (found) return found;
    }
    const foundByCode = DEFAULT_REGIONS.find((r) => r.code === digits || digits.includes(r.code));
    if (foundByCode) return foundByCode;
  }

  // 2. Search in input text, sheet name, or file name
  const candidateTexts = [normInput, normSheet, normFile];

  for (const text of candidateTexts) {
    if (!text) continue;

    // Check each region in DEFAULT_REGIONS
    for (const r of DEFAULT_REGIONS) {
      const rIdLower = (r.id || '').toLowerCase();
      const rNameLower = (r.name || '').toLowerCase();
      const cleanRegName = rNameLower.replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();

      if (
        text.includes(rIdLower) ||
        text.includes(rNameLower) ||
        (cleanRegName.length > 3 && text.includes(cleanRegName)) ||
        (r.code && text.includes(r.code))
      ) {
        return r;
      }
    }

    // Specific keyword fallbacks for Kalimantan Barat
    if (text.includes('pontianak')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'pontianak');
      if (found) return found;
    }
    if (text.includes('singkawang')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'singkawang');
      if (found) return found;
    }
    if (text.includes('kapuas') || text.includes('hulu') || text.includes('putussibau')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'kapuas_hulu');
      if (found) return found;
    }
    if (text.includes('kayong') || text.includes('sukadana')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'kayong_utara');
      if (found) return found;
    }
    if (text.includes('kubu') || text.includes('sungai raya')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'kubu_raya');
      if (found) return found;
    }
    if (text.includes('mempawah')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'mempawah');
      if (found) return found;
    }
    if (text.includes('bengkayang')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'bengkayang');
      if (found) return found;
    }
    if (text.includes('landak') || text.includes('ngabang')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'landak');
      if (found) return found;
    }
    if (text.includes('sanggau')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'sanggau');
      if (found) return found;
    }
    if (text.includes('ketapang')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'ketapang');
      if (found) return found;
    }
    if (text.includes('sintang')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'sintang');
      if (found) return found;
    }
    if (text.includes('sekadau')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'sekadau');
      if (found) return found;
    }
    if (text.includes('melawi') || text.includes('nanga pinoh')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'melawi');
      if (found) return found;
    }
    if (text.includes('sambas')) {
      const found = DEFAULT_REGIONS.find((r) => r.id === 'sambas');
      if (found) return found;
    }
  }

  return fallback;
}

/**
 * Classifies a column header for price readings
 */
function classifyPriceColumn(
  rawHeader: string
): 'm1Prev' | 'm2Prev' | 'm1Curr' | 'm2Curr' | 'prev' | 'curr' | null {
  const h = rawHeader.toLowerCase().trim();
  const c = h.replace(/[^a-z0-9]/g, '');

  const isM2 =
    h.includes('m2') ||
    h.includes('m-2') ||
    h.includes('minggu 2') ||
    h.includes('minggu ke-2') ||
    h.includes('pencacahan 2') ||
    c.includes('m2');

  const isM1 =
    (h.includes('m1') ||
      h.includes('m-1') ||
      h.includes('minggu 1') ||
      h.includes('minggu ke-1') ||
      h.includes('pencacahan 1') ||
      c.includes('m1')) &&
    !isM2;

  const isPrev =
    h.includes('n-1') ||
    h.includes('(n-1)') ||
    h.includes('n 1') ||
    c.includes('n1') ||
    h.includes('lalu') ||
    h.includes('sebelum') ||
    h.includes('kemarin') ||
    h.includes('dasar') ||
    c === 'po' ||
    c === 'p0';

  const isCurr =
    !isPrev &&
    (h.includes('(n)') ||
      h.includes(' n ') ||
      h.includes('bulan n') ||
      h.includes('ke n') ||
      c.endsWith('n') ||
      c.includes('bulann') ||
      h.includes('berjalan') ||
      h.includes('sekarang') ||
      h.includes('kini') ||
      h.includes('ini') ||
      c === 'pn' ||
      h.includes('terkini'));

  if (isM2 && isPrev) return 'm2Prev';
  if (isM2 && isCurr) return 'm2Curr';
  if (isM1 && isPrev) return 'm1Prev';
  if (isM1 && isCurr) return 'm1Curr';

  // Standalone M1 or M2 if context wasn't captured
  if (isM2) return 'm2Curr';
  if (isM1) return 'm1Curr';

  // Generic single-price columns (e.g. V-HPBS.1 or general table)
  if (isPrev && (h.includes('harga') || c.includes('harga') || c.startsWith('p'))) {
    return 'prev';
  }
  if (isCurr && (h.includes('harga') || c.includes('harga') || c.startsWith('p'))) {
    return 'curr';
  }

  return null;
}

export interface ParseHpbsDetailedResult {
  records: HpbsRespondentRecord[];
  detectedSheets: string[];
  totalRowsParsed: number;
  detectedPeriodTitle?: string;
  detectedRegions: string[];
  sheetDetails: {
    sheetName: string;
    recordCount: number;
    recognizedHeaders: string[];
  }[];
}

/**
 * Parses an uploaded Excel file adhering to the format of BPS V-HPBS / SHPB.
 * Supports:
 * - Multi-sheet workbooks
 * - Title and metadata rows before header (smart header row finder)
 * - 2-row merged headers (Harga Bulan Lalu -> M1, M2)
 * - Both V-HPBS.1 (bulanan) and V-HPBS.2 (mingguan)
 * - 14 Kab/Kota in Kalimantan Barat (names and BPS codes)
 */
export function parseHpbsExcelDetailed(
  data: ArrayBuffer,
  fileName = ''
): ParseHpbsDetailedResult {
  const workbook = XLSX.read(data, { type: 'array' });
  const allRecords: HpbsRespondentRecord[] = [];
  const detectedSheets: string[] = [];
  const sheetDetails: ParseHpbsDetailedResult['sheetDetails'] = [];
  const foundRegionIds = new Set<string>();
  let detectedPeriodTitle: string | undefined;

  let globalRowIdx = 1;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert to 2D array of rows
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (!matrix || matrix.length === 0) continue;

    // 1. Scan title / metadata rows for survey period label (e.g. "Agustus 2026", "Juli 2026")
    const scanLimit = Math.min(10, matrix.length);
    for (let r = 0; r < scanLimit; r++) {
      const rowStr = matrix[r].map((cell) => String(cell || '')).join(' ');
      const matchMonth = rowStr.match(
        /(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(202[4-9])/i
      );
      if (matchMonth && !detectedPeriodTitle) {
        detectedPeriodTitle = `${matchMonth[1]} ${matchMonth[2]}`;
      }
    }

    // 2. Find the actual table header row (inspect first 20 rows)
    let headerRowIdx = -1;
    let maxHeaderScore = 0;

    const maxHeaderScan = Math.min(25, matrix.length);
    for (let r = 0; r < maxHeaderScan; r++) {
      const row = matrix[r];
      let score = 0;
      for (const cell of row) {
        const str = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (str.includes('komoditas') || str.includes('komoditi') || str.includes('barang')) score += 4;
        if (str.includes('responden') || str.includes('pedagang') || str.includes('usaha') || str.includes('toko')) score += 4;
        if (str.includes('kode') || str === 'kd') score += 2;
        if (str.includes('m1') || str.includes('m2') || str.includes('harga') || str.includes('rh')) score += 3;
        if (str.includes('kabupaten') || str.includes('kota') || str.includes('wilayah')) score += 3;
        if (str.includes('satuan') || str.includes('kualitas')) score += 2;
        if (str.includes('kuesioner') || str.includes('hpbs')) score += 3;
      }
      if (score > maxHeaderScore && score >= 4) {
        maxHeaderScore = score;
        headerRowIdx = r;
      }
    }

    // If no explicit header row found, skip this sheet (probably cover/notes)
    if (headerRowIdx === -1) continue;

    // 3. Check for 2-row merged headers (e.g. Row 1: "Harga Bulan Lalu (N-1)", Row 2: "M1", "M2")
    const headerRow1 = matrix[headerRowIdx] || [];
    const headerRow2 = matrix[headerRowIdx + 1] || [];

    let isTwoRowHeader = false;
    if (headerRow2.length > 0) {
      const subRowScore = headerRow2.filter((c) => {
        const s = String(c || '').toLowerCase().trim();
        return s === 'm1' || s === 'm2' || s.includes('minggu') || s.includes('pencacahan');
      }).length;
      if (subRowScore >= 2) {
        isTwoRowHeader = true;
      }
    }

    // Combine headers if two-row
    const maxCols = Math.max(headerRow1.length, headerRow2.length);
    const combinedHeaders: string[] = [];
    let lastParentHeader = '';

    for (let c = 0; c < maxCols; c++) {
      const parent = String(headerRow1[c] || '').trim();
      if (parent) lastParentHeader = parent;

      if (isTwoRowHeader) {
        const child = String(headerRow2[c] || '').trim();
        if (child) {
          combinedHeaders.push(`${lastParentHeader} ${child}`.trim());
        } else {
          combinedHeaders.push(parent || lastParentHeader);
        }
      } else {
        combinedHeaders.push(parent);
      }
    }

    // 4. Map columns to indices
    let colKodeKabKota = -1;
    let colKabKota = -1;
    let colKodeResponden = -1;
    let colResponden = -1;
    let colKodeKomoditas = -1;
    let colKomoditas = -1;
    let colKodeKualitas = -1;
    let colKualitas = -1;
    let colSatuan = -1;
    let colKuesioner = -1;
    let colCatatanM1 = -1;
    let colCatatanM2 = -1;
    let colRhM1 = -1;
    let colRhM2 = -1;

    let colM1Prev = -1;
    let colM2Prev = -1;
    let colM1Curr = -1;
    let colM2Curr = -1;

    const recognizedList: string[] = [];

    // Context-aware pass: Disambiguate "Kode" columns (Kode Kab/Kota, Kode Responden, Kode Komoditas)
    combinedHeaders.forEach((h, idx) => {
      if (!h) return;
      const lower = h.toLowerCase().trim();
      const clean = lower.replace(/[^a-z0-9]/g, '');
      const nextH = (idx + 1 < combinedHeaders.length ? combinedHeaders[idx + 1] : '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');

      // Check price first
      const priceType = classifyPriceColumn(h);
      if (priceType) {
        if (priceType === 'm1Prev' && colM1Prev === -1) {
          colM1Prev = idx;
          recognizedList.push(`M1 (N-1): ${h}`);
          return;
        }
        if (priceType === 'm2Prev' && colM2Prev === -1) {
          colM2Prev = idx;
          recognizedList.push(`M2 (N-1): ${h}`);
          return;
        }
        if (priceType === 'm1Curr' && colM1Curr === -1) {
          colM1Curr = idx;
          recognizedList.push(`M1 (N): ${h}`);
          return;
        }
        if (priceType === 'm2Curr' && colM2Curr === -1) {
          colM2Curr = idx;
          recognizedList.push(`M2 (N): ${h}`);
          return;
        }
        if (priceType === 'prev' && colM1Prev === -1) {
          colM1Prev = idx;
          recognizedList.push(`Harga N-1: ${h}`);
          return;
        }
        if (priceType === 'curr' && colM1Curr === -1) {
          colM1Curr = idx;
          recognizedList.push(`Harga N: ${h}`);
          return;
        }
      }

      // Check RH columns
      if (clean === 'rhm1' || (clean.includes('rh') && clean.includes('m1'))) {
        colRhM1 = idx;
        return;
      }
      if (clean === 'rhm2' || (clean.includes('rh') && clean.includes('m2'))) {
        colRhM2 = idx;
        return;
      }

      // Disambiguate generic "Kode" / "Kd" column based on adjacent column or exact position
      if (clean === 'kode' || clean === 'kd' || clean === 'code') {
        if (nextH.includes('kab') || nextH.includes('kota') || idx === 0) {
          if (colKodeKabKota === -1) {
            colKodeKabKota = idx;
            recognizedList.push(`Kode Kab/Kota: ${h}`);
            return;
          }
        } else if (
          nextH.includes('responden') ||
          nextH.includes('pedagang') ||
          nextH.includes('toko') ||
          nextH.includes('usaha') ||
          idx === 2
        ) {
          if (colKodeResponden === -1) {
            colKodeResponden = idx;
            recognizedList.push(`Kode Responden: ${h}`);
            return;
          }
        } else if (
          nextH.includes('komoditas') ||
          nextH.includes('komoditi') ||
          nextH.includes('barang') ||
          idx === 4
        ) {
          if (colKodeKomoditas === -1) {
            colKodeKomoditas = idx;
            recognizedList.push(`Kode Komoditas: ${h}`);
            return;
          }
        }
      }

      // Check specific metadata columns
      if (
        (clean.includes('kodekab') || clean.includes('kdkab') || clean.includes('kodekota')) &&
        colKodeKabKota === -1
      ) {
        colKodeKabKota = idx;
        recognizedList.push(`Kode Kab/Kota: ${h}`);
      } else if (
        (clean.includes('koderesponden') || clean.includes('kdresponden') || clean.includes('kodetoko')) &&
        colKodeResponden === -1
      ) {
        colKodeResponden = idx;
        recognizedList.push(`Kode Responden: ${h}`);
      } else if (
        (clean.includes('responden') ||
          clean.includes('pedagang') ||
          clean.includes('namausaha') ||
          clean.includes('namaperusahaan') ||
          clean.includes('namatoko') ||
          clean === 'toko' ||
          clean === 'perusahaan') &&
        colResponden === -1
      ) {
        colResponden = idx;
        recognizedList.push(`Responden: ${h}`);
      } else if (
        (clean.includes('kodekomoditas') ||
          clean.includes('kdkomoditas') ||
          clean.includes('kodekomoditi') ||
          clean.includes('kodebarang')) &&
        colKodeKomoditas === -1
      ) {
        colKodeKomoditas = idx;
        recognizedList.push(`Kode Komoditas: ${h}`);
      } else if (
        (clean.includes('namakomoditas') ||
          clean.includes('namakomoditi') ||
          clean.includes('namabarang') ||
          clean.includes('uraiankomoditas') ||
          clean.includes('komoditas') ||
          clean.includes('komoditi') ||
          clean.includes('barang')) &&
        colKomoditas === -1
      ) {
        colKomoditas = idx;
        recognizedList.push(`Komoditas: ${h}`);
      } else if (
        (clean.includes('kodekualitas') || clean.includes('kdkualitas')) &&
        colKodeKualitas === -1
      ) {
        colKodeKualitas = idx;
        recognizedList.push(`Kode Kualitas: ${h}`);
      } else if (
        (clean.includes('kualitas') || clean.includes('spesifikasi') || clean.includes('merk')) &&
        colKualitas === -1
      ) {
        colKualitas = idx;
      } else if (
        (clean.includes('satuan') || clean.includes('unit') || clean.includes('ukuran') || clean.includes('standa')) &&
        colSatuan === -1
      ) {
        colSatuan = idx;
      } else if (
        (clean.includes('kuesioner') || clean.includes('formulir') || clean.includes('vhpbs')) &&
        colKuesioner === -1
      ) {
        colKuesioner = idx;
      } else if (
        (clean.includes('kabupaten') ||
          clean.includes('kabkota') ||
          clean.includes('wilayah') ||
          clean.includes('daerah') ||
          clean === 'kab' ||
          clean === 'kota' ||
          clean.includes('kdkab')) &&
        colKabKota === -1
      ) {
        colKabKota = idx;
        recognizedList.push(`Kab/Kota: ${h}`);
      } else if (clean.includes('catatanm1') || clean.includes('ketm1')) {
        colCatatanM1 = idx;
      } else if (clean.includes('catatanm2') || clean.includes('ketm2')) {
        colCatatanM2 = idx;
      }
    });

    // 5. Parse Data Rows starting below the header
    const dataStartRow = isTwoRowHeader ? headerRowIdx + 2 : headerRowIdx + 1;
    let sheetParsedCount = 0;

    for (let r = dataStartRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const getVal = (col: number) => (col >= 0 && col < row.length ? row[col] : '');

      const rawKodeKabKota = String(getVal(colKodeKabKota) || '').trim();
      const rawKabKota = String(getVal(colKabKota) || '').trim();
      const rawKodeResponden = String(getVal(colKodeResponden) || '').trim();
      const rawResponden = String(getVal(colResponden) || '').trim();
      const rawKodeKomoditas = String(getVal(colKodeKomoditas) || '').trim();
      const rawKomoditas = String(getVal(colKomoditas) || '').trim();
      const rawKodeKualitas = String(getVal(colKodeKualitas) || '').trim();
      const rawKualitas = String(getVal(colKualitas) || '').trim();
      const rawSatuan = String(getVal(colSatuan) || '').trim();
      const rawKuesioner = String(getVal(colKuesioner) || '').trim();
      const catatanM1 = String(getVal(colCatatanM1) || '').trim();
      const catatanM2 = String(getVal(colCatatanM2) || '').trim();

      const m1Prev = parsePriceValue(getVal(colM1Prev));
      const m2Prev = parsePriceValue(getVal(colM2Prev));
      const m1Curr = parsePriceValue(getVal(colM1Curr));
      const m2Curr = parsePriceValue(getVal(colM2Curr));

      // 1. Skip completely empty rows where there is no commodity, code, respondent, or price
      const hasAnyIdentifier =
        Boolean(rawKomoditas) ||
        Boolean(rawKodeKomoditas) ||
        Boolean(rawResponden) ||
        Boolean(rawKodeResponden);
      if (!hasAnyIdentifier) continue;

      // 2. Skip template instruction, footer text, or aggregate/total rows
      const upperKom = rawKomoditas.toUpperCase();
      if (
        upperKom === 'TOTAL' ||
        upperKom === 'JUMLAH' ||
        upperKom === 'RATA-RATA' ||
        upperKom === 'KOMODITAS LAINNYA' ||
        upperKom.includes('PETUNJUK PENGISIAN') ||
        upperKom.includes('KETERANGAN PENGISIAN') ||
        upperKom.includes('RELATIF HARGA MINGGU') ||
        upperKom.includes('KODE KOMODITAS') ||
        upperKom.includes('NAMA KOMODITAS') ||
        upperKom.includes('KODE SPESIFIKASI') ||
        upperKom.includes('DESKRIPSI DETAIL') ||
        upperKom.includes('SATUAN STANDAR') ||
        upperKom.includes('JENIS FORMULIR') ||
        upperKom.includes('CATATAN PETUGAS')
      ) {
        continue;
      }

      // 3. Skip template instruction / footer text rows
      const upperResp = rawResponden.toUpperCase();
      if (
        upperResp.includes('PETUNJUK PENGISIAN') ||
        upperResp.includes('RELATIF HARGA MINGGU') ||
        upperResp.includes('HARGA MINGGU KE-') ||
        upperResp.includes('DIHITUNG OTOMATIS') ||
        upperResp.includes('KHUSUS V-HPBS') ||
        upperResp.includes('NAMA TOKO, USAHA') ||
        upperResp.includes('KODE KOMODITAS STANDAR') ||
        upperResp.includes('NAMA KOMODITAS / BARANG') ||
        upperResp.includes('KODE SPESIFIKASI KUALITAS') ||
        upperResp.includes('DESKRIPSI DETAIL SPESIFIKASI') ||
        upperResp.includes('SATUAN STANDAR PENCACAHAN') ||
        upperResp.includes('JENIS FORMULIR: V-HPBS') ||
        upperResp.includes('CATATAN PETUGAS JIKA')
      ) {
        continue;
      }

      // 4. Must have either an actual commodity name or code, or a genuine price point
      if (!rawKomoditas && !rawKodeKomoditas && m1Prev === 0 && m1Curr === 0) {
        continue;
      }

      // Determine Questionnaire Type (V-HPBS.1 or V-HPBS.2)
      let kuesioner: HpbsQuestionnaireType = 'V-HPBS.1';
      if (
        rawKuesioner.toUpperCase().includes('V-HPBS.2') ||
        rawKuesioner.toUpperCase().includes('MINGGUAN') ||
        rawKuesioner === '2' ||
        sheetName.toUpperCase().includes('HPBS.2') ||
        sheetName.toUpperCase().includes('MINGGUAN') ||
        m2Prev > 0 ||
        m2Curr > 0
      ) {
        kuesioner = 'V-HPBS.2';
      }

      // Match regional Kab/Kota (prioritize direct BPS code like 6101)
      let matchedRegion = rawKodeKabKota ? DEFAULT_REGIONS.find((reg) => reg.code === rawKodeKabKota) : undefined;
      if (!matchedRegion) {
        matchedRegion = matchKabKota(rawKabKota, sheetName, fileName);
      }
      if (!matchedRegion) {
        matchedRegion = matchKabKota(rawResponden, sheetName, fileName) || DEFAULT_REGIONS[0];
      }

      const regName = matchedRegion?.name || 'Sambas';
      const regId = matchedRegion?.id || 'sambas';
      const regCode = matchedRegion?.code || rawKodeKabKota || '6101';
      foundRegionIds.add(regName);

      const finalKomoditas = rawKomoditas || (rawKodeKomoditas ? `Komoditas ${rawKodeKomoditas}` : 'KOMODITAS LAINNYA');
      const finalResponden = rawResponden || (rawKodeResponden ? `Responden ${rawKodeResponden}` : `Pedagang ${finalKomoditas}`);

      const recordObj = computeRespondentMetrics({
        id: `hpbs_row_${globalRowIdx++}`,
        kodeKabKota: regCode,
        kodeResponden: rawKodeResponden || `${regCode}${String(sheetParsedCount + 1).padStart(3, '0')}`,
        responden: finalResponden,
        kabKotaId: regId,
        kabKotaName: regName,
        kodeKomoditas: rawKodeKomoditas || `K_${globalRowIdx}`,
        komoditas: finalKomoditas,
        kodeKualitas: rawKodeKualitas || `${rawKodeKomoditas || 'K'}001`,
        kualitas: rawKualitas || '-',
        satuanStandar: rawSatuan || '1KG',
        kuesioner,
        m1Prev,
        m2Prev,
        m1Curr,
        m2Curr,
        catatanM1: catatanM1 || (m1Prev === 0 && m1Curr === 0 ? 'Non-Transaksi / Nihil' : ''),
        catatanM2,
      });

      if (!isValidHpbsRecord(recordObj)) {
        continue;
      }

      allRecords.push(recordObj);
      sheetParsedCount++;
    }

    if (sheetParsedCount > 0) {
      detectedSheets.push(sheetName);
      sheetDetails.push({
        sheetName,
        recordCount: sheetParsedCount,
        recognizedHeaders: recognizedList,
      });
    }
  }

  return {
    records: allRecords,
    detectedSheets,
    totalRowsParsed: allRecords.length,
    detectedPeriodTitle,
    detectedRegions: Array.from(foundRegionIds),
    sheetDetails,
  };
}

/**
 * Standard parse function returning records array
 */
export function parseHpbsExcel(data: ArrayBuffer, fileName = ''): HpbsRespondentRecord[] {
  const result = parseHpbsExcelDetailed(data, fileName);
  return result.records;
}

/**
 * Exports HPBS Analysis to Excel with multiple organized sheets
 */
/**
 * Official 18 headers as specified in BPS V-HPBS (matches user's image)
 */
export const HPBS_OFFICIAL_EXCEL_HEADERS = [
  'Kode Kabupaten/Kota',
  'Kabupaten/Kota',
  'Kode Responden',
  'Responden',
  'Kode Komoditas',
  'Komoditas',
  'Kode Kualitas',
  'Kualitas',
  'satuan_standar',
  'Kuesioner',
  'M1 (N-1)',
  'M2 (N-1)',
  'M1 (N)',
  'M2 (N)',
  'RH (M1)',
  'RH (M2)',
  'Catatan M1',
  'Catatan M2',
];

export function exportHpbsAnalysisToExcel(
  param1: HpbsCommodityAggregation[] | HpbsRespondentRecord[],
  param2?: HpbsRespondentRecord[] | string
) {
  let aggregations: HpbsCommodityAggregation[] = [];
  let rawRecords: HpbsRespondentRecord[] = [];

  if (Array.isArray(param1) && param1.length > 0 && 'kalbarRh' in param1[0]) {
    aggregations = param1 as HpbsCommodityAggregation[];
    rawRecords = (Array.isArray(param2) ? param2 : []) as HpbsRespondentRecord[];
  } else {
    rawRecords = (Array.isArray(param1) ? param1 : []) as HpbsRespondentRecord[];
    aggregations = aggregateHpbsData(rawRecords);
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Agregat Se-Kalimantan Barat & Matriks 14 Kab/Kota
  const headerRow = [
    'No',
    'Kode Komoditas',
    'Komoditas',
    'Satuan',
    'Kuesioner',
    'Jumlah Responden',
    'Cakupan Kab/Kota',
    'Rata-rata Geo Kalbar (N-1)',
    'Rata-rata Geo Kalbar (N)',
    'Relatif Harga Kalbar (RH)',
    'Perubahan (%)',
    'Status Kalbar',
    'Catatan',
    ...DEFAULT_REGIONS.map((r) => `RH ${r.name}`),
  ];

  const rowsData = aggregations.map((item, idx) => {
    const regRhValues = DEFAULT_REGIONS.map((r) => {
      const reg = item.regionalData[r.id];
      return reg ? reg.rh : '-';
    });

    return [
      idx + 1,
      item.kodeKomoditas,
      item.komoditas,
      item.satuanStandar,
      item.kuesioner,
      item.totalRespondents,
      `${item.monitoredRegionsCount} / 14`,
      item.kalbarGeoPrev,
      item.kalbarGeoCurr,
      item.kalbarRh,
      `${item.percentChange > 0 ? '+' : ''}${item.percentChange}%`,
      item.status,
      item.catatan || '-',
      ...regRhValues,
    ];
  });

  const wsAggregat = XLSX.utils.aoa_to_sheet([headerRow, ...rowsData]);
  wsAggregat['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 35 },
    ...DEFAULT_REGIONS.map(() => ({ wch: 12 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsAggregat, 'Agregat Kalbar & 14 Wilayah');

  // Sheet 2: Data Mentah Responden (Format 18 Kolom BPS + Kolom Analisis)
  const rawHeader = [
    ...HPBS_OFFICIAL_EXCEL_HEADERS,
    'Rata2 Geo Harga N-1',
    'Rata2 Geo Harga N',
    'RH Final',
    'Status',
  ];

  const rawRowsData = rawRecords.map((r, idx) => {
    const kabCode = r.kodeKabKota || DEFAULT_REGIONS.find((reg) => reg.id === r.kabKotaId)?.code || '6101';
    const kabName = (r.kabKotaName || 'SAMBAS').toUpperCase();
    const respCode = r.kodeResponden || `${kabCode}${String(idx + 1).padStart(3, '0')}`;

    return [
      kabCode,
      kabName,
      respCode,
      r.responden,
      r.kodeKomoditas,
      r.komoditas,
      r.kodeKualitas || `${r.kodeKomoditas}001`,
      r.kualitas || `${r.komoditas} (${r.satuanStandar})`,
      r.satuanStandar || '1KG',
      r.kuesioner || 'V-HPBS.1',
      r.m1Prev,
      r.m2Prev || 0,
      r.m1Curr,
      r.m2Curr || 0,
      r.rhM1 || 0,
      r.rhM2 || 0,
      r.catatanM1 || '',
      r.catatanM2 || '',
      r.geoPrev,
      r.geoCurr,
      r.rh,
      r.status,
    ];
  });

  const wsRaw = XLSX.utils.aoa_to_sheet([rawHeader, ...rawRowsData]);
  wsRaw['!cols'] = [
    { wch: 22 }, // Kode Kabupaten/Kota
    { wch: 18 }, // Kabupaten/Kota
    { wch: 16 }, // Kode Responden
    { wch: 34 }, // Responden
    { wch: 16 }, // Kode Komoditas
    { wch: 32 }, // Komoditas
    { wch: 18 }, // Kode Kualitas
    { wch: 45 }, // Kualitas
    { wch: 16 }, // satuan_standar
    { wch: 14 }, // Kuesioner
    { wch: 14 }, // M1 (N-1)
    { wch: 14 }, // M2 (N-1)
    { wch: 14 }, // M1 (N)
    { wch: 14 }, // M2 (N)
    { wch: 12 }, // RH (M1)
    { wch: 12 }, // RH (M2)
    { wch: 32 }, // Catatan M1
    { wch: 32 }, // Catatan M2
    { wch: 18 }, // Rata2 Geo N-1
    { wch: 18 }, // Rata2 Geo N
    { wch: 12 }, // RH Final
    { wch: 12 }, // Status
  ];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Data Responden V-HPBS');

  // Save and download
  XLSX.writeFile(wb, `Analisis_RH_Pedagang_Kalbar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports the 14 Kab/Kota RH Comparison Matrix to a specialized Excel (.xlsx) workbook
 * containing:
 * - Sheet 1: Matriks RH 14 Kab-Kota (per komoditas beserta ringkasan rata-rata dan komoditas naik/turun)
 * - Sheet 2: Level Harga Pedagang (rata-rata geometri harga N-1 dan N per komoditas di seluruh 14 kab/kota)
 * - Sheet 3: Statistik Per Wilayah (ringkasan kinerja harga, persentase naik/turun, dan titik responden)
 */
export function exportHpbsMatriksToExcel(
  aggregations: HpbsCommodityAggregation[],
  options?: {
    periodTitle?: string;
    filterQuery?: string;
    selectedRegionName?: string;
    selectedStatus?: string;
  }
) {
  const wb = XLSX.utils.book_new();
  const periodLabel = options?.periodTitle || 'Bulan Berjalan vs Bulan Sebelumnya';

  // -------------------------------------------------------------------------
  // Sheet 1: Matriks Relatif Harga (RH) 14 Kab/Kota
  // -------------------------------------------------------------------------
  const sheet1TitleRows: any[][] = [
    ['MATRIKS PERBANDINGAN RELATIF HARGA (RH) KOMODITAS DI 14 KABUPATEN / KOTA'],
    ['Survei Harga Perdagangan Besar (HPBS) - BPS Provinsi Kalimantan Barat'],
    [`Periode Analisis: ${periodLabel}`],
    [
      `Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })} | Total Komoditas: ${aggregations.length}`,
    ],
    ['Keterangan Nilai: RH > 100 (Naik) | RH < 100 (Turun) | RH = 100 (Stabil) | "-" (Tidak Terpantau)'],
    [],
  ];

  const sheet1Header = [
    'No',
    'Kode Komoditas',
    'Nama Komoditas',
    'Kuesioner',
    'Satuan Standar',
    'RH Agregat Kalbar',
    'Status Kalbar',
    'Perubahan Kalbar (%)',
    ...DEFAULT_REGIONS.map((r) => `RH ${r.name}`),
    'Wilayah RH Tertinggi',
    'Wilayah RH Terendah',
    'Cakupan Wilayah',
    'Total Responden',
    'Catatan Komoditas',
  ];

  const sheet1DataRows = aggregations.map((item, idx) => {
    const regRhValues = DEFAULT_REGIONS.map((r) => {
      const reg = item.regionalData[r.id];
      return reg ? Number(reg.rh.toFixed(2)) : '-';
    });

    const highestText = item.highestRegion
      ? `${item.highestRegion.kabKotaName} (${item.highestRegion.rh.toFixed(2)})`
      : '-';
    const lowestText = item.lowestRegion
      ? `${item.lowestRegion.kabKotaName} (${item.lowestRegion.rh.toFixed(2)})`
      : '-';

    return [
      idx + 1,
      item.kodeKomoditas,
      item.komoditas,
      item.kuesioner,
      item.satuanStandar,
      item.kalbarRh,
      item.status,
      Number(item.percentChange.toFixed(2)),
      ...regRhValues,
      highestText,
      lowestText,
      `${item.monitoredRegionsCount} / 14`,
      item.totalRespondents,
      item.catatan || '-',
    ];
  });

  // Summary statistics for Sheet 1
  const kalbarValidRhs = aggregations.map((a) => a.kalbarRh).filter((v) => v > 0);
  const avgKalbarRh =
    kalbarValidRhs.length > 0
      ? Number((kalbarValidRhs.reduce((sum, v) => sum + v, 0) / kalbarValidRhs.length).toFixed(2))
      : 0;

  const regAvgRhs = DEFAULT_REGIONS.map((r) => {
    const vals = aggregations
      .map((a) => a.regionalData[r.id]?.rh)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    return vals.length > 0
      ? Number((vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(2))
      : '-';
  });

  const kalbarNaikCount = aggregations.filter((a) => a.status === 'NAIK').length;
  const regNaikCounts = DEFAULT_REGIONS.map(
    (r) => aggregations.filter((a) => a.regionalData[r.id]?.status === 'NAIK').length
  );

  const kalbarTurunCount = aggregations.filter((a) => a.status === 'TURUN').length;
  const regTurunCounts = DEFAULT_REGIONS.map(
    (r) => aggregations.filter((a) => a.regionalData[r.id]?.status === 'TURUN').length
  );

  const kalbarStabilCount = aggregations.filter((a) => a.status === 'STABIL').length;
  const regStabilCounts = DEFAULT_REGIONS.map(
    (r) => aggregations.filter((a) => a.regionalData[r.id]?.status === 'STABIL').length
  );

  const regObservedCounts = DEFAULT_REGIONS.map(
    (r) => aggregations.filter((a) => !!a.regionalData[r.id]).length
  );

  const sheet1SummaryRows: any[][] = [
    [],
    [
      '',
      '',
      'RATA-RATA RH WILAYAH',
      '',
      '',
      avgKalbarRh,
      avgKalbarRh > 100 ? 'NAIK' : avgKalbarRh < 100 ? 'TURUN' : 'STABIL',
      Number((avgKalbarRh - 100).toFixed(2)),
      ...regAvgRhs,
      '',
      '',
      '',
      '',
      '',
    ],
    [
      '',
      '',
      'KOMODITAS NAIK (RH > 100)',
      '',
      '',
      kalbarNaikCount,
      `${((kalbarNaikCount / (aggregations.length || 1)) * 100).toFixed(1)}%`,
      '',
      ...regNaikCounts,
      '',
      '',
      '',
      '',
      '',
    ],
    [
      '',
      '',
      'KOMODITAS TURUN (RH < 100)',
      '',
      '',
      kalbarTurunCount,
      `${((kalbarTurunCount / (aggregations.length || 1)) * 100).toFixed(1)}%`,
      '',
      ...regTurunCounts,
      '',
      '',
      '',
      '',
      '',
    ],
    [
      '',
      '',
      'KOMODITAS STABIL (RH = 100)',
      '',
      '',
      kalbarStabilCount,
      `${((kalbarStabilCount / (aggregations.length || 1)) * 100).toFixed(1)}%`,
      '',
      ...regStabilCounts,
      '',
      '',
      '',
      '',
      '',
    ],
    [
      '',
      '',
      'JUMLAH KOMODITAS TERPANTAU',
      '',
      '',
      aggregations.length,
      '100%',
      '',
      ...regObservedCounts,
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  const wsSheet1 = XLSX.utils.aoa_to_sheet([
    ...sheet1TitleRows,
    sheet1Header,
    ...sheet1DataRows,
    ...sheet1SummaryRows,
  ]);

  wsSheet1['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    ...DEFAULT_REGIONS.map(() => ({ wch: 15 })),
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 38 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSheet1, 'Matriks RH 14 Kab-Kota');

  // -------------------------------------------------------------------------
  // Sheet 2: Matriks Level Harga Pedagang (Rata-rata Geometri N-1 vs N)
  // -------------------------------------------------------------------------
  const sheet2TitleRows: any[][] = [
    ['MATRIKS TINGKAT HARGA PEDAGANG BESAR (N-1 vs N) DI 14 KABUPATEN / KOTA'],
    ['Survei Harga Perdagangan Besar (HPBS) - BPS Provinsi Kalimantan Barat'],
    [`Periode Analisis: ${periodLabel}`],
    ['Satuan: Rupiah (Rp) per Satuan Standar Komoditas | Dihitung Menggunakan Rata-Rata Geometri'],
    [],
  ];

  const sheet2Header = [
    'No',
    'Kode Komoditas',
    'Nama Komoditas',
    'Satuan',
    'Kuesioner',
    'Harga Kalbar (N-1)',
    'Harga Kalbar (N)',
    'RH Kalbar',
    ...DEFAULT_REGIONS.flatMap((r) => [
      `${r.name} - Harga (N-1)`,
      `${r.name} - Harga (N)`,
      `${r.name} - RH`,
    ]),
  ];

  const sheet2DataRows = aggregations.map((item, idx) => {
    const regPriceCols = DEFAULT_REGIONS.flatMap((r): (string | number)[] => {
      const reg = item.regionalData[r.id];
      if (!reg) return ['-', '-', '-'];
      return [reg.geoPrev, reg.geoCurr, reg.rh];
    });

    return [
      idx + 1,
      item.kodeKomoditas,
      item.komoditas,
      item.satuanStandar,
      item.kuesioner,
      item.kalbarGeoPrev,
      item.kalbarGeoCurr,
      item.kalbarRh,
      ...regPriceCols,
    ];
  });

  const wsSheet2 = XLSX.utils.aoa_to_sheet([
    ...sheet2TitleRows,
    sheet2Header,
    ...sheet2DataRows,
  ]);

  wsSheet2['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    ...DEFAULT_REGIONS.flatMap(() => [
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ]),
  ];

  XLSX.utils.book_append_sheet(wb, wsSheet2, 'Level Harga Pedagang');

  // -------------------------------------------------------------------------
  // Sheet 3: Ringkasan Kinerja & Statistik per Wilayah
  // -------------------------------------------------------------------------
  const sheet3TitleRows: any[][] = [
    ['RINGKASAN STATISTIK HARGA PER KABUPATEN / KOTA PROVINSI KALIMANTAN BARAT'],
    ['Survei Harga Perdagangan Besar (HPBS) - BPS Provinsi Kalimantan Barat'],
    [`Periode Analisis: ${periodLabel}`],
    [],
  ];

  const sheet3Header = [
    'No',
    'Kode Wilayah BPS',
    'Nama Kabupaten / Kota',
    'Rata-rata RH',
    'Status Rata-rata',
    'Komoditas Terpantau',
    'Komoditas Naik',
    'Komoditas Turun',
    'Komoditas Stabil',
    '% Naik',
    '% Turun',
    'Total Titik Pantau Responden',
  ];

  const sheet3DataRows = DEFAULT_REGIONS.map((r, idx) => {
    const regAggs = aggregations
      .map((a) => a.regionalData[r.id])
      .filter((v): v is HpbsRegionalCommodityAggregation => !!v);

    const totalObs = regAggs.length;
    const naik = regAggs.filter((x) => x.status === 'NAIK').length;
    const turun = regAggs.filter((x) => x.status === 'TURUN').length;
    const stabil = regAggs.filter((x) => x.status === 'STABIL').length;

    const avgRh =
      totalObs > 0
        ? Number((regAggs.reduce((sum, x) => sum + x.rh, 0) / totalObs).toFixed(2))
        : 0;

    const totalResp = regAggs.reduce((sum, x) => sum + (x.respondentCount || 0), 0);

    return [
      idx + 1,
      r.code,
      r.name,
      avgRh > 0 ? avgRh : '-',
      avgRh > 100.005 ? 'NAIK' : avgRh < 99.995 && avgRh > 0 ? 'TURUN' : 'STABIL',
      totalObs,
      naik,
      turun,
      stabil,
      totalObs > 0 ? Number(((naik / totalObs) * 100).toFixed(1)) : 0,
      totalObs > 0 ? Number(((turun / totalObs) * 100).toFixed(1)) : 0,
      totalResp,
    ];
  });

  sheet3DataRows.push([
    '',
    '6100',
    'PROVINSI KALIMANTAN BARAT (AGREGAT)',
    avgKalbarRh,
    avgKalbarRh > 100.005 ? 'NAIK' : avgKalbarRh < 99.995 ? 'TURUN' : 'STABIL',
    aggregations.length,
    kalbarNaikCount,
    kalbarTurunCount,
    kalbarStabilCount,
    Number(((kalbarNaikCount / (aggregations.length || 1)) * 100).toFixed(1)),
    Number(((kalbarTurunCount / (aggregations.length || 1)) * 100).toFixed(1)),
    aggregations.reduce((acc, a) => acc + a.totalRespondents, 0),
  ]);

  const wsSheet3 = XLSX.utils.aoa_to_sheet([
    ...sheet3TitleRows,
    sheet3Header,
    ...sheet3DataRows,
  ]);

  wsSheet3['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSheet3, 'Statistik Per Wilayah');

  const cleanPeriod = (options?.periodTitle || 'HPBS')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 25);
  const fileName = `Matriks_RH_14_KabKota_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Downloads a pre-filled V-HPBS Excel template matching image.png exactly.
 * If sampleRecords is empty or not provided, it generates authentic Sambas BPS rows.
 */
export function downloadHpbsTemplateExcel(sampleRecords: HpbsRespondentRecord[] = []) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template V-HPBS (18 Columns matching image.png)
  let dataRows: any[][];

  if (sampleRecords && sampleRecords.length > 0) {
    dataRows = sampleRecords.map((r, idx) => {
      const kabCode = r.kodeKabKota || DEFAULT_REGIONS.find((reg) => reg.id === r.kabKotaId)?.code || '6101';
      const kabName = (r.kabKotaName || 'SAMBAS').toUpperCase();
      const respCode = r.kodeResponden || `${kabCode}${String(idx + 1).padStart(3, '0')}`;

      return [
        kabCode,
        kabName,
        respCode,
        r.responden,
        r.kodeKomoditas,
        r.komoditas,
        r.kodeKualitas || `${r.kodeKomoditas}001`,
        r.kualitas || `${r.komoditas} (${r.satuanStandar})`,
        r.satuanStandar || '1 KG',
        r.kuesioner || 'V-HPBS.1',
        r.m1Prev,
        r.m2Prev || 0,
        r.m1Curr,
        r.m2Curr || 0,
        r.rhM1 || 0,
        r.rhM2 || 0,
        r.catatanM1 || '',
        r.catatanM2 || '',
      ];
    });
  } else {
    // Authentic Sambas data from image.png
    dataRows = OFFICIAL_SAMBAS_BPS_ROWS.map((row) => [
      row.kodeKabKota,
      row.kabKotaName,
      row.kodeResponden,
      row.responden,
      row.kodeKomoditas,
      row.komoditas,
      row.kodeKualitas,
      row.kualitas,
      row.satuanStandar,
      row.kuesioner,
      row.m1Prev,
      row.m2Prev,
      row.m1Curr,
      row.m2Curr,
      row.rhM1 ?? 0,
      row.rhM2 ?? 0,
      row.catatanM1 || '',
      row.catatanM2 || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet([HPBS_OFFICIAL_EXCEL_HEADERS, ...dataRows]);

  // Set column widths matching BPS spreadsheet layout
  ws['!cols'] = [
    { wch: 22 }, // Kode Kabupaten/Kota
    { wch: 18 }, // Kabupaten/Kota
    { wch: 16 }, // Kode Responden
    { wch: 34 }, // Responden
    { wch: 16 }, // Kode Komoditas
    { wch: 32 }, // Komoditas
    { wch: 18 }, // Kode Kualitas
    { wch: 45 }, // Kualitas
    { wch: 16 }, // satuan_standar
    { wch: 14 }, // Kuesioner
    { wch: 14 }, // M1 (N-1)
    { wch: 14 }, // M2 (N-1)
    { wch: 14 }, // M1 (N)
    { wch: 14 }, // M2 (N)
    { wch: 12 }, // RH (M1)
    { wch: 12 }, // RH (M2)
    { wch: 32 }, // Catatan M1
    { wch: 32 }, // Catatan M2
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'V-HPBS');

  // Sheet 2: Petunjuk & Kamus Kolom BPS
  const guideHeaders = ['No', 'Nama Kolom', 'Wajib', 'Format / Contoh', 'Keterangan Penjelasan'];
  const guideRows = [
    ['1', 'Kode Kabupaten/Kota', 'Ya', '6101, 6171, 6102, dst', 'Kode Wilayah Kabupaten / Kota BPS Kalbar (6101=Sambas, 6171=Pontianak)'],
    ['2', 'Kabupaten/Kota', 'Ya', 'SAMBAS, PONTIANAK, SINGKAWANG', 'Nama Kabupaten atau Kota lokasi pencacahan survei'],
    ['3', 'Kode Responden', 'Ya', '6101004, 6101015, dst', 'Kode Unik Responden / Pelaku Usaha Pedagang Besar'],
    ['4', 'Responden', 'Ya', 'MITRA AYAM SAMBAS SUNSUNG, TOKO DAMAI', 'Nama Toko, Usaha, Distributor, atau Pedagang Besar'],
    ['5', 'Kode Komoditas', 'Ya', '2112101001, 2316101003', 'Kode Komoditas Standar BPS (10 Digit)'],
    ['6', 'Komoditas', 'Ya', 'DAGING AYAM RAS, BERAS BIASA', 'Nama Komoditas / Barang yang dicacah harganya'],
    ['7', 'Kode Kualitas', 'Opsional', '2112101001001', 'Kode Spesifikasi Kualitas Barang'],
    ['8', 'Kualitas', 'Opsional', 'DAGING AYAM RAS SEGAR (1KG)', 'Deskripsi detail spesifikasi / merk / kemasan barang'],
    ['9', 'satuan_standar', 'Ya', '1 KG, 1 LITER, 10 KG, 1 BUTIR, 1 GRAM', 'Satuan standar pencacahan harga'],
    ['10', 'Kuesioner', 'Ya', 'V-HPBS.1 atau V-HPBS.2', 'Jenis Formulir: V-HPBS.1 (Bulanan: M1 saja) atau V-HPBS.2 (Mingguan: M1 & M2)'],
    ['11', 'M1 (N-1)', 'Ya', '43000', 'Harga Minggu ke-1 pada Bulan Sebelumnya (N-1)'],
    ['12', 'M2 (N-1)', 'Kondisional', '43000 (atau 0)', 'Harga Minggu ke-2 Bulan Sebelumnya (N-1) — Khusus V-HPBS.2, isi 0 jika V-HPBS.1'],
    ['13', 'M1 (N)', 'Ya', '40000', 'Harga Minggu ke-1 pada Bulan Berjalan (N)'],
    ['14', 'M2 (N)', 'Kondisional', '40000 (atau 0)', 'Harga Minggu ke-2 Bulan Berjalan (N) — Khusus V-HPBS.2, isi 0 jika V-HPBS.1'],
    ['15', 'RH (M1)', 'Otomatis', '93.02', 'Relatif Harga Minggu 1 = (M1 N / M1 N-1) * 100 (Dihitung otomatis jika kosong)'],
    ['16', 'RH (M2)', 'Otomatis', '100.00', 'Relatif Harga Minggu 2 = (M2 N / M2 N-1) * 100 (Dihitung otomatis jika kosong)'],
    ['17', 'Catatan M1', 'Opsional', 'Pasokan bertambah dari peternak lokal', 'Catatan petugas jika harga mengalami kenaikan/penurunan tajam pada M1'],
    ['18', 'Catatan M2', 'Opsional', 'Harga distributor stabil', 'Catatan petugas jika harga mengalami kenaikan/penurunan tajam pada M2'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
  wsGuide['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 32 },
    { wch: 75 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk & Kamus Kolom BPS');

  XLSX.writeFile(wb, `Template_V-HPBS_Relatif_Harga_BPS.xlsx`);
}

/**
 * Adjusts prices for a respondent record and recalculates RH automatically.
 */
export function adjustRespondentPrice(
  record: HpbsRespondentRecord,
  newPrices: {
    m1Prev?: number;
    m2Prev?: number;
    m1Curr?: number;
    m2Curr?: number;
    adjustmentNote?: string;
  }
): HpbsRespondentRecord {
  // Store original prices before first adjustment
  const originalPrices = record.originalPrices || {
    m1Prev: record.m1Prev,
    m2Prev: record.m2Prev,
    m1Curr: record.m1Curr,
    m2Curr: record.m2Curr,
    geoPrev: record.geoPrev,
    geoCurr: record.geoCurr,
    rh: record.rh,
    status: record.status,
  };

  const m1Prev = typeof newPrices.m1Prev === 'number' ? newPrices.m1Prev : record.m1Prev;
  const m2Prev = typeof newPrices.m2Prev === 'number' ? newPrices.m2Prev : record.m2Prev;
  const m1Curr = typeof newPrices.m1Curr === 'number' ? newPrices.m1Curr : record.m1Curr;
  const m2Curr = typeof newPrices.m2Curr === 'number' ? newPrices.m2Curr : record.m2Curr;

  const recomputed = computeRespondentMetrics({
    ...record,
    m1Prev,
    m2Prev,
    m1Curr,
    m2Curr,
    catatanM1: newPrices.adjustmentNote || record.catatanM1,
  });

  return {
    ...recomputed,
    isAdjusted: true,
    adjustedAt: new Date().toISOString(),
    adjustmentNote: newPrices.adjustmentNote || record.adjustmentNote,
    originalPrices,
  };
}

/**
 * Resets an adjusted respondent record back to its original prices.
 */
export function resetRespondentPrice(record: HpbsRespondentRecord): HpbsRespondentRecord {
  if (!record.originalPrices) return record;

  const orig = record.originalPrices;
  const recomputed = computeRespondentMetrics({
    ...record,
    m1Prev: orig.m1Prev,
    m2Prev: orig.m2Prev,
    m1Curr: orig.m1Curr,
    m2Curr: orig.m2Curr,
    catatanM1: record.catatanM1,
  });

  return {
    ...recomputed,
    isAdjusted: false,
    adjustedAt: undefined,
    adjustmentNote: undefined,
    originalPrices: undefined,
  };
}

/**
 * Computes routine monthly time-series and stability analysis for commodities.
 * Can be computed for all of Kalbar or for a specific Kab/Kota.
 */
export function computeStabilityAnalysis(
  periods: HpbsMonthlyPeriod[],
  scopeType: 'kalbar' | 'regional',
  regionId?: string
): CommodityStabilityAnalysis[] {
  if (!periods || periods.length === 0) return [];

  // Sort periods chronologically (oldest to newest for charting)
  // assuming id is YYYY-MM
  const sortedPeriods = [...periods].sort((a, b) => a.id.localeCompare(b.id));

  // Extract all distinct commodities across all periods
  const commodityMap = new Map<
    string,
    {
      kodeKomoditas: string;
      komoditas: string;
      kuesioner: HpbsQuestionnaireType;
      satuanStandar: string;
    }
  >();

  sortedPeriods.forEach((period) => {
    period.records.forEach((r) => {
      if (!commodityMap.has(r.kodeKomoditas)) {
        commodityMap.set(r.kodeKomoditas, {
          kodeKomoditas: r.kodeKomoditas,
          komoditas: r.komoditas,
          kuesioner: r.kuesioner,
          satuanStandar: r.satuanStandar,
        });
      }
    });
  });

  // Calculate region name if applicable
  const targetRegion = regionId ? DEFAULT_REGIONS.find((r) => r.id === regionId) : undefined;
  const regionName = targetRegion ? targetRegion.name : undefined;

  const results: CommodityStabilityAnalysis[] = [];

  commodityMap.forEach((meta, kodeKomoditas) => {
    const series: CommodityMonthlyPoint[] = [];

    sortedPeriods.forEach((period) => {
      // Filter records
      let relevantRecords = period.records.filter((r) => r.kodeKomoditas === kodeKomoditas);
      if (scopeType === 'regional' && regionId) {
        relevantRecords = relevantRecords.filter((r) => r.kabKotaId === regionId);
      }

      if (relevantRecords.length === 0) return;

      let rh = 100;
      let geoPrev = 0;
      let geoCurr = 0;

      if (scopeType === 'regional') {
        // Geometric mean of respondent RHs or geo mean of prices
        const prevPrices = relevantRecords.map((r) => r.geoPrev).filter((p) => p > 0);
        const currPrices = relevantRecords.map((r) => r.geoCurr).filter((p) => p > 0);
        geoPrev = calculateGeometricMean(prevPrices);
        geoCurr = calculateGeometricMean(currPrices);
        rh = geoPrev > 0 ? (geoCurr / geoPrev) * 100 : 100;
      } else {
        // Kalbar aggregate: group by region first, then geometric mean across regions
        const regionRhList: number[] = [];
        const regionGeoPrevList: number[] = [];
        const regionGeoCurrList: number[] = [];

        DEFAULT_REGIONS.forEach((reg) => {
          const regRecs = relevantRecords.filter((r) => r.kabKotaId === reg.id);
          if (regRecs.length > 0) {
            const pPrev = calculateGeometricMean(regRecs.map((r) => r.geoPrev).filter((p) => p > 0));
            const pCurr = calculateGeometricMean(regRecs.map((r) => r.geoCurr).filter((p) => p > 0));
            if (pPrev > 0) {
              const regRh = (pCurr / pPrev) * 100;
              regionRhList.push(regRh);
              regionGeoPrevList.push(pPrev);
              regionGeoCurrList.push(pCurr);
            }
          }
        });

        if (regionRhList.length > 0) {
          rh = calculateGeometricMean(regionRhList);
          geoPrev = calculateGeometricMean(regionGeoPrevList);
          geoCurr = calculateGeometricMean(regionGeoCurrList);
        }
      }

      rh = parseFloat(rh.toFixed(2));
      geoPrev = Math.round(geoPrev * 100) / 100;
      geoCurr = Math.round(geoCurr * 100) / 100;

      const status: 'NAIK' | 'TURUN' | 'STABIL' =
        rh >= 100.005 ? 'NAIK' : rh <= 99.995 ? 'TURUN' : 'STABIL';

      series.push({
        periodId: period.id,
        periodLabel: period.label,
        shortLabel: period.shortLabel,
        rh,
        status,
        geoPrev,
        geoCurr,
      });
    });

    if (series.length === 0) return;

    const rhValues = series.map((s) => s.rh);
    const averageRh = parseFloat(
      (rhValues.reduce((acc, v) => acc + v, 0) / rhValues.length).toFixed(2)
    );
    const minRh = Math.min(...rhValues);
    const maxRh = Math.max(...rhValues);

    // Volatility: average absolute deviation from 100 (|RH - 100|)
    const volatility = parseFloat(
      (
        rhValues.reduce((acc, v) => acc + Math.abs(v - 100), 0) / rhValues.length
      ).toFixed(2)
    );

    // Stable months count: where |RH - 100| <= 0.5% (99.50 - 100.50)
    const stableMonthsCount = rhValues.filter((v) => Math.abs(v - 100) <= 0.5).length;

    // Frekuensi berapa kali ada RH yang mengalami perubahan (nilai RH !== 100)
    // Toleransi numerik 0.001 untuk presisi float
    const changedRhCount = rhValues.filter((v) => Math.abs(v - 100) > 0.001).length;
    const changedRhPercentage = series.length > 0
      ? parseFloat(((changedRhCount / series.length) * 100).toFixed(1))
      : 0;
    const upRhCount = rhValues.filter((v) => v > 100.001).length;
    const downRhCount = rhValues.filter((v) => v < 99.999).length;

    // Stability classification:
    // SANGAT_STABIL: volatility < 1.0 (fluctuates less than 1% on average)
    // MODERAT: volatility between 1.0 and 3.5
    // FLUKTUATIF: volatility >= 3.5
    let stabilityLevel: StabilityLevel = 'MODERAT';
    if (volatility < 1.0) {
      stabilityLevel = 'SANGAT_STABIL';
    } else if (volatility >= 3.5) {
      stabilityLevel = 'FLUKTUATIF';
    }

    // Trend based on last 2-3 months
    let trend: 'STABIL' | 'CENDERUNG_NAIK' | 'CENDERUNG_TURUN' = 'STABIL';
    if (series.length >= 2) {
      const lastPoint = series[series.length - 1];
      const prevPoint = series[series.length - 2];
      if (lastPoint.rh > 100.5 && prevPoint.rh >= 100.0) {
        trend = 'CENDERUNG_NAIK';
      } else if (lastPoint.rh < 99.5 && prevPoint.rh <= 100.0) {
        trend = 'CENDERUNG_TURUN';
      }
    }

    results.push({
      kodeKomoditas,
      komoditas: meta.komoditas,
      kuesioner: meta.kuesioner,
      satuanStandar: meta.satuanStandar,
      scopeType,
      regionId,
      regionName,
      series,
      averageRh,
      minRh,
      maxRh,
      volatility,
      stabilityLevel,
      stableMonthsCount,
      changedRhCount,
      changedRhPercentage,
      upRhCount,
      downRhCount,
      totalMonths: series.length,
      trend,
    });
  });

  // Sort by stability (SANGAT_STABIL first, then lowest volatility)
  return results.sort((a, b) => {
    const order: Record<StabilityLevel, number> = {
      SANGAT_STABIL: 1,
      MODERAT: 2,
      FLUKTUATIF: 3,
    };
    if (order[a.stabilityLevel] !== order[b.stabilityLevel]) {
      return order[a.stabilityLevel] - order[b.stabilityLevel];
    }
    return a.volatility - b.volatility;
  });
}

/**
 * Exports stability time series to Excel
 */
export function exportHpbsStabilityToExcel(
  analyses: CommodityStabilityAnalysis[],
  scopeLabel: string
) {
  const wb = XLSX.utils.book_new();

  // Find all unique periods across analyses
  const periodHeaders: string[] = [];
  if (analyses.length > 0) {
    analyses[0].series.forEach((s) => {
      periodHeaders.push(`RH ${s.shortLabel}`);
    });
  }

  const headers = [
    'Kode',
    'Komoditas',
    'Kuesioner',
    'Satuan',
    'Klasifikasi Stabilitas',
    'Perubahan RH (RH ≠ 100)',
    'Persentase Periode Berubah (%)',
    'Tingkat Volatilitas (|RH-100|)',
    'Rata-rata RH',
    'Min RH',
    'Max RH',
    'Bulan Stabil',
    'Tren Terakhir',
    ...periodHeaders,
  ];

  const rows = analyses.map((a) => {
    const periodVals = a.series.map((s) => s.rh);
    const stabLabel =
      a.stabilityLevel === 'SANGAT_STABIL'
        ? 'Sangat Stabil'
        : a.stabilityLevel === 'MODERAT'
        ? 'Moderat'
        : 'Fluktuatif (Volatil)';

    return [
      a.kodeKomoditas,
      a.komoditas,
      a.kuesioner,
      a.satuanStandar,
      stabLabel,
      `${a.changedRhCount}/${a.totalMonths}`,
      `${a.changedRhPercentage}%`,
      a.volatility,
      a.averageRh,
      a.minRh,
      a.maxRh,
      `${a.stableMonthsCount}/${a.totalMonths}`,
      a.trend,
      ...periodVals,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [`ANALISIS SERIES & STABILITAS RELATIF HARGA (V-HPBS) - ${scopeLabel.toUpperCase()}`],
    [`Diekspor pada: ${new Date().toLocaleString('id-ID')}`],
    [],
    headers,
    ...rows,
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Series Stabilitas RH');
  XLSX.writeFile(
    wb,
    `Series_Stabilitas_RH_HPBS_${scopeLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

