import { RegionInfo } from './index';

export type HpbsQuestionnaireType = 'V-HPBS.1' | 'V-HPBS.2';

export interface HpbsRespondentRecord {
  id: string;
  kodeKabKota?: string; // e.g. "6101" (BPS Kab/Kota code)
  kabKotaId: string;
  kabKotaName: string;
  kodeResponden?: string; // e.g. "6101004" (BPS Responden code)
  responden: string;
  kodeKomoditas: string;
  komoditas: string;
  kodeKualitas: string;
  kualitas: string;
  satuanStandar: string;
  kuesioner: HpbsQuestionnaireType;
  m1Prev: number; // M1 (N-1)
  m2Prev: number; // M2 (N-1)
  m1Curr: number; // M1 (N)
  m2Curr: number; // M2 (N)
  rhM1: number; // RH (M1) = (M1_N / M1_N-1) * 100
  rhM2: number; // RH (M2) = (M2_N / M2_N-1) * 100 (for V-HPBS.2)
  catatanM1?: string;
  catatanM2?: string;
  geoPrev: number; // Rata2 Geo Harga N-1
  geoCurr: number; // Rata2 Geo Harga N
  rh: number; // RH = (geoCurr / geoPrev) * 100
  status: 'NAIK' | 'TURUN' | 'STABIL';
  // Adjustment tracking
  isAdjusted?: boolean;
  adjustedAt?: string;
  adjustmentNote?: string;
  originalPrices?: {
    m1Prev: number;
    m2Prev: number;
    m1Curr: number;
    m2Curr: number;
    geoPrev: number;
    geoCurr: number;
    rh: number;
    status: 'NAIK' | 'TURUN' | 'STABIL';
  };
}

export interface HpbsRegionalCommodityAggregation {
  kabKotaId: string;
  kabKotaName: string;
  kodeKomoditas: string;
  komoditas: string;
  kuesioner: HpbsQuestionnaireType;
  respondentCount: number;
  geoPrev: number;
  geoCurr: number;
  rh: number;
  status: 'NAIK' | 'TURUN' | 'STABIL';
  percentChange: number;
  respondents: HpbsRespondentRecord[];
}

export interface HpbsCommodityAggregation {
  kodeKomoditas: string;
  komoditas: string;
  kategori?: string;
  satuanStandar: string;
  kuesioner: HpbsQuestionnaireType;
  totalRespondents: number;
  monitoredRegionsCount: number; // Berapa kab/kota dari 14
  kalbarGeoPrev: number; // Rata2 Geometri se-Kalbar N-1
  kalbarGeoCurr: number; // Rata2 Geometri se-Kalbar N
  kalbarRh: number; // RH se-Kalbar
  status: 'NAIK' | 'TURUN' | 'STABIL';
  percentChange: number; // kalbarRh - 100
  regionalData: Record<string, HpbsRegionalCommodityAggregation>; // key: kabKotaId
  highestRegion?: { kabKotaName: string; rh: number };
  lowestRegion?: { kabKotaName: string; rh: number };
  catatan?: string; // Catatan gabungan / analisis untuk komoditas ini
  customNote?: string; // Catatan kustom dari analis nerwilis/distribusi
  respondentNotes?: { note: string; regName?: string; responden?: string }[]; // Rangkuman catatan dari responden pedagang
}

export interface HpbsMonthlyPeriod {
  id: string; // e.g. '2026-08'
  label: string; // e.g. 'Agustus 2026'
  shortLabel: string; // e.g. 'Ags 26'
  comparisonLabel: string; // e.g. 'Ags '26 vs Jul '26'
  records: HpbsRespondentRecord[];
  commodityNotes?: Record<string, string>;
  lastUpdated?: string;
}

export interface HpbsDataset {
  periodTitle: string; // e.g. "Agustus 2026 vs Juli 2026"
  records: HpbsRespondentRecord[]; // Currently active period records
  periods?: HpbsMonthlyPeriod[]; // Complete monthly routine series
  activePeriodId?: string; // Currently selected period ID
  commodityNotes?: Record<string, string>; // key: kodeKomoditas -> catatan analisis
  lastUpdated: string;
  version?: string;
}

export type StabilityLevel = 'SANGAT_STABIL' | 'MODERAT' | 'FLUKTUATIF';

export interface CommodityMonthlyPoint {
  periodId: string;
  periodLabel: string;
  shortLabel: string;
  rh: number;
  status: 'NAIK' | 'TURUN' | 'STABIL';
  geoPrev: number;
  geoCurr: number;
}

export interface CommodityStabilityAnalysis {
  kodeKomoditas: string;
  komoditas: string;
  kuesioner: HpbsQuestionnaireType;
  satuanStandar: string;
  scopeType: 'kalbar' | 'regional';
  regionId?: string;
  regionName?: string;
  series: CommodityMonthlyPoint[]; // chronological order
  averageRh: number;
  minRh: number;
  maxRh: number;
  volatility: number; // average absolute deviation from 100 (|RH - 100|)
  stabilityLevel: StabilityLevel;
  stableMonthsCount: number; // count where 99.5 <= RH <= 100.5
  changedRhCount: number; // Berapa kali ada RH yang mengalami perubahan (nilai RH !== 100)
  changedRhPercentage: number; // Persentase periode survei di mana RH !== 100
  upRhCount: number; // Frekuensi periode di mana RH > 100 (harga naik)
  downRhCount: number; // Frekuensi periode di mana RH < 100 (harga turun)
  totalMonths: number;
  trend: 'STABIL' | 'CENDERUNG_NAIK' | 'CENDERUNG_TURUN';
}

