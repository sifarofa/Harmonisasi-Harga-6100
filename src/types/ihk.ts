export interface IhkRegionInfo {
  id: string; // e.g. 'tidur6106'
  code: string; // e.g. '6106'
  name: string; // e.g. 'Kabupaten Ketapang'
  shortName: string; // e.g. 'Ketapang'
  sheetName: string; // e.g. 'tidur6106'
  type: 'Kabupaten' | 'Kota';
}

export type IhkStatus = 'NAIK' | 'TURUN' | 'STABIL';

export interface IhkCommodityItem {
  no: number;
  code: string; // e.g. '0111001'
  name: string; // e.g. 'BERAS'
  category: string; // e.g. 'Padi-padian & Tepung'
  monthlyValues: Record<string, number>; // key: "YYYY-MM" (e.g. "2024-01" -> 137.49)
  unit?: string;
  notes?: string;
}

export interface IhkRegionDataset {
  regionId: string;
  sheetName: string;
  regionName: string;
  regionCode: string;
  items: IhkCommodityItem[];
}

export interface IhkMonthOption {
  id: string; // "YYYY-MM"
  label: string; // "Januari 2024" or "Januari '24"
  shortLabel: string; // "Jan '24"
  year: number;
  month: number;
}

export interface IhkCompleteDataset {
  availableMonths: IhkMonthOption[];
  regions: Record<string, IhkRegionDataset>; // key: regionId e.g. 'tidur6106'
  lastUpdated: string;
  version?: string;
}

export interface IhkRegionalDetail {
  regionId: string;
  regionName: string;
  sheetName: string;
  startValue: number;
  endValue: number;
  pointDiff: number;
  percentDiff: number;
  status: IhkStatus | 'NIHIL';
  isMonitored?: boolean;
}

export interface IhkComparisonResult {
  no: number;
  code: string;
  name: string;
  category: string;
  startValue: number;
  endValue: number;
  pointDiff: number; // endValue - startValue
  percentDiff: number; // ((endValue - startValue) / startValue) * 100
  status: IhkStatus;
  monthlyHistory: {
    monthId: string;
    monthLabel: string;
    value: number;
    regionalValues?: Record<string, number>;
  }[];
  regionalBreakdown?: Record<string, IhkRegionalDetail>;
  kalbarNaikCount?: number;
  kalbarTurunCount?: number;
  kalbarStabilCount?: number;
  kalbarActiveRegions?: number;
}

export const IHK_REGIONS: IhkRegionInfo[] = [
  {
    id: 'tidur6106',
    code: '6106',
    name: 'Kabupaten Ketapang',
    shortName: 'Ketapang',
    sheetName: 'tidur6106',
    type: 'Kabupaten',
  },
  {
    id: 'tidur6107',
    code: '6107',
    name: 'Kabupaten Sintang',
    shortName: 'Sintang',
    sheetName: 'tidur6107',
    type: 'Kabupaten',
  },
  {
    id: 'tidur6111',
    code: '6111',
    name: 'Kabupaten Kayong Utara',
    shortName: 'Kayong Utara',
    sheetName: 'tidur6111',
    type: 'Kabupaten',
  },
  {
    id: 'tidur6171',
    code: '6171',
    name: 'Kota Pontianak',
    shortName: 'Pontianak',
    sheetName: 'tidur6171',
    type: 'Kota',
  },
  {
    id: 'tidur6172',
    code: '6172',
    name: 'Kota Singkawang',
    shortName: 'Singkawang',
    sheetName: 'tidur6172',
    type: 'Kota',
  },
];
