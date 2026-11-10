export type PriceStatus = 'STABIL' | 'NAIK' | 'TURUN' | 'KOSONG' | '-' | '0' | '';

export type PriceLevel = 
  | 'produsen_desa'      // 1. Harga Produsen Perdesaan (HPG / HPP)
  | 'konsumen_desa'      // 2. Harga Konsumen Perdesaan (HKD / HKP)
  | 'perdagangan_besar'  // 3. Harga Perdagangan Besar (HPB / Grosir)
  | 'konsumen'           // 4. Harga Konsumen (HK / Eceran Umum)
  | 'produsen'           // Alias for produsen_desa
  | 'grosir';            // Alias for perdagangan_besar

export interface RegionalHarmonization {
  status: PriceStatus;                 // Default / Konsumen / Eceran status
  produsenDesaStatus?: PriceStatus;    // 1. Harga Produsen Perdesaan (Petani / Peternak / HPG)
  konsumenDesaStatus?: PriceStatus;    // 2. Harga Konsumen Perdesaan (Warung / Pasar Desa / HKD)
  perdaganganBesarStatus?: PriceStatus;// 3. Harga Perdagangan Besar (Distributor / Pasar Induk / HPB)
  konsumenStatus?: PriceStatus;        // 4. Harga Konsumen (Eceran Perkotaan / HK)

  // Backwards compatibility aliases
  produsenStatus?: PriceStatus;        // Alias for produsenDesaStatus
  grosirStatus?: PriceStatus;          // Alias for perdaganganBesarStatus
  
  hasCommodity?: boolean;              // false jika kabupaten tidak memiliki komoditas ini
  hpg?: string | number;               // Harga Produsen Perdesaan (Perubahan / Index)
  hkd?: string | number;               // Harga Konsumen Perdesaan
  hpb?: string | number;               // Harga Perdagangan Besar
  hk?: string | number;                // Harga Konsumen
  catatan?: string;
  dynamicNotes?: string;               // Catatan dinamis harmonisasi wilayah
}

export interface CommodityRecord {
  id: string;
  no: number;
  name: string;
  category: CommodityCategory;
  unit?: string;
  catatan?: string;
  notes?: string;
  // Regional data keyed by regionId (e.g. 'sambas', 'bengkayang', etc.)
  regions: Record<string, RegionalHarmonization>;
  overallStatus?: PriceStatus;
  overallProdusenDesaStatus?: PriceStatus;     // 1. Harga Produsen Perdesaan
  overallKonsumenDesaStatus?: PriceStatus;     // 2. Harga Konsumen Perdesaan
  overallPerdaganganBesarStatus?: PriceStatus; // 3. Harga Perdagangan Besar
  overallKonsumenStatus?: PriceStatus;         // 4. Harga Konsumen

  // Backwards compatibility aliases
  overallProdusenStatus?: PriceStatus;
  overallGrosirStatus?: PriceStatus;
}

export type CommodityCategory = 
  | 'Pangan Pokok'
  | 'Bumbu & Hortikultura'
  | 'Daging & Unggas'
  | 'Ikan & Hasil Laut'
  | 'Bahan Olahan & Minyak'
  | 'Energi & Bahan Bakar'
  | 'Bahan Bangunan'
  | 'Rokok & Tembakau'
  | 'Lainnya / Jasa';

export interface RegionInfo {
  id: string;
  name: string;
  type: 'Kabupaten' | 'Kota';
  code: string;
}

export interface MonthlyHarmonizationDataset {
  id: string; // e.g. '2024-01'
  year: number;
  month: number; // 1-12
  monthLabel: string; // e.g. 'Januari 2024'
  notes?: string;
  filterNotes?: Record<string, string>; // Dynamic notes keyed by `${regionId}_${priceLevel}` or `${monthId}_${regionId}_${priceLevel}`
  regionalHarmonizationNotes?: Record<string, string>; // Dynamic notes keyed by `${commodityId}_${regionId}` for 4-level regional harmonization
  createdAt: string;
  updatedAt: string;
  commodities: CommodityRecord[];
}

export interface CommoditySeriesPoint {
  monthId: string;
  monthLabel: string;
  year: number;
  month: number;
  overallStatus: PriceStatus;
  score: number; // +1 for NAIK, 0 for STABIL, -1 for TURUN, null for KOSONG
  naikCount: number;
  turunCount: number;
  stabilCount: number;
  kosongCount: number;
  totalRegions: number;
  activeRegionsCount: number;
  naikPercentage: number;
  turunPercentage: number;
  stabilPercentage: number;
  regionalStatuses: Record<string, PriceStatus>;
  produsenDesaStatus?: PriceStatus;     // 1. Harga Produsen Perdesaan
  konsumenDesaStatus?: PriceStatus;     // 2. Harga Konsumen Perdesaan
  perdaganganBesarStatus?: PriceStatus; // 3. Harga Perdagangan Besar
  konsumenStatus?: PriceStatus;         // 4. Harga Konsumen
  produsenStatus?: PriceStatus;         // Alias
  grosirStatus?: PriceStatus;           // Alias
}

