import * as XLSX from 'xlsx';
import { MASTER_COMMODITIES, MasterCommodity } from '../data/initialData';
import {
  CommodityCategory,
  CommodityPriceLevelHarmonization,
  CommodityRecord,
  CommoditySeriesPoint,
  CommoditySeriesSummary,
  CommodityTrendAnalysis,
  LevelAlignmentType,
  MonthlyHarmonizationDataset,
  PriceLevel,
  PriceStatus,
  RegionalLevelRecord,
  RegionInfo,
  TrendPatternType,
  TrendPeriod,
} from '../types';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function computeOverallStatus(
  regions: Record<string, any>,
  level?: PriceLevel
): PriceStatus {
  let naik = 0;
  let turun = 0;
  let stabil = 0;
  let kosong = 0;

  Object.values(regions || {}).forEach((r: any) => {
    let st: PriceStatus = 'KOSONG';
    if (level === 'produsen_desa' || level === 'produsen') {
      st = r?.produsenDesaStatus || r?.produsenStatus || 'KOSONG';
    } else if (level === 'konsumen_desa') {
      st = r?.konsumenDesaStatus || 'KOSONG';
    } else if (level === 'perdagangan_besar' || level === 'grosir') {
      st = r?.perdaganganBesarStatus || r?.grosirStatus || 'KOSONG';
    } else if (level === 'konsumen') {
      st = r?.konsumenStatus || r?.status || 'KOSONG';
    } else {
      st = r?.status || 'KOSONG';
    }

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

export function getStatusBadgeStyle(status: PriceStatus | undefined): {
  bg: string;
  text: string;
  border: string;
  label: string;
  dotColor: string;
  isKosong: boolean;
} {
  switch (status) {
    case 'NAIK':
      return {
        bg: 'bg-rose-50 text-rose-700',
        text: 'text-rose-700 font-semibold',
        border: 'border-rose-200',
        label: 'NAIK',
        dotColor: 'bg-rose-500',
        isKosong: false,
      };
    case 'TURUN':
      return {
        bg: 'bg-blue-50 text-blue-700',
        text: 'text-blue-700 font-semibold',
        border: 'border-blue-200',
        label: 'TURUN',
        dotColor: 'bg-blue-500',
        isKosong: false,
      };
    case 'STABIL':
    case '0':
      return {
        bg: 'bg-emerald-50 text-emerald-700',
        text: 'text-emerald-700 font-medium',
        border: 'border-emerald-200',
        label: 'STABIL',
        dotColor: 'bg-emerald-500',
        isKosong: false,
      };
    case 'KOSONG':
    case '-':
      return {
        bg: 'bg-slate-100 text-slate-400',
        text: 'text-slate-400 font-normal',
        border: 'border-dashed border-slate-300',
        label: '-',
        dotColor: 'bg-slate-300',
        isKosong: true,
      };
    case '':
    default:
      return {
        bg: 'bg-slate-50 text-slate-400',
        text: 'text-slate-400',
        border: 'border-slate-200',
        label: '-',
        dotColor: 'bg-slate-200',
        isKosong: true,
      };
  }
}

export function computeCommoditySeries(
  commodityId: string,
  datasets: MonthlyHarmonizationDataset[],
  selectedRegionId: string = 'all',
  priceLevel: PriceLevel | 'all' | string = 'all'
): CommoditySeriesSummary | null {
  if (!datasets || datasets.length === 0) return null;

  // Sort datasets chronologically: earliest year & month first (at index 0 / far left)
  const sortedDatasets = [...datasets].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Find target commodity from ANY dataset
  let targetCommodity: CommodityRecord | undefined;
  for (const ds of sortedDatasets) {
    const found = ds.commodities.find(
      (c) =>
        c.id === commodityId ||
        String(c.no) === commodityId ||
        c.name.toLowerCase().trim() === commodityId.toLowerCase().trim()
    );
    if (found) {
      targetCommodity = found;
      break;
    }
  }

  if (!targetCommodity) return null;

  const points: CommoditySeriesPoint[] = [];
  let stabilMonths = 0;
  let naikMonths = 0;
  let turunMonths = 0;
  let kosongMonths = 0;
  let totalActiveRegsAcc = 0;

  sortedDatasets.forEach((dataset) => {
    const comm = dataset.commodities.find(
      (c) =>
        c.id === targetCommodity!.id ||
        c.no === targetCommodity!.no ||
        c.name.toLowerCase().trim() === targetCommodity!.name.toLowerCase().trim()
    );

    if (!comm) {
      // Create a neutral placeholder point so every month in sortedDatasets has an exact 1-to-1 matching column
      points.push({
        monthId: dataset.id,
        monthLabel: dataset.monthLabel,
        year: dataset.year,
        month: dataset.month,
        overallStatus: 'KOSONG',
        score: 0,
        naikCount: 0,
        turunCount: 0,
        stabilCount: 0,
        kosongCount: 0,
        totalRegions: 0,
        activeRegionsCount: 0,
        naikPercentage: 0,
        turunPercentage: 0,
        stabilPercentage: 0,
        regionalStatuses: {},
        produsenDesaStatus: 'KOSONG',
        konsumenDesaStatus: 'KOSONG',
        perdaganganBesarStatus: 'KOSONG',
        konsumenStatus: 'KOSONG',
        produsenStatus: 'KOSONG',
        grosirStatus: 'KOSONG',
      });
      kosongMonths++;
      return;
    }

    let effectiveStatus: PriceStatus = '0';
    let score = 0;
    let naikCount = 0;
    let turunCount = 0;
    let stabilCount = 0;
    let kosongCount = 0;
    const regionalStatuses: Record<string, PriceStatus> = {};
    const regionEntries = Object.entries(comm.regions || {});
    const totalRegs = regionEntries.length || 1;

    // Helper to extract status for a region based on priceLevel
    const getRegionStatusForLevel = (regData: any): PriceStatus => {
      if (!regData) return 'KOSONG';
      if (priceLevel === 'produsen_desa' || priceLevel === 'produsen') {
        return regData.produsenDesaStatus || regData.produsenStatus || 'KOSONG';
      }
      if (priceLevel === 'konsumen_desa') {
        return regData.konsumenDesaStatus || 'KOSONG';
      }
      if (priceLevel === 'perdagangan_besar' || priceLevel === 'grosir') {
        return regData.perdaganganBesarStatus || regData.grosirStatus || 'KOSONG';
      }
      if (priceLevel === 'konsumen') {
        return regData.konsumenStatus || regData.status || 'KOSONG';
      }
      return regData.status || 'KOSONG';
    };

    regionEntries.forEach(([regId, regData]) => {
      const st = getRegionStatusForLevel(regData);
      regionalStatuses[regId] = st;
      if (st === 'NAIK') naikCount++;
      else if (st === 'TURUN') turunCount++;
      else if (st === 'STABIL') stabilCount++;
      else if (st === 'KOSONG' || st === '-' || st === '0' || !st) kosongCount++;
    });

    const activeRegs = naikCount + turunCount + stabilCount;
    totalActiveRegsAcc += activeRegs;

    if (selectedRegionId === 'all') {
      let targetOverall: PriceStatus | undefined;
      if (priceLevel === 'produsen_desa' || priceLevel === 'produsen') {
        targetOverall = comm.overallProdusenDesaStatus || comm.overallProdusenStatus;
      } else if (priceLevel === 'konsumen_desa') {
        targetOverall = comm.overallKonsumenDesaStatus;
      } else if (priceLevel === 'perdagangan_besar' || priceLevel === 'grosir') {
        targetOverall = comm.overallPerdaganganBesarStatus || comm.overallGrosirStatus;
      } else if (priceLevel === 'konsumen') {
        targetOverall = comm.overallKonsumenStatus;
      } else {
        targetOverall = comm.overallStatus;
      }

      if (targetOverall && targetOverall !== 'KOSONG' && targetOverall !== '0' && targetOverall !== '-') {
        effectiveStatus = targetOverall;
      } else {
        if (activeRegs === 0) {
          effectiveStatus = 'KOSONG';
        } else if (naikCount > turunCount && naikCount >= stabilCount) {
          effectiveStatus = 'NAIK';
        } else if (turunCount > naikCount && turunCount >= stabilCount) {
          effectiveStatus = 'TURUN';
        } else if (stabilCount > 0) {
          effectiveStatus = 'STABIL';
        } else {
          effectiveStatus = 'KOSONG';
        }
      }
    } else {
      effectiveStatus = getRegionStatusForLevel(comm.regions?.[selectedRegionId]);
    }

    if (effectiveStatus === 'NAIK') {
      score = 1;
      naikMonths++;
    } else if (effectiveStatus === 'TURUN') {
      score = -1;
      turunMonths++;
    } else if (effectiveStatus === 'STABIL') {
      score = 0;
      stabilMonths++;
    } else {
      score = 0;
      kosongMonths++;
    }

    const denominator = activeRegs > 0 ? activeRegs : 1;

    points.push({
      monthId: dataset.id,
      monthLabel: dataset.monthLabel,
      year: dataset.year,
      month: dataset.month,
      overallStatus: effectiveStatus,
      score,
      naikCount,
      turunCount,
      stabilCount,
      kosongCount,
      totalRegions: totalRegs,
      activeRegionsCount: activeRegs,
      naikPercentage: activeRegs > 0 ? Math.round((naikCount / denominator) * 100) : 0,
      turunPercentage: activeRegs > 0 ? Math.round((turunCount / denominator) * 100) : 0,
      stabilPercentage: activeRegs > 0 ? Math.round((stabilCount / denominator) * 100) : 0,
      regionalStatuses,
      produsenDesaStatus: comm.overallProdusenDesaStatus || comm.overallProdusenStatus,
      konsumenDesaStatus: comm.overallKonsumenDesaStatus,
      perdaganganBesarStatus: comm.overallPerdaganganBesarStatus || comm.overallGrosirStatus,
      konsumenStatus: comm.overallKonsumenStatus || comm.overallStatus,
      produsenStatus: comm.overallProdusenDesaStatus || comm.overallProdusenStatus,
      grosirStatus: comm.overallPerdaganganBesarStatus || comm.overallGrosirStatus,
    });
  });

  const totalMonths = points.length;
  const activeChangeMonths = naikMonths + turunMonths;
  const activeObservations = totalMonths - kosongMonths;
  const stabilityRate = activeObservations > 0 ? Math.round((stabilMonths / activeObservations) * 100) : 0;
  const volatilityRate = activeObservations > 0 ? Math.round((activeChangeMonths / activeObservations) * 100) : 0;

  // Volatility classification
  let volatilityClassification: CommoditySeriesSummary['volatilityClassification'] = 'CENDERUNG STABIL';
  if (volatilityRate >= 60) {
    volatilityClassification = 'SANGAT BERGEJOLAK';
  } else if (volatilityRate >= 35) {
    volatilityClassification = 'FLUKTUATIF';
  } else if (stabilityRate >= 80) {
    volatilityClassification = 'SANGAT STABIL';
  } else {
    volatilityClassification = 'CENDERUNG STABIL';
  }

  // Trend direction
  let trendDirection: CommoditySeriesSummary['trendDirection'] = 'STABIL';
  if (naikMonths > turunMonths && naikMonths >= 2) {
    trendDirection = 'TREN MENAIK';
  } else if (turunMonths > naikMonths && turunMonths >= 2) {
    trendDirection = 'TREN MENURUN';
  } else if (activeChangeMonths >= 2 && naikMonths > 0 && turunMonths > 0) {
    trendDirection = 'FLUKTUATIF / TIDAK MENENTU';
  } else {
    trendDirection = 'STABIL';
  }

  // Calculate streaks
  let currentStreakStatus: PriceStatus = points.length > 0 ? points[points.length - 1].overallStatus : '0';
  let currentStreakCount = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].overallStatus === currentStreakStatus && currentStreakStatus !== '0' && currentStreakStatus !== '' && currentStreakStatus !== 'KOSONG') {
      currentStreakCount++;
    } else {
      break;
    }
  }

  let maxConsecutiveNaik = 0;
  let curNaik = 0;
  let maxConsecutiveTurun = 0;
  let curTurun = 0;

  points.forEach((p) => {
    if (p.overallStatus === 'NAIK') {
      curNaik++;
      if (curNaik > maxConsecutiveNaik) maxConsecutiveNaik = curNaik;
    } else {
      curNaik = 0;
    }

    if (p.overallStatus === 'TURUN') {
      curTurun++;
      if (curTurun > maxConsecutiveTurun) maxConsecutiveTurun = curTurun;
    } else {
      curTurun = 0;
    }
  });

  const averageActiveRegions = totalMonths > 0 ? Math.round(totalActiveRegsAcc / totalMonths) : 0;

  return {
    commodityId: targetCommodity.id,
    commodityName: targetCommodity.name,
    category: targetCommodity.category,
    no: targetCommodity.no,
    totalMonths,
    stabilMonths,
    naikMonths,
    turunMonths,
    kosongMonths,
    stabilityRate,
    volatilityRate,
    volatilityClassification,
    trendDirection,
    currentStreak: {
      status: currentStreakStatus,
      count: currentStreakCount,
    },
    maxConsecutiveNaik,
    maxConsecutiveTurun,
    averageActiveRegions,
    series: points,
  };
}

