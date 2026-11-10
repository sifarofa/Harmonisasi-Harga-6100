import * as XLSX from 'xlsx';
import { MASTER_COMMODITIES, MasterCommodity } from '../data/initialData';
import {
  CommodityCategory,
  CommodityRecord,
  MonthlyHarmonizationDataset,
  PriceLevel,
  PriceStatus,
  RegionInfo,
} from '../types';
import { computeOverallStatus } from './analysis';

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export interface ParsedWorkbookResult {
  datasets: MonthlyHarmonizationDataset[];
  sheetCount: number;
  message?: string;
}

// Helper to detect month index and label from sheet name or filename
export function detectMonthInfo(
  name: string,
  defaultIdx: number = 1,
  defaultYear: number = 2024
): { month: number; year: number; label: string } {
  const clean = name.toLowerCase().trim();

  // 1. Extract 4-digit year (e.g. 2023, 2024, 2025, 2026, 2027)
  const fourDigitMatch = clean.match(/\b(20\d\d)\b/) || clean.match(/(20\d\d)/);
  let year = fourDigitMatch ? parseInt(fourDigitMatch[1], 10) : defaultYear;

  // 2. If no 4-digit year found, check for 2-digit year like '25, 25, 26
  if (!fourDigitMatch) {
    const twoDigitMatch = clean.match(/(?:^|[-_./\s'’])(?:20)?(2[3-9]|3[0-5])(?:$|[-_./\s])/);
    if (twoDigitMatch) {
      year = 2000 + parseInt(twoDigitMatch[1], 10);
    }
  }

  // Remove the detected year from the clean string so that numbers in the year don't falsely match month numbers
  const textWithoutYear = clean.replace(String(year), ' ').replace(/20\d\d/g, ' ');

  const monthNames: [string[], number][] = [
    [['januari', 'january', 'jan', 'jan.'], 1],
    [['februari', 'february', 'feb', 'pebruari', 'feb.'], 2],
    [['maret', 'march', 'mar', 'mar.'], 3],
    [['april', 'apr', 'apr.'], 4],
    [['mei', 'may'], 5],
    [['juni', 'june', 'jun', 'jun.'], 6],
    [['juli', 'july', 'jul', 'jul.'], 7],
    [['agustus', 'august', 'agu', 'aug', 'agt', 'agst', 'agu.'], 8],
    [['september', 'sept', 'sep', 'sept.', 'sep.'], 9],
    [['oktober', 'october', 'okt', 'oct', 'okt.'], 10],
    [['november', 'nov', 'nopember', 'nov.'], 11],
    [['desember', 'december', 'des', 'dec', 'dsb', 'des.'], 12],
  ];

  for (const [aliases, mNum] of monthNames) {
    for (const alias of aliases) {
      // Look for full word or token boundary match
      const regex = new RegExp(`(?:^|[^a-z0-9])${alias}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(textWithoutYear)) {
        return {
          month: mNum,
          year,
          label: `${MONTH_NAMES[mNum - 1]} ${year}`,
        };
      }
    }
  }

  // Look for numerical month representation such as "Bulan 12", "Bulan 07", "M12", "M07", "12-2025", or standalone "01" - "12"
  const numMatch = textWithoutYear.match(/(?:bulan|bln|m|periode)?\s*[-_./\s]?\b(0?[1-9]|1[0-2])\b/i);
  if (numMatch) {
    const mNum = parseInt(numMatch[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return {
        month: mNum,
        year,
        label: `${MONTH_NAMES[mNum - 1]} ${year}`,
      };
    }
  }

  const clampedIdx = Math.max(1, Math.min(12, defaultIdx));
  return {
    month: clampedIdx,
    year,
    label: `${MONTH_NAMES[clampedIdx - 1]} ${year}`,
  };
}

// Robust interpreter for any cell value representing PriceStatus
export function parseStatusValue(raw: any): PriceStatus {
  if (raw === null || raw === undefined) return 'KOSONG';

  if (typeof raw === 'number') {
    if (raw === 1) return 'NAIK';
    if (raw === -1) return 'TURUN';
    if (raw === 0) return 'STABIL';
    if (raw > 0) return 'NAIK';
    if (raw < 0) return 'TURUN';
    return 'STABIL';
  }

  const str = String(raw).trim();
  if (!str) return 'KOSONG';
  const upper = str.toUpperCase().trim();

  // Explicit empty / nil values
  if (
    upper === '-' ||
    upper === '--' ||
    upper === '---' ||
    upper === 'NIHIL' ||
    upper === 'KOSONG' ||
    upper === 'N/A' ||
    upper === 'NA' ||
    upper === 'NONE' ||
    upper === 'TIDAK ADA' ||
    upper === 'BELUM ADA' ||
    upper === 'TD' ||
    upper === 'NULL' ||
    upper === 'UNDEFINED' ||
    upper === '0,00' ||
    upper === '0.00'
  ) {
    return 'KOSONG';
  }

  // NAIK
  if (
    upper === '1' ||
    upper === '+1' ||
    upper === '+1.0' ||
    upper === '+' ||
    upper === 'N' ||
    upper.includes('NAIK') ||
    upper.includes('MENINGKAT') ||
    upper.includes('INFLASI') ||
    upper === '▲' ||
    upper === '↑' ||
    upper === 'UP' ||
    (upper.startsWith('+') && !isNaN(Number(upper.substring(1))))
  ) {
    return 'NAIK';
  }

  // TURUN
  if (
    upper === '-1' ||
    upper === '-1.0' ||
    upper === 'T' ||
    upper.includes('TURUN') ||
    upper.includes('MENURUN') ||
    upper.includes('DEFLASI') ||
    upper === '▼' ||
    upper === '↓' ||
    upper === 'DOWN' ||
    (upper.startsWith('-') && upper.length > 1 && !isNaN(Number(upper.substring(1))))
  ) {
    return 'TURUN';
  }

  // STABIL
  if (
    upper === '0' ||
    upper === '0.0' ||
    upper === 'S' ||
    upper.includes('STABIL') ||
    upper.includes('TETAP') ||
    upper.includes('SAMA') ||
    upper.includes('KONSTAN') ||
    upper.includes('NORMAL') ||
    upper.includes('FLAT')
  ) {
    return 'STABIL';
  }

  // If it's a numeric string:
  const numVal = parseFloat(str.replace(',', '.'));
  if (!isNaN(numVal)) {
    if (numVal === 1) return 'NAIK';
    if (numVal === -1) return 'TURUN';
    if (numVal === 0) return 'STABIL';
    if (numVal > 0) return 'NAIK';
    if (numVal < 0) return 'TURUN';
  }

  return 'KOSONG';
}

// Match header strings to regional identifiers and levels
export function matchRegionHeader(
  headerText: string,
  _regions?: RegionInfo[],
  defaultLevel?: PriceLevel
): {
  type: 'region' | 'kalbar';
  regionId?: string;
  level?: PriceLevel;
} | null {
  if (!headerText) return null;
  const clean = headerText
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return null;

  // Detect Level in header string
  let level: PriceLevel | undefined = undefined;
  if (
    clean.includes('hpg') ||
    clean.includes('produsen desa') ||
    clean.includes('p desa') ||
    clean.includes('produsen') ||
    clean.includes('petani') ||
    clean.includes('hd') ||
    clean.includes('hpp')
  ) {
    level = 'produsen_desa';
  } else if (
    clean.includes('hkd') ||
    clean.includes('konsumen desa') ||
    clean.includes('k desa') ||
    clean.includes('pasar desa') ||
    clean.includes('warung')
  ) {
    level = 'konsumen_desa';
  } else if (
    clean.includes('hpb') ||
    clean.includes('dagang besar') ||
    clean.includes('perdagangan besar') ||
    clean.includes('grosir') ||
    clean.includes('distributor') ||
    clean.includes('pasar induk')
  ) {
    level = 'perdagangan_besar';
  } else if (
    clean.includes('hk') ||
    clean.includes('konsumen') ||
    clean.includes('eceran') ||
    clean.includes('pasar kota')
  ) {
    level = 'konsumen';
  }

  // Fallback to defaultLevel if not explicitly in header text
  if (!level && defaultLevel) {
    level = defaultLevel;
  }

  // Check if Kalbar / Provincial / Overall Status
  const isKalbar =
    clean.includes('kalbar') ||
    clean.includes('kalimantan barat') ||
    clean.includes('provinsi') ||
    clean.includes('prov ') ||
    clean.startsWith('prov') ||
    clean.includes('status umum') ||
    clean.includes('status keseluruhan') ||
    clean.includes('keseluruhan') ||
    clean.includes('status gabungan') ||
    clean.includes('status agregat') ||
    clean.includes('status komoditas') ||
    clean.includes('status akhir') ||
    clean.includes('keterangan status') ||
    clean.includes('status keterangan') ||
    clean.includes('ket status') ||
    clean.includes('keterangan kalbar') ||
    clean.includes('status harga') ||
    clean === 'status' ||
    clean === 'umum' ||
    clean === 'agregat' ||
    clean === 'gabungan';

  if (isKalbar) {
    return { type: 'kalbar', level };
  }

  // Match against the 14 Kab/Kota in Kalimantan Barat
  const regionMatchers: { id: string; patterns: string[] }[] = [
    { id: 'sambas', patterns: ['sambas'] },
    { id: 'bengkayang', patterns: ['bengkayang'] },
    { id: 'landak', patterns: ['landak'] },
    { id: 'mempawah', patterns: ['mempawah', 'kab pontianak', 'kabupaten pontianak'] },
    { id: 'sanggau', patterns: ['sanggau'] },
    { id: 'ketapang', patterns: ['ketapang'] },
    { id: 'sintang', patterns: ['sintang'] },
    { id: 'kapuas_hulu', patterns: ['kapuas hulu', 'kapuas', 'kph'] },
    { id: 'sekadau', patterns: ['sekadau'] },
    { id: 'melawi', patterns: ['melawi'] },
    { id: 'kayong_utara', patterns: ['kayong utara', 'kayong', 'kku'] },
    { id: 'kubu_raya', patterns: ['kubu raya', 'kuburaya', 'kkr'] },
    { id: 'pontianak', patterns: ['kota pontianak', 'pontianak', 'ptk', 'kotamadya pontianak'] },
    { id: 'singkawang', patterns: ['kota singkawang', 'singkawang', 'skw', 'kotamadya singkawang'] },
  ];

  for (const matcher of regionMatchers) {
    if (matcher.id === 'pontianak') {
      if (clean.includes('kab pontianak') || clean.includes('kabupaten pontianak')) {
        continue;
      }
    }
    const matched = matcher.patterns.some((pat) => clean.includes(pat));
    if (matched) {
      return { type: 'region', regionId: matcher.id, level };
    }
  }

  return null;
}

// Clean and normalize commodity text
function normalizeCommodityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^\d+[\s.)-]+/, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fuzzy commodity matching against Master Commodities
function findMasterCommodity(
  rawName: string,
  rowNo?: number
): MasterCommodity | null {
  const clean = normalizeCommodityName(rawName);
  if (!clean) return null;

  // 1. Check if rowNo is provided (1 to 38) and matches
  if (rowNo && rowNo >= 1 && rowNo <= MASTER_COMMODITIES.length) {
    const master = MASTER_COMMODITIES[rowNo - 1];
    const masterClean = normalizeCommodityName(master.name);
    const words = clean.split(' ').filter((w) => w.length > 2);
    if (
      words.some((w) => masterClean.includes(w)) ||
      masterClean.includes(clean) ||
      clean.includes(masterClean)
    ) {
      return master;
    }
  }

  // 2. Exact clean match
  for (const m of MASTER_COMMODITIES) {
    const mClean = normalizeCommodityName(m.name);
    if (mClean === clean) return m;
  }

  // 3. Known Indonesian food commodity aliases
  const aliasMap: [string[], number][] = [
    [['beras', 'gabah'], 5],
    [['bawang merah'], 2],
    [['bawang putih'], 3],
    [['cabai merah', 'cabe merah'], 6],
    [['cabai rawit', 'cabe rawit'], 7],
    [['daging ayam', 'ayam ras', 'daging ayam ras'], 9],
    [['daging sapi', 'sapi'], 10],
    [['telur ayam', 'telur ayam ras', 'telur'], 34],
    [['minyak goreng', 'minyak sawit', 'minyak'], 19],
    [['gula pasir', 'gula'], 12],
    [['ikan tongkol', 'tongkol', 'ambu ambu'], 14],
    [['ikan kembung', 'kembung'], 13],
    [['jagung manis', 'jagung'], 15],
    [['tomat'], 37],
    [['tahu mentah', 'tahu'], 32],
    [['tempe'], 35],
    [['tepung terigu', 'terigu'], 36],
    [['udang basah', 'udang'], 38],
    [['jeruk'], 16],
    [['pisang'], 21],
    [['sawi hijau'], 22],
    [['sawi putih', 'pecay', 'pitsai'], 23],
    [['sawit'], 24],
    [['karet'], 17],
    [['semen'], 25],
    [['seng'], 26],
    [['skm', 'kretek mesin'], 27],
    [['skt', 'kretek tangan'], 28],
    [['spm', 'putih mesin'], 29],
    [['susu bubuk balita', 'balita'], 31],
    [['susu bubuk'], 30],
    [['bensin'], 4],
    [['bahan bakar', 'lpg', 'gas'], 1],
    [['cat tembok', 'cat'], 8],
    [['emas perhiasan', 'emas'], 11],
    [['mie kering', 'mie instan', 'mie'], 18],
    [['pemeliharaan', 'service'], 20],
    [['gunting rambut', 'cukur'], 33],
  ];

  for (const [aliases, no] of aliasMap) {
    if (aliases.some((a) => clean.includes(a) || a.includes(clean))) {
      const master = MASTER_COMMODITIES.find((m) => m.no === no);
      if (master) return master;
    }
  }

  // 4. Overlap scoring
  let bestMatch: MasterCommodity | null = null;
  let highestOverlap = 0;
  for (const m of MASTER_COMMODITIES) {
    const mWords = normalizeCommodityName(m.name).split(' ').filter((w) => w.length > 2);
    const rowWords = clean.split(' ').filter((w) => w.length > 2);
    let overlap = 0;
    for (const rw of rowWords) {
      if (mWords.includes(rw)) overlap++;
    }
    if (overlap > highestOverlap) {
      highestOverlap = overlap;
      bestMatch = m;
    }
  }

  if (highestOverlap >= 1 && bestMatch) {
    return bestMatch;
  }

  return null;
}

// Parse a single worksheet into a list of CommodityRecords
function parseDataSheet(
  worksheet: XLSX.WorkSheet,
  regions: RegionInfo[],
  defaultSheetLevel?: PriceLevel
): {
  commodities: CommodityRecord[];
  detectedMonthLabel?: string;
} {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    return { commodities: [] };
  }

  // 1. Scan rows 0 to 15 to locate the true Header Row
  let headerRowIdx = -1;
  let detectedMonthLabel: string | undefined = undefined;

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    // Check banner rows for month mentions
    const rowJoined = row.map((c) => String(c || '')).join(' ').toLowerCase();
    if (!detectedMonthLabel) {
      const hasMonthOrYear =
        rowJoined.includes('januari') || rowJoined.includes('februari') || rowJoined.includes('maret') ||
        rowJoined.includes('april') || rowJoined.includes('mei') || rowJoined.includes('juni') ||
        rowJoined.includes('juli') || rowJoined.includes('agustus') || rowJoined.includes('september') ||
        rowJoined.includes('oktober') || rowJoined.includes('november') || rowJoined.includes('desember') ||
        rowJoined.includes('bulan') || rowJoined.includes('periode') || rowJoined.includes('harmonisasi') ||
        /\b20\d\d\b/.test(rowJoined);

      if (hasMonthOrYear) {
        const parsedM = detectMonthInfo(rowJoined);
        if (parsedM && parsedM.label) {
          detectedMonthLabel = parsedM.label;
        }
      }
    }

    let matchCount = 0;
    let hasCommodityWord = false;

    for (const cell of row) {
      const str = String(cell || '').toLowerCase().trim();
      if (!str) continue;

      if (
        str.includes('komoditas') ||
        str.includes('komoditi') ||
        str.includes('nama barang') ||
        str.includes('bahan pokok') ||
        str.includes('nama pangan') ||
        str.includes('uraian') ||
        str === 'barang'
      ) {
        hasCommodityWord = true;
        matchCount++;
      }

      const regMatch = matchRegionHeader(str, regions, defaultSheetLevel);
      if (regMatch) {
        matchCount++;
      }
    }

    if ((hasCommodityWord && matchCount >= 2) || matchCount >= 3) {
      headerRowIdx = r;
      break;
    }
  }

  // Fallback if no specific header matched: assume row 0
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  // 2. Check if row headerRowIdx + 1 is a sub-header row (e.g. 2-tier headers with HPG, HKD, HPB, HK)
  let subHeaderRowIdx: number | undefined = undefined;
  if (headerRowIdx + 1 < rawRows.length) {
    const nextRow = rawRows[headerRowIdx + 1];
    let levelTagCount = 0;
    if (Array.isArray(nextRow)) {
      for (const cell of nextRow) {
        const str = String(cell || '').toLowerCase().trim();
        if (
          str === 'hpg' ||
          str === 'hkd' ||
          str === 'hpb' ||
          str === 'hk' ||
          str === 'hd' ||
          str.includes('produsen') ||
          str.includes('konsumen') ||
          str.includes('grosir') ||
          str.includes('eceran')
        ) {
          levelTagCount++;
        }
      }
    }
    if (levelTagCount >= 2) {
      subHeaderRowIdx = headerRowIdx + 1;
    }
  }

  const primaryHeader = rawRows[headerRowIdx] || [];
  const secondaryHeader = subHeaderRowIdx !== undefined ? rawRows[subHeaderRowIdx] : [];

  // Build combined header names per column
  let lastParentHeader = '';
  const colHeaders: string[] = [];

  for (let c = 0; c < Math.max(primaryHeader.length, secondaryHeader.length); c++) {
    let parent = String(primaryHeader[c] || '').trim();
    if (parent) {
      lastParentHeader = parent;
    } else if (subHeaderRowIdx !== undefined) {
      parent = lastParentHeader;
    }

    const child = String(secondaryHeader[c] || '').trim();
    const combined = child ? `${parent} ${child}`.trim() : parent;
    colHeaders.push(combined);
  }

  // 3. Map column indices
  let colNoIdx = -1;
  let colNameIdx = -1;
  let colCategoryIdx = -1;
  let colUnitIdx = -1;
  let colNotesIdx = -1;

  interface ColRegionMapping {
    colIdx: number;
    regionId: string;
    level?: PriceLevel;
  }

  interface ColKalbarMapping {
    colIdx: number;
    level?: PriceLevel;
  }

  const regionCols: ColRegionMapping[] = [];
  const kalbarCols: ColKalbarMapping[] = [];

  colHeaders.forEach((hdr, idx) => {
    const clean = hdr.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return;

    if (clean === 'no' || clean.startsWith('no ') || clean === 'nomor' || clean === 'nr') {
      if (colNoIdx === -1) colNoIdx = idx;
      return;
    }

    if (
      clean.includes('komoditas') ||
      clean.includes('komoditi') ||
      clean.includes('nama barang') ||
      clean.includes('bahan pokok') ||
      clean.includes('nama pangan') ||
      clean.includes('uraian') ||
      clean === 'nama' ||
      clean === 'barang'
    ) {
      if (colNameIdx === -1) colNameIdx = idx;
      return;
    }

    if (clean.includes('kategori') || clean.includes('kelompok') || clean.includes('group')) {
      if (colCategoryIdx === -1) colCategoryIdx = idx;
      return;
    }

    if (clean.includes('satuan') || clean.includes('unit') || clean === 'sat') {
      if (colUnitIdx === -1) colUnitIdx = idx;
      return;
    }

    // Check if column is a Notes or Keterangan column
    const isExplicitStatusHeader =
      clean.includes('keterangan status') ||
      clean.includes('status keterangan') ||
      clean.includes('ket status') ||
      clean.includes('status keseluruhan') ||
      clean.includes('status umum') ||
      clean.includes('keterangan kalbar') ||
      clean.includes('keterangan harga') ||
      clean.includes('status');

    if (!isExplicitStatusHeader && (clean.includes('catatan') || clean.includes('notes'))) {
      if (colNotesIdx === -1) colNotesIdx = idx;
      return;
    }

    if (!isExplicitStatusHeader && (clean === 'keterangan' || clean === 'ket' || clean.startsWith('keterangan ') || clean.startsWith('ket '))) {
      // Sample data rows below header to determine if values in this column are price statuses (e.g. 'turun', 'naik', 'stabil', '1', '-1', '0')
      let statusCount = 0;
      let sampleRows = 0;
      const startScan = (subHeaderRowIdx !== undefined ? subHeaderRowIdx : headerRowIdx) + 1;
      for (let r = startScan; r < Math.min(rawRows.length, startScan + 25); r++) {
        const cellVal = rawRows[r]?.[idx];
        if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
          sampleRows++;
          const parsed = parseStatusValue(cellVal);
          if (parsed === 'NAIK' || parsed === 'TURUN' || parsed === 'STABIL') {
            statusCount++;
          }
        }
      }

      if (sampleRows >= 1 && statusCount >= 1 && statusCount / sampleRows >= 0.3) {
        // This column actually contains status values (e.g. 'turun', 'naik', 'stabil')
        kalbarCols.push({ colIdx: idx, level: defaultSheetLevel });
        if (colNotesIdx === -1) colNotesIdx = idx;
        return;
      } else {
        // This column contains notes / narrative remarks
        if (colNotesIdx === -1) colNotesIdx = idx;
        return;
      }
    }

    // Match region or Kalbar
    const match = matchRegionHeader(hdr, regions, defaultSheetLevel);
    if (match) {
      if (match.type === 'kalbar') {
        kalbarCols.push({ colIdx: idx, level: match.level });
      } else if (match.type === 'region' && match.regionId) {
        regionCols.push({ colIdx: idx, regionId: match.regionId, level: match.level });
      }
    }
  });

  // If commodity name column was not explicitly named, use column 1 or column 0
  if (colNameIdx === -1) {
    colNameIdx = colNoIdx === 0 ? 1 : 0;
  }

  // 4. Iterate data rows
  const dataStartIdx = subHeaderRowIdx !== undefined ? subHeaderRowIdx + 1 : headerRowIdx + 1;
  const commodities: CommodityRecord[] = [];

  for (let r = dataStartIdx; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Extract Commodity Name
    let rawName = String(row[colNameIdx] || '').trim();
    if (!rawName) {
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        if (c !== colNoIdx) {
          const val = String(row[c] || '').trim();
          if (val && isNaN(Number(val)) && val.length > 2) {
            rawName = val;
            break;
          }
        }
      }
    }

    if (!rawName) continue;

    // Skip footer, disclaimer, or summary rows
    const lowerName = rawName.toLowerCase();
    if (
      lowerName.startsWith('sumber') ||
      lowerName.startsWith('catatan') ||
      lowerName.startsWith('keterangan') ||
      lowerName.startsWith('total') ||
      lowerName.startsWith('rata-rata') ||
      lowerName.startsWith('jumlah') ||
      lowerName.startsWith('ket:')
    ) {
      continue;
    }

    // Extract Commodity Number
    let no = colNoIdx !== -1 ? Number(row[colNoIdx]) : NaN;
    if (isNaN(no) || no <= 0) {
      const prefixMatch = rawName.match(/^(\d+)[\s.)-]+/);
      if (prefixMatch) {
        no = parseInt(prefixMatch[1], 10);
      } else {
        no = commodities.length + 1;
      }
    }

    // Match with Master Commodity
    const master = findMasterCommodity(rawName, no);
    const displayName = rawName.replace(/^\d+[\s.)-]+/, '').trim();
    const finalName = displayName.length > 0 ? displayName : (master?.name || `Komoditas ${no}`);

    const category = (
      colCategoryIdx !== -1 && row[colCategoryIdx]
        ? String(row[colCategoryIdx]).trim()
        : master?.category || 'Pangan Pokok'
    ) as CommodityCategory;

    const unit =
      colUnitIdx !== -1 && row[colUnitIdx]
        ? String(row[colUnitIdx]).trim()
        : master?.unit || 'Kg';

    // Extract Regional Statuses
    const regionData: Record<string, any> = {};

    regions.forEach((reg) => {
      const matched = regionCols.filter((rc) => rc.regionId === reg.id);

      if (matched.length === 0) {
        regionData[reg.id] = {
          status: 'KOSONG',
          produsenDesaStatus: 'KOSONG',
          konsumenDesaStatus: 'KOSONG',
          perdaganganBesarStatus: 'KOSONG',
          konsumenStatus: 'KOSONG',
          produsenStatus: 'KOSONG',
          grosirStatus: 'KOSONG',
          hasCommodity: false,
          hpg: 0,
          hkd: 0,
          hpb: 0,
          hk: 0,
        };
        return;
      }

      const colPDesa = matched.find((m) => m.level === 'produsen_desa');
      const colKDesa = matched.find((m) => m.level === 'konsumen_desa');
      const colPB = matched.find((m) => m.level === 'perdagangan_besar');
      const colK = matched.find((m) => m.level === 'konsumen');
      const colGeneral = matched.find((m) => m.level === undefined);

      let pDesaStatus: PriceStatus = 'KOSONG';
      let kDesaStatus: PriceStatus = 'KOSONG';
      let pbStatus: PriceStatus = 'KOSONG';
      let kStatus: PriceStatus = 'KOSONG';

      if (defaultSheetLevel === 'perdagangan_besar') {
        pbStatus = colPB
          ? parseStatusValue(row[colPB.colIdx])
          : colGeneral
          ? parseStatusValue(row[colGeneral.colIdx])
          : 'KOSONG';
        kStatus = colK ? parseStatusValue(row[colK.colIdx]) : pbStatus;
      } else if (defaultSheetLevel === 'produsen_desa') {
        pDesaStatus = colPDesa
          ? parseStatusValue(row[colPDesa.colIdx])
          : colGeneral
          ? parseStatusValue(row[colGeneral.colIdx])
          : 'KOSONG';
      } else if (defaultSheetLevel === 'konsumen_desa') {
        kDesaStatus = colKDesa
          ? parseStatusValue(row[colKDesa.colIdx])
          : colGeneral
          ? parseStatusValue(row[colGeneral.colIdx])
          : 'KOSONG';
      } else {
        if (colGeneral && !colPDesa && !colKDesa && !colPB && !colK) {
          const genStatus = parseStatusValue(row[colGeneral.colIdx]);
          pDesaStatus = genStatus;
          kDesaStatus = genStatus;
          pbStatus = genStatus;
          kStatus = genStatus;
        } else {
          pDesaStatus = colPDesa
            ? parseStatusValue(row[colPDesa.colIdx])
            : colGeneral
            ? parseStatusValue(row[colGeneral.colIdx])
            : 'KOSONG';

          kDesaStatus = colKDesa
            ? parseStatusValue(row[colKDesa.colIdx])
            : colGeneral
            ? parseStatusValue(row[colGeneral.colIdx])
            : 'KOSONG';

          pbStatus = colPB
            ? parseStatusValue(row[colPB.colIdx])
            : colGeneral
            ? parseStatusValue(row[colGeneral.colIdx])
            : 'KOSONG';

          kStatus = colK
            ? parseStatusValue(row[colK.colIdx])
            : colGeneral
            ? parseStatusValue(row[colGeneral.colIdx])
            : 'KOSONG';
        }
      }

      const hasData =
        pDesaStatus !== 'KOSONG' ||
        kDesaStatus !== 'KOSONG' ||
        pbStatus !== 'KOSONG' ||
        kStatus !== 'KOSONG';

      const masterStatus =
        kStatus !== 'KOSONG'
          ? kStatus
          : pbStatus !== 'KOSONG'
          ? pbStatus
          : kDesaStatus !== 'KOSONG'
          ? kDesaStatus
          : pDesaStatus !== 'KOSONG'
          ? pDesaStatus
          : 'KOSONG';

      regionData[reg.id] = {
        status: masterStatus,
        produsenDesaStatus: pDesaStatus,
        konsumenDesaStatus: kDesaStatus,
        perdaganganBesarStatus: pbStatus,
        konsumenStatus: kStatus,
        produsenStatus: pDesaStatus,
        grosirStatus: pbStatus,
        hasCommodity: hasData,
        hpg: pDesaStatus === 'NAIK' ? 1 : pDesaStatus === 'TURUN' ? -1 : pDesaStatus === 'STABIL' ? 0 : null,
        hkd: kDesaStatus === 'NAIK' ? 1 : kDesaStatus === 'TURUN' ? -1 : kDesaStatus === 'STABIL' ? 0 : null,
        hpb: pbStatus === 'NAIK' ? 1 : pbStatus === 'TURUN' ? -1 : pbStatus === 'STABIL' ? 0 : null,
        hk: kStatus === 'NAIK' ? 1 : kStatus === 'TURUN' ? -1 : kStatus === 'STABIL' ? 0 : null,
      };
    });

    // Extract Kalbar Provincial Status
    let overallStatus: PriceStatus = 'KOSONG';
    let overallPDesa: PriceStatus = 'KOSONG';
    let overallKDesa: PriceStatus = 'KOSONG';
    let overallPB: PriceStatus = 'KOSONG';

    if (kalbarCols.length > 0) {
      const kalbarGeneral = kalbarCols.find((kc) => kc.level === undefined);
      const kalbarPDesaCol = kalbarCols.find((kc) => kc.level === 'produsen_desa');
      const kalbarKDesaCol = kalbarCols.find((kc) => kc.level === 'konsumen_desa');
      const kalbarPBCol = kalbarCols.find((kc) => kc.level === 'perdagangan_besar');
      const kalbarKCol = kalbarCols.find((kc) => kc.level === 'konsumen');

      if (defaultSheetLevel === 'perdagangan_besar') {
        overallPB = kalbarPBCol
          ? parseStatusValue(row[kalbarPBCol.colIdx])
          : kalbarGeneral
          ? parseStatusValue(row[kalbarGeneral.colIdx])
          : computeOverallStatus(regionData, 'perdagangan_besar');
        overallStatus = overallPB;
        overallPDesa = kalbarPDesaCol ? parseStatusValue(row[kalbarPDesaCol.colIdx]) : computeOverallStatus(regionData, 'produsen_desa');
        overallKDesa = kalbarKDesaCol ? parseStatusValue(row[kalbarKDesaCol.colIdx]) : computeOverallStatus(regionData, 'konsumen_desa');
      } else if (defaultSheetLevel === 'produsen_desa') {
        overallPDesa = kalbarPDesaCol
          ? parseStatusValue(row[kalbarPDesaCol.colIdx])
          : kalbarGeneral
          ? parseStatusValue(row[kalbarGeneral.colIdx])
          : computeOverallStatus(regionData, 'produsen_desa');
        overallStatus = overallPDesa;
        overallKDesa = kalbarKDesaCol ? parseStatusValue(row[kalbarKDesaCol.colIdx]) : computeOverallStatus(regionData, 'konsumen_desa');
        overallPB = kalbarPBCol ? parseStatusValue(row[kalbarPBCol.colIdx]) : computeOverallStatus(regionData, 'perdagangan_besar');
      } else if (defaultSheetLevel === 'konsumen_desa') {
        overallKDesa = kalbarKDesaCol
          ? parseStatusValue(row[kalbarKDesaCol.colIdx])
          : kalbarGeneral
          ? parseStatusValue(row[kalbarGeneral.colIdx])
          : computeOverallStatus(regionData, 'konsumen_desa');
        overallStatus = overallKDesa;
        overallPDesa = kalbarPDesaCol ? parseStatusValue(row[kalbarPDesaCol.colIdx]) : computeOverallStatus(regionData, 'produsen_desa');
        overallPB = kalbarPBCol ? parseStatusValue(row[kalbarPBCol.colIdx]) : computeOverallStatus(regionData, 'perdagangan_besar');
      } else {
        if (kalbarKCol) {
          overallStatus = parseStatusValue(row[kalbarKCol.colIdx]);
        } else if (kalbarGeneral) {
          overallStatus = parseStatusValue(row[kalbarGeneral.colIdx]);
        } else {
          overallStatus = computeOverallStatus(regionData, 'konsumen');
        }

        overallPDesa = kalbarPDesaCol
          ? parseStatusValue(row[kalbarPDesaCol.colIdx])
          : computeOverallStatus(regionData, 'produsen_desa');

        overallKDesa = kalbarKDesaCol
          ? parseStatusValue(row[kalbarKDesaCol.colIdx])
          : computeOverallStatus(regionData, 'konsumen_desa');

        overallPB = kalbarPBCol
          ? parseStatusValue(row[kalbarPBCol.colIdx])
          : computeOverallStatus(regionData, 'perdagangan_besar');
      }
    } else {
      overallStatus = computeOverallStatus(regionData, defaultSheetLevel || 'konsumen');
      overallPDesa = computeOverallStatus(regionData, 'produsen_desa');
      overallKDesa = computeOverallStatus(regionData, 'konsumen_desa');
      overallPB = computeOverallStatus(regionData, 'perdagangan_besar');
    }

    // Extract Notes / Catatan
    const rawCatatan = colNotesIdx !== -1 ? String(row[colNotesIdx] || '').trim() : '';
    const cleanCatatan = rawCatatan === '-' || rawCatatan === 'null' ? '' : rawCatatan;

    commodities.push({
      id: `c_${no}`,
      no,
      name: finalName,
      category,
      unit,
      catatan: cleanCatatan,
      notes: cleanCatatan,
      regions: regionData,
      overallStatus,
      overallProdusenDesaStatus: overallPDesa,
      overallKonsumenDesaStatus: overallKDesa,
      overallPerdaganganBesarStatus: overallPB,
      overallKonsumenStatus: overallStatus,
      overallProdusenStatus: overallPDesa,
      overallGrosirStatus: overallPB,
    });
  }

  // Ensure commodities are sorted by number
  commodities.sort((a, b) => a.no - b.no);

  return { commodities, detectedMonthLabel };
}

export function parseExcelFile(
  file: File,
  regions: RegionInfo[],
  callback: (result: ParsedWorkbookResult | null, error?: string) => void
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        callback(null, 'File Excel tidak memiliki lembar kerja (sheet).');
        return;
      }

      // 1. Check if workbook is strictly a 4-level single-month workbook (HD, HKD, HPB, HK sheets)
      const sheetNameCleanList = workbook.SheetNames.map((s) =>
        s.toLowerCase().trim().replace(/[-_.]/g, ' ')
      );

      const isStrict4Level =
        workbook.SheetNames.length >= 2 &&
        workbook.SheetNames.length <= 6 &&
        sheetNameCleanList.some((s) => s === 'hd' || s === 'hpg' || s.includes('produsen')) &&
        sheetNameCleanList.some((s) => s === 'hk' || s === 'eceran' || s.includes('konsumen')) &&
        !sheetNameCleanList.some(
          (s) =>
            s.includes('januari') ||
            s.includes('februari') ||
            s.includes('maret') ||
            s.includes('april') ||
            s.includes('mei') ||
            s.includes('juni') ||
            s.includes('juli') ||
            s.includes('agustus') ||
            s.includes('september') ||
            s.includes('oktober') ||
            s.includes('november') ||
            s.includes('desember')
        );

      if (isStrict4Level) {
        let monthInfo = detectMonthInfo(file.name.replace(/\.[^/.]+$/, ''), 1);
        const commMap = new Map<string, CommodityRecord>();
        let sheetDetectedMonthLabel: string | undefined = undefined;

        workbook.SheetNames.forEach((sheetName) => {
          const sl = sheetName.toLowerCase().trim().replace(/[-_.]/g, ' ');
          let level: PriceLevel = 'konsumen';
          if (sl === 'hd' || sl === 'hpg' || sl.includes('produsen desa') || sl.includes('produsen')) {
            level = 'produsen_desa';
          } else if (sl === 'hkd' || sl.includes('konsumen desa')) {
            level = 'konsumen_desa';
          } else if (sl === 'hpb' || sl.includes('perdagangan besar') || sl.includes('grosir')) {
            level = 'perdagangan_besar';
          }

          const worksheet = workbook.Sheets[sheetName];
          const { commodities, detectedMonthLabel } = parseDataSheet(worksheet, regions, level);
          if (detectedMonthLabel && !sheetDetectedMonthLabel) {
            sheetDetectedMonthLabel = detectedMonthLabel;
          }

          commodities.forEach((c) => {
            const key = String(c.no || c.name.toLowerCase().trim());
            let existing = commMap.get(key);
            if (!existing) {
              existing = {
                ...c,
                regions: {},
              };
              commMap.set(key, existing);
            }

            // Record overall status for this level directly from the sheet
            if (level === 'produsen_desa') {
              existing.overallProdusenDesaStatus = c.overallProdusenDesaStatus || c.overallStatus;
              existing.overallProdusenStatus = existing.overallProdusenDesaStatus;
            } else if (level === 'konsumen_desa') {
              existing.overallKonsumenDesaStatus = c.overallKonsumenDesaStatus || c.overallStatus;
            } else if (level === 'perdagangan_besar') {
              existing.overallPerdaganganBesarStatus = c.overallPerdaganganBesarStatus || c.overallStatus;
              existing.overallGrosirStatus = existing.overallPerdaganganBesarStatus;
            } else {
              existing.overallKonsumenStatus = c.overallKonsumenStatus || c.overallStatus;
              existing.overallStatus = existing.overallKonsumenStatus;
            }

            regions.forEach((r) => {
              const incomingReg = c.regions[r.id];
              const existingReg = existing!.regions[r.id] || {
                status: 'KOSONG',
                produsenDesaStatus: 'KOSONG',
                konsumenDesaStatus: 'KOSONG',
                perdaganganBesarStatus: 'KOSONG',
                konsumenStatus: 'KOSONG',
                produsenStatus: 'KOSONG',
                grosirStatus: 'KOSONG',
                hasCommodity: false,
                hpg: 0,
                hkd: 0,
                hpb: 0,
                hk: 0,
              };

              const st = incomingReg?.status || 'KOSONG';
              if (level === 'produsen_desa') {
                existingReg.produsenDesaStatus = st;
                existingReg.produsenStatus = st;
                existingReg.hpg = st === 'NAIK' ? 1 : st === 'TURUN' ? -1 : 0;
              } else if (level === 'konsumen_desa') {
                existingReg.konsumenDesaStatus = st;
                existingReg.hkd = st === 'NAIK' ? 1 : st === 'TURUN' ? -1 : 0;
              } else if (level === 'perdagangan_besar') {
                existingReg.perdaganganBesarStatus = st;
                existingReg.grosirStatus = st;
                existingReg.hpb = st === 'NAIK' ? 1 : st === 'TURUN' ? -1 : 0;
              } else {
                existingReg.status = st;
                existingReg.konsumenStatus = st;
                existingReg.hk = st === 'NAIK' ? 1 : st === 'TURUN' ? -1 : 0;
              }

              if (st !== 'KOSONG') {
                existingReg.hasCommodity = true;
              }
              existing!.regions[r.id] = existingReg;
            });
          });
        });

        const mergedCommodities = Array.from(commMap.values());
        mergedCommodities.forEach((c) => {
          if (!c.overallKonsumenStatus || c.overallKonsumenStatus === 'KOSONG') {
            c.overallKonsumenStatus = computeOverallStatus(c.regions, 'konsumen');
          }
          if (!c.overallStatus || c.overallStatus === 'KOSONG') {
            c.overallStatus = c.overallKonsumenStatus;
          }
          if (!c.overallProdusenDesaStatus || c.overallProdusenDesaStatus === 'KOSONG') {
            c.overallProdusenDesaStatus = computeOverallStatus(c.regions, 'produsen_desa');
          }
          if (!c.overallKonsumenDesaStatus || c.overallKonsumenDesaStatus === 'KOSONG') {
            c.overallKonsumenDesaStatus = computeOverallStatus(c.regions, 'konsumen_desa');
          }
          if (!c.overallPerdaganganBesarStatus || c.overallPerdaganganBesarStatus === 'KOSONG') {
            c.overallPerdaganganBesarStatus = computeOverallStatus(c.regions, 'perdagangan_besar');
          }
          c.overallProdusenStatus = c.overallProdusenDesaStatus;
          c.overallGrosirStatus = c.overallPerdaganganBesarStatus;
        });

        mergedCommodities.sort((a, b) => a.no - b.no);

        if (sheetDetectedMonthLabel) {
          const parsedFromSheet = detectMonthInfo(sheetDetectedMonthLabel, monthInfo.month, monthInfo.year);
          if (parsedFromSheet && parsedFromSheet.label) {
            monthInfo = parsedFromSheet;
          }
        }

        const finalDatasetId = `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}`;

        const singleMergedDataset: MonthlyHarmonizationDataset = {
          id: finalDatasetId,
          year: monthInfo.year,
          month: monthInfo.month,
          monthLabel: monthInfo.label,
          notes: `Diimpor dari file multi-level: ${file.name} (${workbook.SheetNames.join(', ')})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          commodities: mergedCommodities,
        };

        callback({
          datasets: [singleMergedDataset],
          sheetCount: workbook.SheetNames.length,
          message: `Berhasil menggabungkan 4 sheet level harga untuk periode ${singleMergedDataset.monthLabel} (${mergedCommodities.length} komoditas).`,
        });
        return;
      }

      // 2. Standard or Multi-Month Workbook Processing
      const allSheetNames = workbook.SheetNames;
      const dataSheetNames = allSheetNames.filter((s) => {
        const lower = s.toLowerCase().trim();
        if (allSheetNames.length > 1) {
          if (
            lower.includes('rekap series') ||
            lower.includes('harmonisasi antar') ||
            lower.includes('harmonisasi 4 level') ||
            lower.includes('petunjuk') ||
            lower.includes('panduan')
          ) {
            return false;
          }
        }
        return true;
      });

      const sheetsToProcess = dataSheetNames.length > 0 ? dataSheetNames : [allSheetNames[0]];
      const parsedDatasets: MonthlyHarmonizationDataset[] = [];

      // Helper to detect price level from sheet name
      const detectSheetPriceLevel = (sheetName: string): PriceLevel | undefined => {
        const sl = sheetName.toLowerCase().trim().replace(/[-_.]/g, ' ');
        if (
          sl === 'hd' ||
          sl === 'hpg' ||
          sl.startsWith('hd ') ||
          sl.endsWith(' hd') ||
          sl.includes('produsen desa') ||
          sl.includes('p desa') ||
          sl.includes('produsen') ||
          sl.includes('petani') ||
          sl.includes('hpp')
        ) {
          return 'produsen_desa';
        }
        if (
          sl === 'hkd' ||
          sl.startsWith('hkd ') ||
          sl.endsWith(' hkd') ||
          sl.includes('konsumen desa') ||
          sl.includes('k desa') ||
          sl.includes('pasar desa') ||
          sl.includes('warung')
        ) {
          return 'konsumen_desa';
        }
        if (
          sl === 'hpb' ||
          sl.startsWith('hpb ') ||
          sl.endsWith(' hpb') ||
          sl.includes('perdagangan besar') ||
          sl.includes('dagang besar') ||
          sl.includes('grosir') ||
          sl.includes('distributor') ||
          sl.includes('pasar induk')
        ) {
          return 'perdagangan_besar';
        }
        if (
          sl === 'hk' ||
          sl.startsWith('hk ') ||
          sl.endsWith(' hk') ||
          sl.includes('konsumen') ||
          sl.includes('eceran') ||
          sl.includes('pasar kota')
        ) {
          return 'konsumen';
        }
        return undefined;
      };

      sheetsToProcess.forEach((sheetName, sheetIdx) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const sheetLevel = detectSheetPriceLevel(sheetName);
        const { commodities, detectedMonthLabel } = parseDataSheet(worksheet, regions, sheetLevel);
        if (commodities.length === 0) return;

        let monthInfo = detectMonthInfo(sheetName, sheetIdx + 1);
        if (detectedMonthLabel) {
          monthInfo = detectMonthInfo(detectedMonthLabel, monthInfo.month, monthInfo.year);
        } else {
          // Fallback to file name if sheet name does not contain month keywords
          const sheetHasMonth = /jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec/i.test(sheetName);
          const fileMonth = detectMonthInfo(file.name.replace(/\.[^/.]+$/, ''), monthInfo.month, monthInfo.year);
          if (!sheetHasMonth && fileMonth) {
            monthInfo = fileMonth;
          }
        }

        const datasetId = `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}`;

        parsedDatasets.push({
          id: datasetId,
          year: monthInfo.year,
          month: monthInfo.month,
          monthLabel: monthInfo.label,
          notes: `Diimpor dari ${file.name} (Sheet: ${sheetName})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          commodities,
        });
      });

      if (parsedDatasets.length === 0) {
        callback(
          null,
          'Tidak ada data komoditas yang berhasil diekstrak. Pastikan lembar kerja memiliki kolom nama komoditas dan nama kabupaten/kota.'
        );
        return;
      }

      // Merge multiple datasets with identical datasetId (e.g. separate sheets for HD, HKD, HPB, HK in the same month)
      const datasetMap = new Map<string, MonthlyHarmonizationDataset>();
      parsedDatasets.forEach((ds) => {
        if (!datasetMap.has(ds.id)) {
          datasetMap.set(ds.id, ds);
        } else {
          const existing = datasetMap.get(ds.id)!;
          const commMap = new Map<string, CommodityRecord>();
          existing.commodities.forEach((c) => commMap.set(String(c.no || c.name.toLowerCase().trim()), { ...c }));

          ds.commodities.forEach((incoming) => {
            const key = String(incoming.no || incoming.name.toLowerCase().trim());
            const target = commMap.get(key);
            if (!target) {
              commMap.set(key, { ...incoming });
            } else {
              // Merge regions
              regions.forEach((r) => {
                const inReg = incoming.regions?.[r.id];
                const tarReg = target.regions?.[r.id];
                if (inReg && tarReg) {
                  if (inReg.produsenDesaStatus && inReg.produsenDesaStatus !== 'KOSONG') {
                    tarReg.produsenDesaStatus = inReg.produsenDesaStatus;
                    tarReg.produsenStatus = inReg.produsenDesaStatus;
                    tarReg.hpg = inReg.hpg;
                  }
                  if (inReg.konsumenDesaStatus && inReg.konsumenDesaStatus !== 'KOSONG') {
                    tarReg.konsumenDesaStatus = inReg.konsumenDesaStatus;
                    tarReg.hkd = inReg.hkd;
                  }
                  if (inReg.perdaganganBesarStatus && inReg.perdaganganBesarStatus !== 'KOSONG') {
                    tarReg.perdaganganBesarStatus = inReg.perdaganganBesarStatus;
                    tarReg.grosirStatus = inReg.perdaganganBesarStatus;
                    tarReg.hpb = inReg.hpb;
                  }
                  if (inReg.konsumenStatus && inReg.konsumenStatus !== 'KOSONG') {
                    tarReg.konsumenStatus = inReg.konsumenStatus;
                    tarReg.status = inReg.konsumenStatus;
                    tarReg.hk = inReg.hk;
                  }
                  if (inReg.hasCommodity) tarReg.hasCommodity = true;
                }
              });

              // Merge overall level statuses
              if (incoming.overallProdusenDesaStatus && incoming.overallProdusenDesaStatus !== 'KOSONG') {
                target.overallProdusenDesaStatus = incoming.overallProdusenDesaStatus;
                target.overallProdusenStatus = incoming.overallProdusenDesaStatus;
              }
              if (incoming.overallKonsumenDesaStatus && incoming.overallKonsumenDesaStatus !== 'KOSONG') {
                target.overallKonsumenDesaStatus = incoming.overallKonsumenDesaStatus;
              }
              if (incoming.overallPerdaganganBesarStatus && incoming.overallPerdaganganBesarStatus !== 'KOSONG') {
                target.overallPerdaganganBesarStatus = incoming.overallPerdaganganBesarStatus;
                target.overallGrosirStatus = incoming.overallPerdaganganBesarStatus;
              }
              if (incoming.overallKonsumenStatus && incoming.overallKonsumenStatus !== 'KOSONG') {
                target.overallKonsumenStatus = incoming.overallKonsumenStatus;
                target.overallStatus = incoming.overallKonsumenStatus;
              }
              if (incoming.catatan) {
                target.catatan = target.catatan ? `${target.catatan}; ${incoming.catatan}` : incoming.catatan;
                target.notes = target.catatan;
              }
            }
          });

          existing.commodities = Array.from(commMap.values()).sort((a, b) => a.no - b.no);
          existing.notes += `, ${ds.notes}`;
        }
      });

      const finalDatasets = Array.from(datasetMap.values());

      // Sort datasets chronologically
      finalDatasets.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      callback({
        datasets: finalDatasets,
        sheetCount: finalDatasets.length,
        message: `Berhasil mengekstrak ${finalDatasets.length} periode bulan (${finalDatasets.map((d) => d.monthLabel.split(' ')[0]).join(', ')}) dengan ${finalDatasets[0]?.commodities.length || 0} komoditas.`,
      });
    } catch (err: any) {
      callback(null, `Gagal membaca file Excel: ${err?.message || 'Format tidak dikenali'}`);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Download 1-Sheet Monthly Harmonization Template (Tabel Wilayah Kalbar Standar)
export function downloadMonthlySingleSheetTemplate(
  monthLabel: string = 'Januari 2024',
  sampleCommodities: CommodityRecord[] = [],
  regions: RegionInfo[] = []
) {
  const wb = XLSX.utils.book_new();

  const baseCommodities =
    sampleCommodities.length > 0
      ? sampleCommodities
      : MASTER_COMMODITIES.map((c) => ({
          no: c.no,
          name: c.name,
          category: c.category,
          unit: c.unit,
          catatan: '',
        }));

  const rows = baseCommodities.map((c: any) => {
    const kalbarVal =
      c.overallStatus && c.overallStatus !== 'KOSONG'
        ? c.overallStatus
        : '-';

    const rowObj: Record<string, any> = {
      'No.': c.no,
      'Komoditas': c.name,
      'Kategori': c.category || 'Pangan Pokok',
      'Satuan': c.unit || 'Kg',
      'Kalbar': kalbarVal,
    };

    regions.forEach((reg) => {
      const regStatus = c.regions?.[reg.id]?.status;
      rowObj[reg.name] = regStatus && regStatus !== 'KOSONG' ? regStatus : '-';
    });

    rowObj['Catatan'] = c.catatan || '';
    return rowObj;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const cleanLabel = monthLabel.replace(/\s+/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, `Harmonisasi_${cleanLabel}`.substring(0, 31));

  const filename = `Template_Tabel_Harmonisasi_Wilayah_${cleanLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Download 4-Sheet Monthly Harmonization Template (HD, HKD, HPB, HK - Tanpa Sheet Rekap)
export function downloadMonthly4SheetTemplate(
  monthLabel: string = 'Januari 2024',
  sampleCommodities: CommodityRecord[] = [],
  regions: RegionInfo[] = []
) {
  const wb = XLSX.utils.book_new();

  const baseCommodities = sampleCommodities.length > 0 ? sampleCommodities : Array.from({ length: 38 }, (_, i) => ({
    no: i + 1,
    name: `Komoditas ${i + 1}`,
    category: 'Pangan Pokok',
    unit: 'Kg',
    catatan: '',
  }));

  const sheetLevels: { code: string; title: string; levelKey: PriceLevel }[] = [
    { code: 'HD', title: 'Produsen Perdesaan (HD)', levelKey: 'produsen_desa' },
    { code: 'HKD', title: 'Konsumen Perdesaan (HKD)', levelKey: 'konsumen_desa' },
    { code: 'HPB', title: 'Perdagangan Besar (HPB)', levelKey: 'perdagangan_besar' },
    { code: 'HK', title: 'Harga Konsumen (HK)', levelKey: 'konsumen' },
  ];

  sheetLevels.forEach((level) => {
    const rows = baseCommodities.map((c: any) => {
      let kalbarVal = '-';
      if (level.levelKey === 'produsen_desa') {
        const val = c.overallProdusenDesaStatus || c.overallProdusenStatus;
        if (val && val !== 'KOSONG') kalbarVal = val;
      } else if (level.levelKey === 'konsumen_desa') {
        const val = c.overallKonsumenDesaStatus;
        if (val && val !== 'KOSONG') kalbarVal = val;
      } else if (level.levelKey === 'perdagangan_besar') {
        const val = c.overallPerdaganganBesarStatus || c.overallGrosirStatus;
        if (val && val !== 'KOSONG') kalbarVal = val;
      } else {
        const val = c.overallKonsumenStatus || c.overallStatus;
        if (val && val !== 'KOSONG') kalbarVal = val;
      }

      const rowObj: Record<string, any> = {
        'No.': c.no,
        'Komoditas': c.name,
        'Kategori': c.category || 'Pangan Pokok',
        'Satuan': c.unit || 'Kg',
        'Kalbar': kalbarVal,
      };

      regions.forEach((reg) => {
        const regData = c.regions?.[reg.id];
        let val = '-';
        if (regData) {
          if (level.levelKey === 'produsen_desa') {
            val = regData.produsenDesaStatus || regData.produsenStatus || '-';
          } else if (level.levelKey === 'konsumen_desa') {
            val = regData.konsumenDesaStatus || '-';
          } else if (level.levelKey === 'perdagangan_besar') {
            val = regData.perdaganganBesarStatus || regData.grosirStatus || '-';
          } else {
            val = regData.konsumenStatus || regData.status || '-';
          }
        }
        rowObj[reg.name] = val === 'KOSONG' ? '-' : val;
      });

      rowObj['Catatan'] = c.catatan || '';
      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, level.code);
  });

  const cleanMonth = monthLabel.replace(/\s+/g, '_');
  const filename = `Template_Harmonisasi_4Level_${cleanMonth}.xlsx`;
  XLSX.writeFile(wb, filename);
}