export interface CommoditySeriesSummary {
  commodityId: string;
  commodityName: string;
  category: CommodityCategory;
  no: number;
  totalMonths: number;
  stabilMonths: number;
  naikMonths: number;
  turunMonths: number;
  kosongMonths: number;
  stabilityRate: number; // 0 - 100%
  volatilityRate: number; // 0 - 100%
  volatilityClassification: 'SANGAT STABIL' | 'CENDERUNG STABIL' | 'FLUKTUATIF' | 'SANGAT BERGEJOLAK';
  trendDirection: 'STABIL' | 'TREN MENAIK' | 'TREN MENURUN' | 'FLUKTUATIF / TIDAK MENENTU';
  currentStreak: {
    status: PriceStatus;
    count: number;
  };
  maxConsecutiveNaik: number;
  maxConsecutiveTurun: number;
  averageActiveRegions: number;
  series: CommoditySeriesPoint[];
}

export type LevelAlignmentType =
  | 'SELARAS_NAIK'
  | 'SELARAS_TURUN'
  | 'SELARAS_STABIL'
  | 'LAG_TRANSMISI'
  | 'DISPARITAS_DESA_KOTA'
  | 'ASIMETRI_MARGIN'
  | 'MARGIN_TERTEKAN'
  | 'NON_PRODUSEN'
  | 'NIHIL'
  | 'BERVARIASI';

export interface RegionalLevelRecord {
  regionId: string;
  regionName: string;
  produsenDesa: PriceStatus;       // 1. Harga Produsen Perdesaan
  konsumenDesa: PriceStatus;       // 2. Harga Konsumen Perdesaan
  perdaganganBesar: PriceStatus;   // 3. Harga Perdagangan Besar
  konsumen: PriceStatus;           // 4. Harga Konsumen
  produsen?: PriceStatus;          // Compat alias
  grosir?: PriceStatus;            // Compat alias
  hasCommodity: boolean;
  alignment: LevelAlignmentType;
  alignmentLabel: string;
  alignmentDescription: string;
  transmissionNote?: string;
}

export interface CommodityPriceLevelHarmonization {
  commodityId: string;
  commodityName: string;
  no: number;
  category: CommodityCategory;
  unit?: string;
  produsenDesaOverall: PriceStatus;       // 1. Harga Produsen Perdesaan
  konsumenDesaOverall: PriceStatus;       // 2. Harga Konsumen Perdesaan
  perdaganganBesarOverall: PriceStatus;   // 3. Harga Perdagangan Besar
  konsumenOverall: PriceStatus;           // 4. Harga Konsumen
  produsenOverall?: PriceStatus;          // Compat alias
  grosirOverall?: PriceStatus;            // Compat alias
  overallAlignment: LevelAlignmentType;
  overallAlignmentLabel: string;
  overallAlignmentBadge: {
    bg: string;
    text: string;
    border: string;
  };
  regionalBreakdown: RegionalLevelRecord[];
  activeRegionsCount: number;
  alignedCount: number;
  nonProducingCount: number;
  emptyCount: number;
  alignmentRate: number; // % kabupaten dengan transmisi selaras
  disparityWarning?: string;
  transmissionNarrative: string;
}

export type TrendPatternType =
  | 'KENAIKAN_TAJAM'
  | 'PENURUNAN_SIGNIFIKAN'
  | 'STABILITAS_BERKEPANJANGAN'
  | 'FLUKTUATIF_SIKLIKAL'
  | 'STABIL_TERKENDALI';

export interface TrendPeriod {
  type: 'SPIKE' | 'DROP' | 'STABLE_STREAK';
  startMonthId: string;
  startMonthLabel: string;
  endMonthId: string;
  endMonthLabel: string;
  durationMonths: number;
  description: string;
  intensity: 'Tinggi' | 'Sedang' | 'Rendah';
  affectedRegionsCount?: number;
  affectedRegionsPct?: number;
}

export interface CommodityTrendAnalysis {
  commodityId: string;
  commodityName: string;
  category: CommodityCategory;
  no: number;
  primaryPattern: TrendPatternType;
  patternLabel: string;
  patternColor: string;
  sharpIncreasePeriods: TrendPeriod[];
  significantDropPeriods: TrendPeriod[];
  prolongedStabilityPeriods: TrendPeriod[];
  longestStableStreak: number;
  longestNaikStreak: number;
  longestTurunStreak: number;
  stabilityRate: number;
  volatilityRate: number;
  narrativeSummary: string;
  keyDrivers: string[];
  recommendedAction: string;
  series: CommoditySeriesPoint[];
}

export interface VolatilityFilterOptions {
  search: string;
  category: string;
  volatilityType: 'all' | 'fluktuasi_terbesar' | 'kenaikan_tajam' | 'penurunan_signifikan' | 'stabilitas_berkepanjangan' | 'tren_naik' | 'tren_turun';
  selectedRegion: string; // 'all' or regionId
  sortBy?: 'fluktuasi_desc' | 'stabilitas_desc' | 'no_asc' | 'name_asc';
}