export function computeAllCommoditySummaries(
  datasets: MonthlyHarmonizationDataset[],
  selectedRegionId: string = 'all',
  priceLevel: PriceLevel | 'all' | string = 'all'
): CommoditySeriesSummary[] {
  if (!datasets || datasets.length === 0) return [];

  // Sort datasets chronologically: earliest year & month first (at index 0 / far left)
  const sortedDatasets = [...datasets].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Map of unique commodities by number or normalized name across ALL datasets
  const commMap = new Map<string, CommodityRecord>();
  sortedDatasets.forEach((ds) => {
    ds.commodities.forEach((c) => {
      const key = String(c.no || c.name.toLowerCase().trim());
      if (!commMap.has(key)) {
        commMap.set(key, c);
      }
    });
  });

  const allCommodities = Array.from(commMap.values()).sort((a, b) => a.no - b.no);
  const summaries: CommoditySeriesSummary[] = [];

  allCommodities.forEach((comm) => {
    const summary = computeCommoditySeries(String(comm.no || comm.id), sortedDatasets, selectedRegionId, priceLevel);
    if (summary) {
      summaries.push(summary);
    }
  });

  return summaries;
}

/**
 * Computes price level harmonization across 4 tiers:
 * 1. Harga Produsen Perdesaan (Petani / Peternak / Nelayan)
 * 2. Harga Konsumen Perdesaan (Warung / Pasar Desa)
 * 3. Harga Perdagangan Besar (Distributor / Pasar Induk / Grosir)
 * 4. Harga Konsumen (Eceran Perkotaan / Pasar Tradisional & Modern)
 */
