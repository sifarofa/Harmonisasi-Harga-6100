import {
  CommodityCategory,
  CommodityRecord,
  MonthlyHarmonizationDataset,
  PriceStatus,
  RegionalHarmonization,
} from '../types';
import { IhkCompleteDataset, IhkRegionDataset, IhkCommodityItem } from '../types/ihk';
import { HpbsDataset, HpbsRespondentRecord } from '../types/hpbs';
import { generatePeriodsFromRecords } from '../data/initialHpbsData';
import { filterValidHpbsRecords } from './hpbsAnalysis';

/**
 * Enterprise Schema Migration & Validation Engine
 * 
 * Provides strict backward-compatibility and zero-data-loss upgrades across application versions.
 * If reading legacy records, missing properties or renamed schema attributes, this module
 * automatically infers, backfills, and normalizes them with safe default values.
 */

const VALID_CATEGORIES: CommodityCategory[] = [
  'Pangan Pokok',
  'Bumbu & Hortikultura',
  'Daging & Unggas',
  'Ikan & Hasil Laut',
  'Bahan Olahan & Minyak',
  'Energi & Bahan Bakar',
  'Bahan Bangunan',
  'Rokok & Tembakau',
  'Lainnya / Jasa',
];

/**
 * Normalizes and validates a single RegionalHarmonization record
 */
export function migrateRegionalHarmonization(raw: any): RegionalHarmonization {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'STABIL',
      produsenDesaStatus: 'STABIL',
      konsumenDesaStatus: 'STABIL',
      perdaganganBesarStatus: 'STABIL',
      konsumenStatus: 'STABIL',
      hasCommodity: true,
      catatan: '',
      dynamicNotes: '',
    };
  }

  const normStatus = (s: any, fallback: PriceStatus = 'STABIL'): PriceStatus => {
    if (s === 'NAIK' || s === 'TURUN' || s === 'STABIL' || s === 'KOSONG') return s;
    if (s === '-' || s === '0' || s === '') return 'KOSONG';
    return fallback;
  };

  const status = normStatus(raw.status || raw.konsumenStatus, 'STABIL');
  const produsenDesaStatus = normStatus(raw.produsenDesaStatus || raw.produsenStatus, status);
  const konsumenDesaStatus = normStatus(raw.konsumenDesaStatus, status);
  const perdaganganBesarStatus = normStatus(raw.perdaganganBesarStatus || raw.grosirStatus, status);
  const konsumenStatus = normStatus(raw.konsumenStatus || raw.status, status);

  const hasCommodity =
    typeof raw.hasCommodity === 'boolean'
      ? raw.hasCommodity
      : status !== 'KOSONG' || produsenDesaStatus !== 'KOSONG';

  const catatan = typeof raw.catatan === 'string' ? raw.catatan : '';
  const dynamicNotes = typeof raw.dynamicNotes === 'string' ? raw.dynamicNotes : catatan;

  return {
    status,
    produsenDesaStatus,
    konsumenDesaStatus,
    perdaganganBesarStatus,
    konsumenStatus,
    // Aliases for legacy UI code
    produsenStatus: produsenDesaStatus,
    grosirStatus: perdaganganBesarStatus,
    hasCommodity,
    hpg: raw.hpg ?? '',
    hkd: raw.hkd ?? '',
    hpb: raw.hpb ?? '',
    hk: raw.hk ?? '',
    catatan,
    dynamicNotes,
  };
}

/**
 * Migrates and normalizes a CommodityRecord
 */
export function migrateCommodityRecord(raw: any, fallbackIndex: number = 1): CommodityRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `c_${fallbackIndex}`,
      no: fallbackIndex,
      name: `Komoditas ${fallbackIndex}`,
      category: 'Lainnya / Jasa',
      regions: {},
    };
  }

  const id = String(raw.id || raw.commodityId || `c_${fallbackIndex}`);
  const no = typeof raw.no === 'number' && !isNaN(raw.no) ? raw.no : fallbackIndex;
  const name = typeof raw.name === 'string' ? raw.name.trim() : `Komoditas ${no}`;
  
  const category: CommodityCategory = VALID_CATEGORIES.includes(raw.category)
    ? raw.category
    : 'Lainnya / Jasa';

  const rawRegions = raw.regions && typeof raw.regions === 'object' ? raw.regions : {};
  const migratedRegions: Record<string, RegionalHarmonization> = {};

  Object.entries(rawRegions).forEach(([regId, regVal]) => {
    migratedRegions[regId] = migrateRegionalHarmonization(regVal);
  });

  return {
    id,
    no,
    name,
    category,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    catatan: typeof raw.catatan === 'string' ? raw.catatan : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    regions: migratedRegions,
    overallStatus: raw.overallStatus,
    overallProdusenDesaStatus: raw.overallProdusenDesaStatus || raw.overallProdusenStatus,
    overallKonsumenDesaStatus: raw.overallKonsumenDesaStatus,
    overallPerdaganganBesarStatus: raw.overallPerdaganganBesarStatus || raw.overallGrosirStatus,
    overallKonsumenStatus: raw.overallKonsumenStatus || raw.overallStatus,
    overallProdusenStatus: raw.overallProdusenDesaStatus || raw.overallProdusenStatus,
    overallGrosirStatus: raw.overallPerdaganganBesarStatus || raw.overallGrosirStatus,
  };
}

