import * as XLSX from 'xlsx';
import {
  IHK_REGIONS,
  IhkCommodityItem,
  IhkCompleteDataset,
  IhkMonthOption,
  IhkRegionDataset,
  IhkStatus,
} from '../types/ihk';
import { MASTER_IHK_COMMODITIES, generateIhkMonths } from '../data/initialIhkData';

// Month text normalizer helper (e.g. "Januari '24", "Agustus 2026", "Jan-24", "01/2024", "2024-01")
export const normalizeMonthHeader = (raw: string): { id: string; label: string; year: number; month: number } | null => {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim().toLowerCase();

  const monthMap: Record<string, number> = {
    jan: 1, januari: 1, jan24: 1,
    feb: 2, februari: 2,
    mar: 3, maret: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6,
    jul: 7, juli: 7,
    agu: 8, agust: 8, agustus: 8, aug: 8,
    sep: 9, september: 9,
    okt: 10, oktober: 10, oct: 10,
    nov: 11, november: 11,
    des: 12, desember: 12, dec: 12,
  };

  const fullMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Try matching year (e.g. 2024, 2025, 2026 or '24, '25, '26)
  let foundYear: number | null = null;
  const yearMatch = str.match(/(?:20)?(2[3-9])/);
  if (yearMatch) {
    foundYear = parseInt(yearMatch[1], 10) + 2000;
  }

  // Try matching month name
  let foundMonth: number | null = null;
  for (const [key, mNum] of Object.entries(monthMap)) {
    if (str.includes(key)) {
      foundMonth = mNum;
      break;
    }
  }

  if (foundYear && foundMonth) {
    const id = `${foundYear}-${String(foundMonth).padStart(2, '0')}`;
    return {
      id,
      label: `${fullMonthNames[foundMonth - 1]} ${foundYear}`,
      year: foundYear,
      month: foundMonth,
    };
  }

  return null;
};

// Calculate status based on points or percentage
export const calculateIhkStatus = (startVal: number, endVal: number, thresholdPercent: number = 0.5): IhkStatus => {
  if (!startVal || isNaN(startVal) || !endVal || isNaN(endVal)) return 'STABIL';
  const diffPercent = ((endVal - startVal) / startVal) * 100;
  if (diffPercent > thresholdPercent) return 'NAIK';
  if (diffPercent < -thresholdPercent) return 'TURUN';
  return 'STABIL';
};

// Parse an uploaded Excel file
export const parseIhkExcelFile = async (file: File): Promise<IhkCompleteDataset> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const regions: Record<string, IhkRegionDataset> = {};
        const detectedMonthsMap: Record<string, IhkMonthOption> = {};

        // Loop through sheets
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;

          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (rows.length < 2) return;

          // Find header row (the row containing "Kode" or "Komoditas")
          let headerRowIdx = -1;
          for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const rowStr = (rows[r] || []).map((c) => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('kode') || rowStr.includes('komoditas')) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx === -1) return;

          const headerRow = rows[headerRowIdx];
          let noCol = -1;
          let codeCol = -1;
          let nameCol = -1;
          const monthCols: { colIdx: number; monthInfo: { id: string; label: string; year: number; month: number } }[] = [];

          headerRow.forEach((cellVal: any, colIdx: number) => {
            const valStr = String(cellVal || '').trim();
            const lower = valStr.toLowerCase();

            if (lower === 'n' || lower === 'no' || lower === 'no.') {
              noCol = colIdx;
            } else if (lower === 'kode' || lower === 'kd' || lower.includes('kode komoditas')) {
              codeCol = colIdx;
            } else if (lower.includes('komoditas') || lower.includes('nama')) {
              nameCol = colIdx;
            } else {
              const parsedMonth = normalizeMonthHeader(valStr);
              if (parsedMonth) {
                monthCols.push({ colIdx, monthInfo: parsedMonth });
                detectedMonthsMap[parsedMonth.id] = {
                  id: parsedMonth.id,
                  label: parsedMonth.label,
                  shortLabel: `${parsedMonth.label.substring(0, 3)} '${String(parsedMonth.year).slice(-2)}`,
                  year: parsedMonth.year,
                  month: parsedMonth.month,
                };
              }
            }
          });

          if (codeCol === -1 && nameCol === -1) return;

          // Match region from sheet name e.g. tidur6106, tidur6107, tidur6111, tidur6171, tidur6172
          const cleanSheetName = sheetName.trim().toLowerCase();
          let matchedRegion = IHK_REGIONS.find(
            (r) => cleanSheetName.includes(r.id.toLowerCase()) || cleanSheetName.includes(r.code)
          );

          if (!matchedRegion) {
            matchedRegion = {
              id: cleanSheetName,
              code: cleanSheetName.replace(/\D/g, '') || '0000',
              name: `Wilayah ${sheetName}`,
              shortName: sheetName,
              sheetName,
              type: 'Kabupaten',
            };
          }

          const items: IhkCommodityItem[] = [];

          // Parse data rows
          for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const noVal = noCol !== -1 ? parseInt(String(row[noCol]), 10) : r - headerRowIdx;
            const codeVal = codeCol !== -1 ? String(row[codeCol] || '').trim() : '';
            const nameVal = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';

            if (!nameVal && !codeVal) continue;

            const monthlyValues: Record<string, number> = {};
            monthCols.forEach(({ colIdx, monthInfo }) => {
              const cellRaw = row[colIdx];
              if (cellRaw !== undefined && cellRaw !== null && cellRaw !== '') {
                const cleanNum = parseFloat(String(cellRaw).replace(/,/g, '.'));
                if (!isNaN(cleanNum)) {
                  monthlyValues[monthInfo.id] = cleanNum;
                }
              }
            });

            // Find category from master or heuristic
            const masterMatch = MASTER_IHK_COMMODITIES.find(
              (m) => m.code === codeVal || m.name.toLowerCase() === nameVal.toLowerCase()
            );

            items.push({
              no: !isNaN(noVal) ? noVal : items.length + 1,
              code: codeVal || (masterMatch ? masterMatch.code : `C${items.length + 1}`),
              name: nameVal || (masterMatch ? masterMatch.name : `Komoditas ${items.length + 1}`),
              category: masterMatch ? masterMatch.category : 'Umum',
              monthlyValues,
            });
          }

          if (items.length > 0) {
            regions[matchedRegion.id] = {
              regionId: matchedRegion.id,
              sheetName,
              regionName: matchedRegion.name,
              regionCode: matchedRegion.code,
              items,
            };
          }
        });

        // Ensure available months are sorted
        const sortedMonths = Object.values(detectedMonthsMap).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });

        const finalMonths = sortedMonths.length > 0 ? sortedMonths : generateIhkMonths();

        resolve({
          availableMonths: finalMonths,
          regions,
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

// Export IHK Dataset to Multi-Sheet Excel matching BPS layout
export const exportIhkToExcel = (
  dataset: IhkCompleteDataset,
  startMonthId: string = '2024-01',
  endMonthId: string = '2026-08',
  customFileName?: string
) => {
  const wb = XLSX.utils.book_new();

  const startMonth = dataset.availableMonths.find((m) => m.id === startMonthId) || dataset.availableMonths[0];
  const endMonth = dataset.availableMonths.find((m) => m.id === endMonthId) || dataset.availableMonths[dataset.availableMonths.length - 1];

  const startLabel = startMonth ? startMonth.label : 'Januari 2024';
  const endLabel = endMonth ? endMonth.label : 'Agustus 2026';

  // 1. Sheet KALBAR: Sebaran Fluktuasi 5 Wilayah (Naik, Turun, Stabil)
  const kalbarWsData: any[][] = [];
  kalbarWsData.push([`TABEL IHK KOMODITAS KONSUMEN - PROVINSI KALIMANTAN BARAT (SEBARAN 5 WILAYAH)`]);
  kalbarWsData.push([`Periode Perbandingan: ${startLabel} s/d ${endLabel}`]);
  kalbarWsData.push([]);
  kalbarWsData.push([
    'N',
    'Kode',
    'Komoditas',
    'Kota Pontianak (tidur6171)',
    'Kota Singkawang (tidur6172)',
    'Kab. Ketapang (tidur6106)',
    'Kab. Sintang (tidur6107)',
    'Kab. Kayong Utara (tidur6111)',
    'Sebaran Fluktuasi 5 Wilayah',
  ]);

  // Aggregate commodities across regions
  const commMap = new Map<string, { no: number; code: string; name: string }>();
  Object.values(dataset.regions).forEach((reg) => {
    reg.items.forEach((it) => {
      const key = it.code || it.name.trim().toLowerCase();
      if (!commMap.has(key)) {
        commMap.set(key, { no: it.no, code: it.code, name: it.name });
      }
    });
  });

  Array.from(commMap.values())
    .sort((a, b) => a.no - b.no)
    .forEach((it) => {
      const regStatuses: Record<string, string> = {};
      let nNaik = 0;
      let nTurun = 0;
      let nStabil = 0;

      IHK_REGIONS.forEach((reg) => {
        const regDs = dataset.regions[reg.id];
        const fItem = regDs?.items.find((x) => x.code === it.code || x.name.trim().toLowerCase() === it.name.trim().toLowerCase());
        if (fItem) {
          const valS = fItem.monthlyValues[startMonthId] ?? 0;
          const valE = fItem.monthlyValues[endMonthId] ?? 0;
          if (valS > 0 || valE > 0) {
            const st = calculateIhkStatus(valS, valE);
            regStatuses[reg.id] = st;
            if (st === 'NAIK') nNaik++;
            else if (st === 'TURUN') nTurun++;
            else nStabil++;
          } else {
            regStatuses[reg.id] = '-';
          }
        } else {
          regStatuses[reg.id] = '-';
        }
      });

      const sebaranSummary = [
        nNaik > 0 ? `${nNaik} Naik` : '',
        nTurun > 0 ? `${nTurun} Turun` : '',
        nStabil > 0 ? `${nStabil} Stabil` : '',
      ]
        .filter(Boolean)
        .join(', ') || '-';

      kalbarWsData.push([
        it.no,
        it.code,
        it.name,
        regStatuses['tidur6171'] || '-',
        regStatuses['tidur6172'] || '-',
        regStatuses['tidur6106'] || '-',
        regStatuses['tidur6107'] || '-',
        regStatuses['tidur6111'] || '-',
        sebaranSummary,
      ]);
    });

  const kalbarWs = XLSX.utils.aoa_to_sheet(kalbarWsData);
  kalbarWs['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 38 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, kalbarWs, 'KALBAR_Sebaran_5_Wilayah');

  // 2. Sheets per Kab/Kota (Selisih Poin dihapus)
  Object.values(dataset.regions).forEach((reg) => {
    const wsData: any[][] = [];

    // Header title
    wsData.push([`TABEL IHK KOMODITAS KONSUMEN (HK) - ${reg.regionName.toUpperCase()}`]);
    wsData.push([`Perbandingan Periode: ${startLabel} s/d ${endLabel}`]);
    wsData.push([]);

    // Table Header without Selisih Poin
    wsData.push([
      'N',
      'Kode',
      'Komoditas',
      endLabel,
      startLabel,
      'Perubahan (%)',
      `Status (${startMonth?.shortLabel || 'Start'} - ${endMonth?.shortLabel || 'End'})`,
    ]);

    // Rows
    reg.items.forEach((item) => {
      const valStart = item.monthlyValues[startMonthId] ?? 0;
      const valEnd = item.monthlyValues[endMonthId] ?? 0;
      const diffPercent = valStart > 0 ? Math.round(((valEnd - valStart) / valStart) * 1000) / 10 : 0;
      const status = calculateIhkStatus(valStart, valEnd);

      wsData.push([
        item.no,
        item.code,
        item.name,
        valEnd > 0 ? valEnd : '-',
        valStart > 0 ? valStart : '-',
        `${diffPercent > 0 ? '+' : ''}${diffPercent}%`,
        status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths without Selisih Poin
    ws['!cols'] = [
      { wch: 6 },  // N
      { wch: 12 }, // Kode
      { wch: 38 }, // Komoditas
      { wch: 16 }, // End Month
      { wch: 16 }, // Start Month
      { wch: 16 }, // Perubahan (%)
      { wch: 22 }, // Status
    ];

    const sheetName = reg.sheetName || reg.regionId;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  });

  const fileName = customFileName || `IHK_Konsumen_Kalbar_${startMonthId}_sd_${endMonthId}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// Generate Template Excel for IHK
export const downloadIhkTemplateExcel = () => {
  const wb = XLSX.utils.book_new();

  IHK_REGIONS.forEach((reg) => {
    const wsData: any[][] = [];

    // Header exactly matching user screenshot
    wsData.push([
      'N',
      'Kode',
      'Komoditas',
      'Agustus 2026',
      "Januari '24",
      'status (2024-2026)',
    ]);

    MASTER_IHK_COMMODITIES.forEach((c) => {
      const status = calculateIhkStatus(c.valJan24, c.valAgu26);
      wsData.push([
        c.no,
        c.code,
        c.name,
        c.valAgu26,
        c.valJan24,
        status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, reg.sheetName);
  });

  XLSX.writeFile(wb, 'Template_IHK_Konsumen_Kalbar_5_Wilayah.xlsx');
};