export function computeCommodityPriceLevelHarmonization(
  comm: CommodityRecord,
  regions: RegionInfo[],
  selectedRegionId: string = 'all'
): CommodityPriceLevelHarmonization {
  const regionalBreakdown: RegionalLevelRecord[] = [];
  let alignedCount = 0;
  let nonProdusenCount = 0;
  let emptyCount = 0;
  let activeCount = 0;

  regions.forEach((reg) => {
    const regData = comm.regions?.[reg.id];

    // Helper to normalize status values
    const normalizeStatus = (s?: PriceStatus | string): 'NAIK' | 'TURUN' | 'STABIL' | null => {
      if (!s || s === 'KOSONG' || s === '-' || s === '--' || s === '0' || s === 'NIHIL' || s === '') return null;
      if (s === 'STABIL') return 'STABIL';
      if (s === 'NAIK') return 'NAIK';
      if (s === 'TURUN') return 'TURUN';
      return null;
    };

    // Extract statuses for all 4 price levels directly
    const rawProdusen = regData?.produsenDesaStatus ?? regData?.produsenStatus;
    const rawKonsumenDesa = regData?.konsumenDesaStatus;
    const rawPerdaganganBesar = regData?.perdaganganBesarStatus ?? regData?.grosirStatus;
    const rawKonsumen = regData?.konsumenStatus ?? regData?.status;

    const sPDesa = normalizeStatus(rawProdusen);
    const sKDesa = normalizeStatus(rawKonsumenDesa);
    const sPB = normalizeStatus(rawPerdaganganBesar);
    const sK = normalizeStatus(rawKonsumen);

    // If at least one price level has valid data, or hasCommodity is explicitly true, count this region in Cakupan!
    const hasAnyLevel = Boolean(sPDesa || sKDesa || sPB || sK || (regData && regData.hasCommodity === true));

    // 4 Price Levels assigned cleanly
    const produsenDesa = (sPDesa || 'KOSONG') as PriceStatus;
    const konsumenDesa = (sKDesa || 'KOSONG') as PriceStatus;
    const perdaganganBesar = (sPB || 'KOSONG') as PriceStatus;
    const konsumen = (sK || 'KOSONG') as PriceStatus;

    let alignment: LevelAlignmentType = 'BERVARIASI';
    let alignmentLabel = 'Arah Bervariasi Antar Level';
    let alignmentDescription = 'Pergerakan harga memiliki arah berbeda antar level (tidak serempak).';
    let transmissionNote = '';

    if (!hasAnyLevel) {
      alignment = 'NIHIL';
      alignmentLabel = 'Nihil / Tidak Ada Komoditas';
      alignmentDescription = 'Komoditas tidak diproduksi maupun disurvei di kabupaten ini.';
      emptyCount++;
    } else {
      activeCount++;

      // Evaluate active non-empty levels for this region
      const activeRegLevels: { level: string; status: 'NAIK' | 'TURUN' | 'STABIL' }[] = [];
      if (sPDesa) activeRegLevels.push({ level: 'produsen_desa', status: sPDesa });
      if (sKDesa) activeRegLevels.push({ level: 'konsumen_desa', status: sKDesa });
      if (sPB) activeRegLevels.push({ level: 'perdagangan_besar', status: sPB });
      if (sK) activeRegLevels.push({ level: 'konsumen', status: sK });

      const distinctDirections = Array.from(new Set(activeRegLevels.map((l) => l.status)));
      const isPurelyNaik = distinctDirections.length === 1 && distinctDirections[0] === 'NAIK';
      const isPurelyTurun = distinctDirections.length === 1 && distinctDirections[0] === 'TURUN';
      const isPurelyStabil = distinctDirections.length === 1 && distinctDirections[0] === 'STABIL';

      if (activeRegLevels.length >= 1 && isPurelyNaik) {
        alignment = 'SELARAS_NAIK';
        if (activeRegLevels.length === 1) {
          alignmentLabel = 'Selaras Naik (1 Level)';
          alignmentDescription = `Tingkat ${activeRegLevels[0].level === 'konsumen' ? 'Konsumen' : activeRegLevels[0].level === 'produsen_desa' ? 'Produsen' : activeRegLevels[0].level} terpantau naik tanpa kontradiksi level lain.`;
        } else if (!sPDesa) {
          alignmentLabel = 'Selaras Naik (Pasokan Luar)';
          alignmentDescription = 'Pasokan dari luar daerah, harga serempak naik di seluruh tingkat perdagangan aktif.';
        } else {
          alignmentLabel = 'Selaras Naik (Rantai Pasok)';
          alignmentDescription = 'Kenaikan serentak di Produsen Perdesaan, Konsumen Perdesaan, Perdagangan Besar, hingga Konsumen.';
        }
        alignedCount++;
      } else if (activeRegLevels.length >= 1 && isPurelyTurun) {
        alignment = 'SELARAS_TURUN';
        if (activeRegLevels.length === 1) {
          alignmentLabel = 'Selaras Turun (1 Level)';
          alignmentDescription = `Tingkat ${activeRegLevels[0].level === 'konsumen' ? 'Konsumen' : activeRegLevels[0].level === 'produsen_desa' ? 'Produsen' : activeRegLevels[0].level} terpantau turun tanpa kontradiksi level lain.`;
        } else if (!sPDesa) {
          alignmentLabel = 'Selaras Turun (Pasokan Luar)';
          alignmentDescription = 'Pasokan dari luar daerah, harga serempak turun di seluruh tingkat perdagangan aktif.';
        } else {
          alignmentLabel = 'Selaras Turun (Rantai Pasok)';
          alignmentDescription = 'Penurunan harga serentak di semua tingkatan rantai pasok aktif.';
        }
        alignedCount++;
      } else if (activeRegLevels.length >= 1 && isPurelyStabil) {
        alignment = 'SELARAS_STABIL';
        alignmentLabel = activeRegLevels.length === 1 ? 'Selaras Stabil (1 Level)' : 'Selaras Stabil (Rantai Pasok)';
        alignmentDescription = 'Seluruh level harga aktif terpantau stabil tanpa gejolak.';
        alignedCount++;
      } else {
        // ADA PERBEDAAN ARAH ANTAR LEVEL (TIDAK BOLEH SELARAS)
        if (!sPDesa) {
          alignment = 'NON_PRODUSEN';
          alignmentLabel = 'Non-Produsen (Arah Berbeda)';
          alignmentDescription = 'Bukan daerah produsen desa; terdapat perbedaan arah harga antar level perdagangan.';
          transmissionNote = `HPB: ${perdaganganBesar} ➔ HK: ${konsumen} | HKD: ${konsumenDesa}`;
          nonProdusenCount++;
        } else if (sPDesa === 'NAIK' && (sK === 'TURUN' || sPB === 'TURUN' || sKDesa === 'TURUN')) {
          alignment = 'MARGIN_TERTEKAN';
          alignmentLabel = 'Margin Rantai Pasok Tertekan';
          alignmentDescription = 'Harga Produsen Perdesaan naik namun ada level hilir yang turun.';
          transmissionNote = 'Margin keuntungan pedagang perantara tertekan';
        } else if ((sPDesa === 'STABIL' || sPDesa === 'TURUN') && (sK === 'NAIK' || sPB === 'NAIK' || sKDesa === 'NAIK')) {
          alignment = 'ASIMETRI_MARGIN';
          alignmentLabel = 'Asimetri Margin Distribusi';
          alignmentDescription = 'Kenaikan terjadi di hilir meski harga Produsen Perdesaan stabil atau turun.';
          transmissionNote = 'Tekanan bersumber dari logistik atau pelebaran marjin';
        } else if (sPDesa === 'NAIK' && sK === 'STABIL') {
          alignment = 'LAG_TRANSMISI';
          alignmentLabel = 'Lag Transmisi Hulu-Hilir';
          alignmentDescription = 'Harga Produsen Perdesaan sudah naik, namun harga Konsumen Eceran belum menyesuaikan.';
          transmissionNote = 'Potensi lonjakan susulan di pasar konsumen';
        } else if (sPDesa === 'TURUN' && sK === 'STABIL') {
          alignment = 'LAG_TRANSMISI';
          alignmentLabel = 'Lag Penurunan Hulu-Hilir';
          alignmentDescription = 'Harga Produsen sudah turun tetapi harga eceran konsumen masih tertahan.';
          transmissionNote = 'Penurunan harga tertahan di tingkat perantara';
        } else if ((sPDesa === 'NAIK' || sKDesa === 'NAIK') && (sPB !== 'NAIK' || sK !== 'NAIK')) {
          alignment = 'DISPARITAS_DESA_KOTA';
          alignmentLabel = 'Disparitas Perdesaan vs Kota';
          alignmentDescription = 'Gejolak harga di wilayah perdesaan tidak sejalan dengan pusat perdagangan kota.';
          transmissionNote = 'Perbedaan dinamika pasar perdesaan dan perkotaan';
        } else {
          alignment = 'BERVARIASI';
          alignmentLabel = 'Arah Bervariasi Antar Level';
          alignmentDescription = 'Pergerakan bervariasi antar level (arah harga berbeda).';
        }
      }
    }

    regionalBreakdown.push({
      regionId: reg.id,
      regionName: reg.name,
      produsenDesa,
      konsumenDesa,
      perdaganganBesar,
      konsumen,
      produsen: produsenDesa,
      grosir: perdaganganBesar,
      hasCommodity: hasAnyLevel,
      alignment,
      alignmentLabel,
      alignmentDescription,
      transmissionNote,
    });
  });

  // 4 Level Overalls: If a specific region is filtered, reflect that region's status; otherwise use province-wide aggregate
  let pDesaOverall: PriceStatus;
  let kDesaOverall: PriceStatus;
  let pbOverall: PriceStatus;
  let kOverall: PriceStatus;

  if (selectedRegionId && selectedRegionId !== 'all') {
    const targetReg = regionalBreakdown.find((r) => r.regionId === selectedRegionId);
    if (targetReg) {
      pDesaOverall = targetReg.produsenDesa;
      kDesaOverall = targetReg.konsumenDesa;
      pbOverall = targetReg.perdaganganBesar;
      kOverall = targetReg.konsumen;
    } else {
      pDesaOverall = comm.overallProdusenDesaStatus || 'KOSONG';
      kDesaOverall = comm.overallKonsumenDesaStatus || 'KOSONG';
      pbOverall = comm.overallPerdaganganBesarStatus || 'KOSONG';
      kOverall = comm.overallKonsumenStatus || comm.overallStatus || 'KOSONG';
    }
  } else {
    pDesaOverall = comm.overallProdusenDesaStatus || comm.overallProdusenStatus || computeOverallStatus(comm.regions, 'produsen_desa');
    kDesaOverall = comm.overallKonsumenDesaStatus || computeOverallStatus(comm.regions, 'konsumen_desa');
    pbOverall = comm.overallPerdaganganBesarStatus || comm.overallGrosirStatus || computeOverallStatus(comm.regions, 'perdagangan_besar');
    kOverall = comm.overallKonsumenStatus || comm.overallStatus || computeOverallStatus(comm.regions, 'konsumen');
  }

  // Strict Evaluation of 4-Level Transmission Direction
  const normalizeOverallStatus = (s: PriceStatus): 'NAIK' | 'TURUN' | 'STABIL' | null => {
    if (!s || s === 'KOSONG' || s === '-' || s === '0') return null;
    if (s === 'STABIL') return 'STABIL';
    if (s === 'NAIK') return 'NAIK';
    if (s === 'TURUN') return 'TURUN';
    return null;
  };

  const normPDesa = normalizeOverallStatus(pDesaOverall);
  const normKDesa = normalizeOverallStatus(kDesaOverall);
  const normPB = normalizeOverallStatus(pbOverall);
  const normK = normalizeOverallStatus(kOverall);

  const activeLevelList: { level: string; status: 'NAIK' | 'TURUN' | 'STABIL' }[] = [];
  if (normPDesa) activeLevelList.push({ level: 'produsen_desa', status: normPDesa });
  if (normKDesa) activeLevelList.push({ level: 'konsumen_desa', status: normKDesa });
  if (normPB) activeLevelList.push({ level: 'perdagangan_besar', status: normPB });
  if (normK) activeLevelList.push({ level: 'konsumen', status: normK });

  const distinctOverallDirs = Array.from(new Set(activeLevelList.map((l) => l.status)));
  const isPureAllNaik = distinctOverallDirs.length === 1 && distinctOverallDirs[0] === 'NAIK';
  const isPureAllTurun = distinctOverallDirs.length === 1 && distinctOverallDirs[0] === 'TURUN';
  const isPureAllStabil = distinctOverallDirs.length === 1 && distinctOverallDirs[0] === 'STABIL';

  let overallAlignment: LevelAlignmentType = 'BERVARIASI';
  let overallAlignmentLabel = 'Arah Bervariasi Antar Level';
  let overallAlignmentBadge = {
    bg: 'bg-slate-100 text-slate-700',
    text: 'text-slate-700 font-semibold',
    border: 'border-slate-300',
  };
  let disparityWarning: string | undefined = undefined;
  let transmissionNarrative = '';

  if (activeLevelList.length === 0) {
    overallAlignment = 'NIHIL';
    overallAlignmentLabel = 'Nihil / Tanpa Data';
    overallAlignmentBadge = { bg: 'bg-slate-100 text-slate-500', text: 'text-slate-500', border: 'border-dashed border-slate-300' };
    transmissionNarrative = `Komoditas ${comm.name} tidak memiliki catatan survei aktif pada periode ini.`;
  } else if (activeLevelList.length >= 2 && isPureAllNaik) {
    overallAlignment = 'SELARAS_NAIK';
    overallAlignmentLabel = !normPDesa ? 'Selaras Naik (Pasokan Luar)' : 'Selaras Naik Bersama (4 Level)';
    overallAlignmentBadge = { bg: 'bg-rose-50 text-rose-700', text: 'text-rose-700', border: 'border-rose-200' };
    transmissionNarrative = !normPDesa
      ? `Komoditas pasokan luar daerah mengalami kenaikan serentak di tingkat konsumen desa, perdagangan besar, dan eceran kota.`
      : `Kenaikan harga ${comm.name} terjadi serentak di 4 level: Produsen Perdesaan, Konsumen Perdesaan, Perdagangan Besar, hingga Harga Konsumen. Transmisi harga berlangsung simetris dan cepat di seluruh rantai distribusi.`;
  } else if (activeLevelList.length >= 2 && isPureAllTurun) {
    overallAlignment = 'SELARAS_TURUN';
    overallAlignmentLabel = !normPDesa ? 'Selaras Turun (Pasokan Luar)' : 'Selaras Turun Bersama (4 Level)';
    overallAlignmentBadge = { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-700', border: 'border-blue-200' };
    transmissionNarrative = !normPDesa
      ? `Komoditas pasokan luar daerah mengalami penurunan serentak di seluruh tingkat perdagangan aktif.`
      : `Penurunan harga ${comm.name} di tingkat hulu perdesaan (panen melimpah/suplai lancar) berhasil mengalir secara efisien hingga ke pedagang besar dan konsumen eceran.`;
  } else if (activeLevelList.length >= 2 && isPureAllStabil) {
    overallAlignment = 'SELARAS_STABIL';
    overallAlignmentLabel = 'Selaras Stabil (4 Level)';
    overallAlignmentBadge = { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200' };
    transmissionNarrative = `Pergerakan harga ${comm.name} terjaga stabil tanpa fluktuasi di seluruh 4 tingkat rantai pasok.`;
  } else {
    // ADA PERBEDAAN ARAH ANTAR LEVEL (TIDAK BOLEH SELARAS)
    if (!normPDesa) {
      overallAlignment = 'NON_PRODUSEN';
      overallAlignmentLabel = 'Non-Produsen (Arah Berbeda)';
      overallAlignmentBadge = { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', border: 'border-purple-200' };
      disparityWarning = `Komoditas pasokan luar memiliki arah berbeda: Konsumen Desa (${kDesaOverall}), Perdagangan Besar (${pbOverall}), dan Konsumen (${kOverall}).`;
      transmissionNarrative = `Komoditas tidak diproduksi di desa, dengan arah pergerakan harga berbeda antar tingkat perdagangan kota dan perdesaan.`;
    } else if (normPDesa === 'NAIK' && (normK === 'TURUN' || normPB === 'TURUN' || normKDesa === 'TURUN')) {
      overallAlignment = 'MARGIN_TERTEKAN';
      overallAlignmentLabel = 'Margin Tertekan (Hulu Naik, Hilir Turun)';
      overallAlignmentBadge = { bg: 'bg-purple-50 text-purple-800', text: 'text-purple-800', border: 'border-purple-300' };
      disparityWarning = 'Anomali Arah Berlawanan: Harga beli produsen desa naik namun ada harga konsumen/hilir yang turun.';
      transmissionNarrative = `Harga beli di tingkat Produsen Perdesaan mengalami kenaikan, namun harga jual di tingkat Konsumen justru turun. Kondisi ini menekan marjin keuntungan rantai distribusi.`;
    } else if ((normPDesa === 'TURUN' || normPDesa === 'STABIL') && (normK === 'NAIK' || normPB === 'NAIK' || normKDesa === 'NAIK')) {
      overallAlignment = 'ASIMETRI_MARGIN';
      overallAlignmentLabel = normPDesa === 'TURUN' ? 'Asimetri Margin (Hulu Turun, Hilir Naik)' : 'Asimetri Hilir (Hulu Stabil, Hilir Naik)';
      overallAlignmentBadge = { bg: 'bg-orange-50 text-orange-800', text: 'text-orange-800', border: 'border-orange-300' };
      disparityWarning = 'Pelebaran Margin: Kenaikan harga terjadi di hilir meski produsen perdesaan stabil atau turun.';
      transmissionNarrative = `Harga di tingkat Produsen Perdesaan tidak naik, namun Perdagangan Besar / Konsumen mengalami kenaikan. Terindikasi adanya tekanan biaya logistik atau pelebaran marjin perantara.`;
    } else if (normPDesa === 'NAIK' && normK === 'STABIL') {
      overallAlignment = 'LAG_TRANSMISI';
      overallAlignmentLabel = 'Lag Transmisi (Hulu Naik, Hilir Belum)';
      overallAlignmentBadge = { bg: 'bg-amber-50 text-amber-800', text: 'text-amber-800', border: 'border-amber-300' };
      disparityWarning = 'Peringatan Dini: Kenaikan harga di tingkat hulu desa berpotensi merembet ke pasar konsumen.';
      transmissionNarrative = `Terdeteksi kenaikan harga di tingkat Produsen Perdesaan yang belum sepenuhnya tertransmisikan ke Perdagangan Besar dan Konsumen. Perlu pemantauan potensi lonjakan susulan di pasar konsumen.`;
    } else if (normPDesa === 'TURUN' && normK === 'STABIL') {
      overallAlignment = 'LAG_TRANSMISI';
      overallAlignmentLabel = 'Lag Penurunan (Hulu Turun, Hilir Tertahan)';
      overallAlignmentBadge = { bg: 'bg-amber-50 text-amber-800', text: 'text-amber-800', border: 'border-amber-300' };
      disparityWarning = 'Penurunan harga produsen desa belum dinikmati konsumen (harga hilir masih tertahan).';
      transmissionNarrative = `Harga produsen perdesaan sudah turun, namun harga di tingkat pedagang besar dan konsumen masih tertahan stabil (sticky prices).`;
    } else if ((normPDesa === 'NAIK' || normKDesa === 'NAIK') && (normPB !== 'NAIK' || normK !== 'NAIK')) {
      overallAlignment = 'DISPARITAS_DESA_KOTA';
      overallAlignmentLabel = 'Disparitas Desa vs Kota';
      overallAlignmentBadge = { bg: 'bg-cyan-50 text-cyan-800', text: 'text-cyan-800', border: 'border-cyan-300' };
      disparityWarning = 'Disparitas arah harga antara wilayah perdesaan dan pusat perdagangan kota.';
      transmissionNarrative = `Gejolak harga di tingkat perdesaan belum atau tidak tertransmisi ke pusat perdagangan kota.`;
    } else {
      overallAlignment = 'BERVARIASI';
      overallAlignmentLabel = 'Arah Bervariasi Antar Level';
      overallAlignmentBadge = { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', border: 'border-slate-300' };
      disparityWarning = 'Pergerakan harga antar 4 level memiliki arah berbeda (tidak selaras).';
      transmissionNarrative = `Arah pergerakan harga berbeda di masing-masing level: Produsen Desa (${pDesaOverall}), Konsumen Desa (${kDesaOverall}), Perdagangan Besar (${pbOverall}), dan Konsumen (${kOverall}).`;
    }
  }

  const alignmentRate = activeCount > 0 ? Math.round((alignedCount / activeCount) * 100) : 100;

  return {
    commodityId: comm.id,
    commodityName: comm.name,
    no: comm.no,
    category: comm.category,
    unit: comm.unit,
    produsenDesaOverall: pDesaOverall,
    konsumenDesaOverall: kDesaOverall,
    perdaganganBesarOverall: pbOverall,
    konsumenOverall: kOverall,
    produsenOverall: pDesaOverall,
    grosirOverall: pbOverall,
    overallAlignment,
    overallAlignmentLabel,
    overallAlignmentBadge,
    regionalBreakdown,
    activeRegionsCount: activeCount,
    alignedCount,
    nonProducingCount: nonProdusenCount,
    emptyCount,
    alignmentRate,
    disparityWarning,
    transmissionNarrative,
  };
}

export function computeAllPriceLevelHarmonizations(
  dataset: MonthlyHarmonizationDataset,
  regions: RegionInfo[],
  selectedRegionId: string = 'all'
): CommodityPriceLevelHarmonization[] {
  if (!dataset || !dataset.commodities) return [];
  return dataset.commodities.map((c) => computeCommodityPriceLevelHarmonization(c, regions, selectedRegionId));
}

/**
 * Analyzes multi-month trajectory for a commodity, identifying sharp increase periods,
 * significant drop periods, and prolonged stability streaks.
 */
export function analyzeCommodityTrend(summary: CommoditySeriesSummary): CommodityTrendAnalysis {
  const points = summary.series;
  const sharpIncreasePeriods: TrendPeriod[] = [];
  const significantDropPeriods: TrendPeriod[] = [];
  const prolongedStabilityPeriods: TrendPeriod[] = [];

  // 1. Detect Sharp Increase Periods
  let naikStreakStart: CommoditySeriesPoint | null = null;
  let naikStreakLength = 0;
  let maxNaikRegionsInStreak = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const isNaik = pt.overallStatus === 'NAIK' || pt.naikPercentage >= 50;

    if (isNaik) {
      if (!naikStreakStart) {
        naikStreakStart = pt;
        naikStreakLength = 1;
        maxNaikRegionsInStreak = pt.naikCount;
      } else {
        naikStreakLength++;
        if (pt.naikCount > maxNaikRegionsInStreak) maxNaikRegionsInStreak = pt.naikCount;
      }
    }

    if ((!isNaik || i === points.length - 1) && naikStreakStart) {
      const endPt = isNaik ? pt : points[i - 1];
      const intensity = naikStreakLength >= 2 || maxNaikRegionsInStreak >= 7 ? 'Tinggi' : 'Sedang';

      sharpIncreasePeriods.push({
        type: 'SPIKE',
        startMonthId: naikStreakStart.monthId,
        startMonthLabel: naikStreakStart.monthLabel,
        endMonthId: endPt.monthId,
        endMonthLabel: endPt.monthLabel,
        durationMonths: naikStreakLength,
        description:
          naikStreakLength > 1
            ? `Tekanan lonjakan harga beruntun selama ${naikStreakLength} bulan (${naikStreakStart.monthLabel} - ${endPt.monthLabel}) dengan kenaikan di hingga ${maxNaikRegionsInStreak} wilayah.`
            : `Lonjakan harga tajam pada periode ${naikStreakStart.monthLabel} dengan kenaikan di ${maxNaikRegionsInStreak} Kabupaten/Kota.`,
        intensity,
        affectedRegionsCount: maxNaikRegionsInStreak,
      });

      naikStreakStart = null;
      naikStreakLength = 0;
    }
  }

  // 2. Detect Significant Drop Periods
  let turunStreakStart: CommoditySeriesPoint | null = null;
  let turunStreakLength = 0;
  let maxTurunRegionsInStreak = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const isTurun = pt.overallStatus === 'TURUN' || pt.turunPercentage >= 50;

    if (isTurun) {
      if (!turunStreakStart) {
        turunStreakStart = pt;
        turunStreakLength = 1;
        maxTurunRegionsInStreak = pt.turunCount;
      } else {
        turunStreakLength++;
        if (pt.turunCount > maxTurunRegionsInStreak) maxTurunRegionsInStreak = pt.turunCount;
      }
    }

    if ((!isTurun || i === points.length - 1) && turunStreakStart) {
      const endPt = isTurun ? pt : points[i - 1];
      const intensity = turunStreakLength >= 2 || maxTurunRegionsInStreak >= 7 ? 'Tinggi' : 'Sedang';

      significantDropPeriods.push({
        type: 'DROP',
        startMonthId: turunStreakStart.monthId,
        startMonthLabel: turunStreakStart.monthLabel,
        endMonthId: endPt.monthId,
        endMonthLabel: endPt.monthLabel,
        durationMonths: turunStreakLength,
        description:
          turunStreakLength > 1
            ? `Relaksasi harga / penurunan signifikan beruntun selama ${turunStreakLength} bulan (${turunStreakStart.monthLabel} - ${endPt.monthLabel}).`
            : `Penurunan harga signifikan pada ${turunStreakStart.monthLabel} didorong deflasi di ${maxTurunRegionsInStreak} wilayah.`,
        intensity,
        affectedRegionsCount: maxTurunRegionsInStreak,
      });

      turunStreakStart = null;
      turunStreakLength = 0;
    }
  }

  // 3. Detect Prolonged Stability Periods
  let stabilStreakStart: CommoditySeriesPoint | null = null;
  let stabilStreakLength = 0;
  let longestStableStreak = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const isStabil = pt.overallStatus === 'STABIL';

    if (isStabil) {
      if (!stabilStreakStart) {
        stabilStreakStart = pt;
        stabilStreakLength = 1;
      } else {
        stabilStreakLength++;
      }
      if (stabilStreakLength > longestStableStreak) {
        longestStableStreak = stabilStreakLength;
      }
    }

    if ((!isStabil || i === points.length - 1) && stabilStreakStart) {
      const endPt = isStabil ? pt : points[i - 1];
      if (stabilStreakLength >= 2) {
        prolongedStabilityPeriods.push({
          type: 'STABLE_STREAK',
          startMonthId: stabilStreakStart.monthId,
          startMonthLabel: stabilStreakStart.monthLabel,
          endMonthId: endPt.monthId,
          endMonthLabel: endPt.monthLabel,
          durationMonths: stabilStreakLength,
          description: `Kondisi stabilitas harga terjaga tanpa lonjakan selama ${stabilStreakLength} bulan berturut-turut (${stabilStreakStart.monthLabel} s/d ${endPt.monthLabel}).`,
          intensity: stabilStreakLength >= 4 ? 'Tinggi' : 'Sedang',
        });
      }

      stabilStreakStart = null;
      stabilStreakLength = 0;
    }
  }

  // 4. Determine Primary Pattern Classification
  let primaryPattern: TrendPatternType = 'STABIL_TERKENDALI';
  let patternLabel = 'Stabilitas Terkendali';
  let patternColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  if (summary.volatilityRate >= 60 || (summary.naikMonths >= 2 && summary.turunMonths >= 2)) {
    primaryPattern = 'FLUKTUATIF_SIKLIKAL';
    patternLabel = 'Fluktuatif Siklikal / Dinamis';
    patternColor = 'text-rose-700 bg-rose-50 border-rose-200';
  } else if (sharpIncreasePeriods.some((p) => p.durationMonths >= 2 || p.intensity === 'Tinggi') || summary.naikMonths > summary.turunMonths + 1) {
    primaryPattern = 'KENAIKAN_TAJAM';
    patternLabel = 'Terindikasi Kenaikan Tajam';
    patternColor = 'text-rose-800 bg-rose-100 border-rose-300';
  } else if (significantDropPeriods.some((p) => p.durationMonths >= 2) || summary.turunMonths > summary.naikMonths + 1) {
    primaryPattern = 'PENURUNAN_SIGNIFIKAN';
    patternLabel = 'Penurunan Signifikan / Mereda';
    patternColor = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (longestStableStreak >= 3 || summary.stabilityRate >= 75) {
    primaryPattern = 'STABILITAS_BERKEPANJANGAN';
    patternLabel = 'Stabilitas Berkepanjangan';
    patternColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  }

  // 5. Generate Human-Readable Narrative Summary
  const keyDrivers: string[] = [];
  let narrativeSummary = '';
  let recommendedAction = '';

  if (primaryPattern === 'FLUKTUATIF_SIKLIKAL') {
    narrativeSummary = `${summary.commodityName} menunjukkan pergerakan sangat dinamis dengan tingkat fluktuasi ${summary.volatilityRate}% (${summary.naikMonths}x periode kenaikan dan ${summary.turunMonths}x periode penurunan). Perubahan arah terjadi secara bolak-balik antar bulan.`;
    keyDrivers.push('Sensitivitas tinggi terhadap pasokan harian dan cuaca sentra produksi');
    keyDrivers.push('Dinamika distribusi antar pelabuhan dan sentra antar kabupaten');
    recommendedAction = 'Diperlukan intervensi operasi pasar berskala terarah dan koordinasi pasokan cepat saat terjadi indikasi kenaikan beruntun.';
  } else if (primaryPattern === 'KENAIKAN_TAJAM') {
    const spikeInfo = sharpIncreasePeriods[0]?.description || `Kenaikan terjadi selama ${summary.naikMonths} bulan pengamatan.`;
    narrativeSummary = `${summary.commodityName} mengalami fase tekanan harga ke atas yang kuat. ${spikeInfo} Pergerakan didominasi status NAIK di sebagian besar wilayah.`;
    keyDrivers.push('Tekanan permintaan musiman tinggi / momen HBKN');
    keyDrivers.push('Kendala logistik atau keterbatasan pasokan di tingkat distributor');
    recommendedAction = 'Prioritaskan pemantauan stok harian di pasar induk serta fasilitasi subsidi ongkos angkut antar daerah surplus-defisit.';
  } else if (primaryPattern === 'PENURUNAN_SIGNIFIKAN') {
    narrativeSummary = `${summary.commodityName} menunjukkan tren pelandaian harga yang nyata (${summary.turunMonths}x status TURUN). Pasokan tercatat melimpah atau daya serap pasar telah terpenuhi pasca periode puncak.`;
    keyDrivers.push('Memasuki panen raya atau peningkatan volume pasokan masuk');
    keyDrivers.push('Penyesuaian normalisasi pasca lonjakan musiman');
    recommendedAction = 'Jaga agar harga di tingkat produsen/petani tetap terlindungi dan tidak anjlok di bawah biaya pokok produksi.';
  } else if (primaryPattern === 'STABILITAS_BERKEPANJANGAN') {
    narrativeSummary = `${summary.commodityName} mencatat kestabilan harga yang sangat kuat dengan tingkat stabilitas ${summary.stabilityRate}% (${summary.stabilMonths} dari ${summary.totalMonths} bulan berstatus STABIL, rentang stabil terpanjang mencapai ${longestStableStreak} bulan).`;
    keyDrivers.push('Rantai pasok industri terstruktur dan stok cadangan pemerintah memadai');
    keyDrivers.push('Harga acuan pemerintah (HAP/HET) efektif ditaati pasar');
    recommendedAction = 'Pertahankan kelancaran distribusi reguler dan pantau ketersediaan stok fisik di gudang secara berkala.';
  } else {
    narrativeSummary = `${summary.commodityName} berada dalam rentang pergerakan yang wajar dan terkendali, dengan mayoritas periode berada pada level status STABIL (${summary.stabilityRate}%).`;
    keyDrivers.push('Keseimbangan suplai dan permintaan daerah terjaga baik');
    recommendedAction = 'Lakukan pengawasan rutin mingguan tanpa perlu intervensi khusus.';
  }

  return {
    commodityId: summary.commodityId,
    commodityName: summary.commodityName,
    category: summary.category,
    no: summary.no,
    primaryPattern,
    patternLabel,
    patternColor,
    sharpIncreasePeriods,
    significantDropPeriods,
    prolongedStabilityPeriods,
    longestStableStreak,
    longestNaikStreak: summary.maxConsecutiveNaik,
    longestTurunStreak: summary.maxConsecutiveTurun,
    stabilityRate: summary.stabilityRate,
    volatilityRate: summary.volatilityRate,
    narrativeSummary,
    keyDrivers,
    recommendedAction,
    series: points,
  };
}

export function analyzeAllCommodityTrends(
  datasets: MonthlyHarmonizationDataset[],
  selectedRegionId: string = 'all',
  priceLevel: PriceLevel | 'all' | string = 'all'
): CommodityTrendAnalysis[] {
  const summaries = computeAllCommoditySummaries(datasets, selectedRegionId, priceLevel);
  return summaries.map((s) => analyzeCommodityTrend(s));
}

export function exportHarmonizationToExcel(
  datasets: MonthlyHarmonizationDataset[],
  regions: RegionInfo[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Rekap Time Series
  const allSummaries = computeAllCommoditySummaries(datasets, 'all');
  const seriesRows = allSummaries.map((s) => {
    const row: Record<string, any> = {
      'No.': s.no,
      'Komoditas': s.commodityName,
      'Kategori': s.category,
      'Klasifikasi Fluktuasi': s.volatilityClassification,
      'Arah Tren': s.trendDirection,
      'Bulan Stabil': s.stabilMonths,
      'Bulan Naik': s.naikMonths,
      'Bulan Turun': s.turunMonths,
      'Tingkat Stabilitas (%)': `${s.stabilityRate}%`,
      'Tingkat Fluktuasi (%)': `${s.volatilityRate}%`,
    };

    s.series.forEach((pt) => {
      row[pt.monthLabel] = pt.overallStatus === 'KOSONG' ? '-' : pt.overallStatus;
    });

    return row;
  });

  const wsSeries = XLSX.utils.json_to_sheet(seriesRows);
  XLSX.utils.book_append_sheet(wb, wsSeries, 'Rekap Series Komoditas');

  // 2. Sheet per dataset / month
  datasets.forEach((dataset) => {
    const monthRows = dataset.commodities.map((comm) => {
      const row: Record<string, any> = {
        'No.': comm.no,
        'Komoditas': comm.name,
        'Kategori': comm.category,
        'Kalbar': comm.overallStatus === 'KOSONG' ? '-' : (comm.overallStatus || 'STABIL'),
      };

      regions.forEach((reg) => {
        const regData = comm.regions?.[reg.id];
        const st = regData?.status;
        row[reg.name] = (st === 'KOSONG' || st === '-') ? '-' : (st || 'STABIL');
      });

      row['Catatan'] = comm.catatan || comm.notes || '-';

      return row;
    });

    const wsMonth = XLSX.utils.json_to_sheet(monthRows);
    const sheetName = dataset.monthLabel.substring(0, 31); // Excel max 31 chars
    XLSX.utils.book_append_sheet(wb, wsMonth, sheetName);
  });

  // 3. Sheet: Harmonisasi 4 Level Harga (Dataset Terbaru)
  if (datasets.length > 0) {
    const latest = datasets[datasets.length - 1];
    const levelHarmonizations = computeAllPriceLevelHarmonizations(latest, regions);
    const levelRows = levelHarmonizations.map((lh) => ({
      'No.': lh.no,
      'Komoditas': lh.commodityName,
      'Kategori': lh.category,
      'Satuan': lh.unit || '-',
      'Status Produsen Perdesaan (HPG)': lh.produsenDesaOverall === 'KOSONG' ? '-' : lh.produsenDesaOverall,
      'Status Konsumen Perdesaan (HKD)': lh.konsumenDesaOverall === 'KOSONG' ? '-' : lh.konsumenDesaOverall,
      'Status Perdagangan Besar (HPB)': lh.perdaganganBesarOverall === 'KOSONG' ? '-' : lh.perdaganganBesarOverall,
      'Status Harga Konsumen (HK)': lh.konsumenOverall === 'KOSONG' ? '-' : lh.konsumenOverall,
      'Keselarasan 4 Level Rantai Pasok': lh.overallAlignmentLabel,
      'Tingkat Keselarasan (%)': `${lh.alignmentRate}%`,
      'Wilayah Aktif': `${lh.activeRegionsCount}/${regions.length}`,
      'Catatan Diagnostik Transmisi': lh.transmissionNarrative,
    }));
    const wsLevel = XLSX.utils.json_to_sheet(levelRows);
    XLSX.utils.book_append_sheet(wb, wsLevel, 'Harmonisasi 4 Level Harga');
  }

  const filename = `Rekap_Harmonisasi_4Level_Komoditas_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export type { ParsedWorkbookResult } from './excelParser';
export {
  detectMonthInfo,
  parseStatusValue,
  matchRegionHeader,
  parseExcelFile,
  downloadMonthlySingleSheetTemplate,
  downloadMonthly4SheetTemplate,
} from './excelParser';

export { downloadMonthly4SheetTemplate as downloadMonthly5SheetTemplate } from './excelParser';