/**
 * Migrates an entire array of MonthlyHarmonizationDataset
 */
export function migrateHarmonizationDatasets(rawList: any): MonthlyHarmonizationDataset[] {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [];
  }

  return rawList
    .filter((d) => d && typeof d === 'object')
    .map((rawDataset, idx) => {
      const year = typeof rawDataset.year === 'number' ? rawDataset.year : 2026;
      const month = typeof rawDataset.month === 'number' ? rawDataset.month : 1;
      const id = String(rawDataset.id || `${year}-${String(month).padStart(2, '0')}`);
      const monthLabel =
        typeof rawDataset.monthLabel === 'string' && rawDataset.monthLabel.trim().length > 0
          ? rawDataset.monthLabel
          : id;

      const rawCommodities = Array.isArray(rawDataset.commodities) ? rawDataset.commodities : [];
      const migratedCommodities = rawCommodities.map((c: any, cIdx: number) =>
        migrateCommodityRecord(c, cIdx + 1)
      );

      // Backfill and preserve dynamic regional notes
      const regionalNotes: Record<string, string> = {
        ...(rawDataset.regionalHarmonizationNotes || {}),
      };

      // Extract notes embedded in commodity regional records if missing from top-level map
      migratedCommodities.forEach((c) => {
        Object.entries(c.regions || {}).forEach(([regId, rVal]: [string, any]) => {
          const key = `${c.id}_${regId}`;
          if (!regionalNotes[key]) {
            const note = rVal?.dynamicNotes || rVal?.catatan;
            if (note && typeof note === 'string' && note.trim().length > 0) {
              regionalNotes[key] = note.trim();
            }
          }
        });
      });

      return {
        id,
        year,
        month,
        monthLabel,
        notes: rawDataset.notes || '',
        filterNotes: rawDataset.filterNotes || {},
        regionalHarmonizationNotes: regionalNotes,
        createdAt: rawDataset.createdAt || new Date().toISOString(),
        updatedAt: rawDataset.updatedAt || new Date().toISOString(),
        commodities: migratedCommodities,
      };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
}

/**
 * Migrates an IhkCompleteDataset
 */
export function migrateIhkDataset(raw: any): IhkCompleteDataset {
  if (!raw || typeof raw !== 'object' || !raw.regions) {
    return {
      availableMonths: [],
      regions: {},
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  const rawRegions = raw.regions || {};
  const migratedRegions: Record<string, IhkRegionDataset> = {};

  Object.entries(rawRegions).forEach(([regKey, regVal]: [string, any]) => {
    if (regVal && typeof regVal === 'object') {
      const items: IhkCommodityItem[] = Array.isArray(regVal.items)
        ? regVal.items.map((item: any, idx: number) => ({
            no: typeof item.no === 'number' ? item.no : idx + 1,
            code: String(item.code || ''),
            name: String(item.name || '').trim(),
            category: String(item.category || 'Umum'),
            monthlyValues: item.monthlyValues && typeof item.monthlyValues === 'object' ? item.monthlyValues : {},
            unit: item.unit ? String(item.unit) : undefined,
            notes: item.notes ? String(item.notes) : undefined,
          }))
        : [];

      migratedRegions[regKey] = {
        regionId: String(regVal.regionId || regKey),
        sheetName: String(regVal.sheetName || regKey),
        regionName: String(regVal.regionName || regKey),
        regionCode: String(regVal.regionCode || ''),
        items,
      };
    }
  });

  const availableMonths = Array.isArray(raw.availableMonths)
    ? raw.availableMonths.map((m: any) => ({
        id: String(m.id || ''),
        label: String(m.label || m.id || ''),
        shortLabel: String(m.shortLabel || m.label || ''),
        year: typeof m.year === 'number' ? m.year : 2026,
        month: typeof m.month === 'number' ? m.month : 1,
      }))
    : [];

  return {
    availableMonths,
    regions: migratedRegions,
    lastUpdated: raw.lastUpdated || new Date().toISOString(),
    version: raw.version || '1.5.0',
  };
}

/**
 * Migrates and validates an HpbsDataset
 */
export function migrateHpbsDataset(raw: any): HpbsDataset {
  if (!raw || typeof raw !== 'object') {
    return {
      periodTitle: 'September 2026 vs Bulan Sebelumnya',
      records: [],
      activePeriodId: '2026-09',
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  const cleanRecords: HpbsRespondentRecord[] = filterValidHpbsRecords(raw.records || []);
  const activePeriodId = String(raw.activePeriodId || '2026-09');
  
  let periods = raw.periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    periods = generatePeriodsFromRecords(cleanRecords, activePeriodId);
  } else {
    periods = periods.map((p: any) => ({
      ...p,
      records: filterValidHpbsRecords(p.records || []),
    }));
  }

  return {
    periodTitle: String(raw.periodTitle || 'September 2026 vs Bulan Sebelumnya'),
    records: cleanRecords,
    activePeriodId,
    periods,
    commodityNotes: raw.commodityNotes && typeof raw.commodityNotes === 'object' ? raw.commodityNotes : {},
    lastUpdated: raw.lastUpdated || new Date().toISOString(),
    version: typeof raw.version === 'string' ? raw.version : String(raw.version || '1.0.0'),
  };
}
