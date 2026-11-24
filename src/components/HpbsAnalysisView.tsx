import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Grid3X3,
  HelpCircle,
  History,
  Layers,
  LayoutGrid,
  MessageSquare,
  Minus,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { DEFAULT_REGIONS } from '../data/initialData';
import { generatePeriodsFromRecords, HPBS_MONTHLY_PERIODS_DEF } from '../data/initialHpbsData';
import {
  HpbsCommodityAggregation,
  HpbsDataset,
  HpbsMonthlyPeriod,
  HpbsQuestionnaireType,
  HpbsRespondentRecord,
} from '../types/hpbs';
import {
  adjustRespondentPrice,
  aggregateHpbsData,
  downloadHpbsTemplateExcel,
  exportHpbsAnalysisToExcel,
  exportHpbsMatriksToExcel,
  exportHpbsRespondenToExcel,
  filterValidHpbsRecords,
  resetRespondentPrice,
} from '../utils/hpbsAnalysis';
import { HpbsDataManagementModal } from './HpbsDataManagementModal';
import { HpbsImportModal } from './HpbsImportModal';
import { HpbsPriceAdjustmentModal } from './HpbsPriceAdjustmentModal';
import { HpbsStabilitySeriesView } from './HpbsStabilitySeriesView';
import { DataPaginationBar, QuickViewOption } from './DataPaginationBar';

interface HpbsAnalysisViewProps {
  dataset: HpbsDataset;
  onUpdateDataset: (dataset: HpbsDataset) => void;
  onResetDataset: () => void;
  isOwner?: boolean;
  onRequireOwner?: (actionName: string, cb: () => void) => void;
  activeSubTab?: SubTab;
  onSelectSubTab?: (subTab: SubTab) => void;
}

type SubTab = 'agregat_kalbar' | 'matriks_wilayah' | 'responden_detail' | 'series_stabilitas';

export const HpbsAnalysisView: React.FC<HpbsAnalysisViewProps> = ({
  dataset,
  onUpdateDataset,
  onResetDataset,
  isOwner = false,
  onRequireOwner,
  activeSubTab: externalSubTab,
  onSelectSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('agregat_kalbar');
  const activeSubTab = externalSubTab ?? internalSubTab;
  const setActiveSubTab = (sub: SubTab) => {
    if (onSelectSubTab) {
      onSelectSubTab(sub);
    }
    setInternalSubTab(sub);
  };
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<
    'all' | HpbsQuestionnaireType
  >('all');
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'NAIK' | 'TURUN' | 'STABIL' | 'EKSTREM' | 'EKSTREM_NAIK' | 'EKSTREM_TURUN'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isDataManagementModalOpen, setIsDataManagementModalOpen] = useState<boolean>(false);
  const [dataManagementMode, setDataManagementMode] = useState<
    'manage_months' | 'add_month' | 'import' | 'export'
  >('manage_months');
  const [detailCommodityCode, setDetailCommodityCode] = useState<string | null>(null);

  // Sorting state for Agregat Kalbar table
  const [agregatSortCol, setAgregatSortCol] = useState<string>('no');
  const [agregatSortDir, setAgregatSortDir] = useState<'asc' | 'desc'>('asc');

  const handleAgregatSort = (col: string) => {
    if (agregatSortCol === col) {
      setAgregatSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setAgregatSortCol(col);
      setAgregatSortDir('asc');
    }
  };

  // Sorting state for Detail Responden table
  const [recordsSortCol, setRecordsSortCol] = useState<string>('rh');
  const [recordsSortDir, setRecordsSortDir] = useState<'asc' | 'desc'>('desc');

  const handleRecordsSort = (col: string) => {
    if (recordsSortCol === col) {
      setRecordsSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setRecordsSortCol(col);
      setRecordsSortDir(col === 'rh' || col === 'm1Curr' || col === 'm2Curr' ? 'desc' : 'asc');
    }
  };

  // State for Commodity Note Modal (Agregat Se-Kalbar)
  const [editingCommodityNote, setEditingCommodityNote] = useState<HpbsCommodityAggregation | null>(null);
  const [noteInputText, setNoteInputText] = useState<string>('');

  const handleOpenNoteModal = (item: HpbsCommodityAggregation) => {
    setEditingCommodityNote(item);
    setNoteInputText(item.customNote || item.catatan || '');
  };

  const handleSaveCommodityNote = () => {
    if (!editingCommodityNote) return;
    const trimmed = noteInputText.trim();
    const nextNotes = { ...(dataset.commodityNotes || {}) };
    if (trimmed) {
      nextNotes[editingCommodityNote.kodeKomoditas] = trimmed;
    } else {
      delete nextNotes[editingCommodityNote.kodeKomoditas];
    }
    onUpdateDataset({
      ...dataset,
      commodityNotes: nextNotes,
    });
    setEditingCommodityNote(null);
    setAdjustmentToast(`✓ Catatan untuk komoditas ${editingCommodityNote.komoditas} berhasil disimpan!`);
    setTimeout(() => setAdjustmentToast(null), 3500);
  };

  const handleClearCommodityNote = () => {
    if (!editingCommodityNote) return;
    const nextNotes = { ...(dataset.commodityNotes || {}) };
    delete nextNotes[editingCommodityNote.kodeKomoditas];
    onUpdateDataset({
      ...dataset,
      commodityNotes: nextNotes,
    });
    setEditingCommodityNote(null);
    setAdjustmentToast(`✓ Catatan kustom komoditas ${editingCommodityNote.komoditas} telah dihapus.`);
    setTimeout(() => setAdjustmentToast(null), 3500);
  };

  // Pagination & Filter View States
  const [agregatPage, setAgregatPage] = useState<number>(1);
  const [agregatPageSize, setAgregatPageSize] = useState<number | 'all'>(25);
  const [agregatQuickView, setAgregatQuickView] = useState<string>('all');

  const [matriksPage, setMatriksPage] = useState<number>(1);
  const [matriksPageSize, setMatriksPageSize] = useState<number | 'all'>(25);

  const [recordsPage, setRecordsPage] = useState<number>(1);
  const [recordsPageSize, setRecordsPageSize] = useState<number | 'all'>(50);
  const [recordsQuickView, setRecordsQuickView] = useState<string>('all');

  // State for Price Adjustment Modal
  const [adjustingRecord, setAdjustingRecord] = useState<HpbsRespondentRecord | null>(null);
  const [adjustmentToast, setAdjustmentToast] = useState<string | null>(null);

  // Clean records: remove invalid, empty rows, or zero-price commodities (e.g. "KOMODITAS LAINNYA")
  const cleanRecords = useMemo(() => {
    return filterValidHpbsRecords(dataset.records);
  }, [dataset.records]);

  // Compute aggregations including custom notes
  const aggregations = useMemo(() => {
    return aggregateHpbsData(cleanRecords, dataset.commodityNotes);
  }, [cleanRecords, dataset.commodityNotes]);

  // Filtered Agregat Komoditas
  const filteredAggregations = useMemo(() => {
    return aggregations.filter((item) => {
      // Questionnaire filter
      if (selectedQuestionnaire !== 'all' && item.kuesioner !== selectedQuestionnaire) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'NAIK' && item.status !== 'NAIK') return false;
      if (selectedStatus === 'TURUN' && item.status !== 'TURUN') return false;
      if (selectedStatus === 'STABIL' && item.status !== 'STABIL') return false;
      if (selectedStatus === 'EKSTREM' && Math.abs(item.kalbarRh - 100) <= 3) return false;
      if (selectedStatus === 'EKSTREM_NAIK' && (item.kalbarRh - 100) <= 3) return false;
      if (selectedStatus === 'EKSTREM_TURUN' && (100 - item.kalbarRh) <= 3) return false;

      // Region filter (check if commodity is monitored in that region)
      if (selectedRegionId !== 'all' && !item.regionalData[selectedRegionId]) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.komoditas.toLowerCase().includes(q);
        const matchCode = item.kodeKomoditas.toLowerCase().includes(q);
        const matchNote = item.catatan ? item.catatan.toLowerCase().includes(q) : false;
        return matchName || matchCode || matchNote;
      }
      return true;
    });
  }, [aggregations, selectedQuestionnaire, selectedStatus, selectedRegionId, searchQuery]);

  // Quick View Filter for Agregat Komoditas
  const quickFilteredAggregations = useMemo(() => {
    if (agregatQuickView === 'all') return filteredAggregations;
    if (agregatQuickView === 'NAIK') return filteredAggregations.filter((a) => a.status === 'NAIK');
    if (agregatQuickView === 'TURUN') return filteredAggregations.filter((a) => a.status === 'TURUN');
    if (agregatQuickView === 'STABIL') return filteredAggregations.filter((a) => a.status === 'STABIL');
    if (agregatQuickView === 'EKSTREM') {
      return filteredAggregations.filter((a) => Math.abs(a.kalbarRh - 100) > 3);
    }
    if (agregatQuickView === 'with_notes') {
      return filteredAggregations.filter((a) => !!a.catatan);
    }
    return filteredAggregations;
  }, [filteredAggregations, agregatQuickView]);

  const agregatQuickViews: QuickViewOption[] = useMemo(() => [
    { id: 'all', label: 'Semua', count: filteredAggregations.length },
    {
      id: 'EKSTREM',
      label: '⚡ Fluktuasi Ekstrem (> 3%)',
      count: filteredAggregations.filter((a) => Math.abs(a.kalbarRh - 100) > 3).length,
    },
    { id: 'NAIK', label: 'Naik (RH>100)', count: filteredAggregations.filter((a) => a.status === 'NAIK').length },
    { id: 'TURUN', label: 'Turun (RH<100)', count: filteredAggregations.filter((a) => a.status === 'TURUN').length },
    { id: 'STABIL', label: 'Stabil (RH=100)', count: filteredAggregations.filter((a) => a.status === 'STABIL').length },
    {
      id: 'with_notes',
      label: 'Ada Catatan',
      count: filteredAggregations.filter((a) => !!a.catatan).length,
    },
  ], [filteredAggregations]);

  // Sorting logic for Agregat Komoditas
  const sortedAggregations = useMemo(() => {
    if (agregatSortCol === 'no') return quickFilteredAggregations;
    const mult = agregatSortDir === 'asc' ? 1 : -1;
    return [...quickFilteredAggregations].sort((a, b) => {
      switch (agregatSortCol) {
        case 'komoditas':
          return mult * a.komoditas.localeCompare(b.komoditas);
        case 'kode':
          return mult * a.kodeKomoditas.localeCompare(b.kodeKomoditas);
        case 'kuesioner':
          return mult * a.kuesioner.localeCompare(b.kuesioner);
        case 'satuan':
          return mult * a.satuanStandar.localeCompare(b.satuanStandar);
        case 'prev':
          return mult * (a.kalbarGeoPrev - b.kalbarGeoPrev);
        case 'curr':
          return mult * (a.kalbarGeoCurr - b.kalbarGeoCurr);
        case 'rh':
          return mult * (a.kalbarRh - b.kalbarRh);
        case 'change':
          return mult * (a.percentChange - b.percentChange);
        case 'status':
          return mult * a.status.localeCompare(b.status);
        case 'catatan':
          return mult * (a.catatan || '').localeCompare(b.catatan || '');
        default:
          return 0;
      }
    });
  }, [quickFilteredAggregations, agregatSortCol, agregatSortDir]);

  const paginatedAggregations = useMemo(() => {
    if (agregatPageSize === 'all') return sortedAggregations;
    const start = (agregatPage - 1) * Number(agregatPageSize);
    return sortedAggregations.slice(start, start + Number(agregatPageSize));
  }, [sortedAggregations, agregatPage, agregatPageSize]);

  // Matriks Wilayah Pagination
  const paginatedMatriksAggregations = useMemo(() => {
    if (matriksPageSize === 'all') return filteredAggregations;
    const start = (matriksPage - 1) * Number(matriksPageSize);
    return filteredAggregations.slice(start, start + Number(matriksPageSize));
  }, [filteredAggregations, matriksPage, matriksPageSize]);

  // Filtered Raw Records (Responden Detail)
  const filteredRecords = useMemo(() => {
    return cleanRecords.filter((rec) => {
      if (selectedRegionId !== 'all' && rec.kabKotaId !== selectedRegionId) {
        return false;
      }
      if (selectedQuestionnaire !== 'all' && rec.kuesioner !== selectedQuestionnaire) {
        return false;
      }
      // Status & Ekstrem filter
      if (selectedStatus === 'NAIK' && rec.status !== 'NAIK') return false;
      if (selectedStatus === 'TURUN' && rec.status !== 'TURUN') return false;
      if (selectedStatus === 'STABIL' && rec.status !== 'STABIL') return false;
      if (selectedStatus === 'EKSTREM' && Math.abs(rec.rh - 100) <= 3) return false;
      if (selectedStatus === 'EKSTREM_NAIK' && (rec.rh - 100) <= 3) return false;
      if (selectedStatus === 'EKSTREM_TURUN' && (100 - rec.rh) <= 3) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.komoditas.toLowerCase().includes(q) ||
          rec.responden.toLowerCase().includes(q) ||
          rec.kualitas.toLowerCase().includes(q) ||
          rec.kodeKomoditas.toLowerCase().includes(q) ||
          rec.kabKotaName.toLowerCase().includes(q) ||
          (rec.catatanM1 && rec.catatanM1.toLowerCase().includes(q)) ||
          (rec.catatanM2 && rec.catatanM2.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [cleanRecords, selectedRegionId, selectedQuestionnaire, selectedStatus, searchQuery]);

  // Quick View Filter for Raw Records (Responden Detail)
  const quickFilteredRecords = useMemo(() => {
    if (recordsQuickView === 'all') return filteredRecords;
    if (recordsQuickView === 'extreme') {
      return filteredRecords.filter((r) => Math.abs(r.rh - 100) > 3);
    }
    if (recordsQuickView === 'extreme_up') {
      return filteredRecords.filter((r) => (r.rh - 100) > 3);
    }
    if (recordsQuickView === 'extreme_down') {
      return filteredRecords.filter((r) => (100 - r.rh) > 3);
    }
    if (recordsQuickView === 'changed') return filteredRecords.filter((r) => r.status !== 'STABIL');
    if (recordsQuickView === 'stable') return filteredRecords.filter((r) => r.status === 'STABIL');
    if (recordsQuickView === 'with_notes') {
      return filteredRecords.filter(
        (r) =>
          (r.catatanM1 && r.catatanM1.trim() !== '') ||
          (r.catatanM2 && r.catatanM2.trim() !== '') ||
          (r.adjustmentNote && r.adjustmentNote.trim() !== '')
      );
    }
    if (recordsQuickView === 'adjusted') return filteredRecords.filter((r) => r.isAdjusted);
    return filteredRecords;
  }, [filteredRecords, recordsQuickView]);

  const recordsQuickViews: QuickViewOption[] = useMemo(() => [
    { id: 'all', label: 'Semua Baris', count: filteredRecords.length },
    {
      id: 'extreme',
      label: '⚡ RH Ekstrim (|Δ| > 3%)',
      count: filteredRecords.filter((r) => Math.abs(r.rh - 100) > 3).length,
    },
    {
      id: 'extreme_up',
      label: '▲ Naik > 3%',
      count: filteredRecords.filter((r) => (r.rh - 100) > 3).length,
    },
    {
      id: 'extreme_down',
      label: '▼ Turun > 3%',
      count: filteredRecords.filter((r) => (100 - r.rh) > 3).length,
    },
    { id: 'changed', label: 'Ada Perubahan (RH≠100)', count: filteredRecords.filter((r) => r.status !== 'STABIL').length },
    { id: 'stable', label: 'Harga Tetap (RH=100)', count: filteredRecords.filter((r) => r.status === 'STABIL').length },
    {
      id: 'with_notes',
      label: 'Ada Catatan Petugas',
      count: filteredRecords.filter(
        (r) =>
          (r.catatanM1 && r.catatanM1.trim() !== '') ||
          (r.catatanM2 && r.catatanM2.trim() !== '') ||
          (r.adjustmentNote && r.adjustmentNote.trim() !== '')
      ).length,
    },
    { id: 'adjusted', label: 'Disesuaikan Manual', count: filteredRecords.filter((r) => r.isAdjusted).length },
  ], [filteredRecords]);

  // Sorting logic for Detail Responden table
  const sortedRecords = useMemo(() => {
    if (recordsSortCol === 'no') return quickFilteredRecords;
    const mult = recordsSortDir === 'asc' ? 1 : -1;
    return [...quickFilteredRecords].sort((a, b) => {
      switch (recordsSortCol) {
        case 'responden':
          return mult * a.responden.localeCompare(b.responden);
        case 'kabKota':
          return mult * a.kabKotaName.localeCompare(b.kabKotaName);
        case 'kodeKomoditas':
          return mult * a.kodeKomoditas.localeCompare(b.kodeKomoditas);
        case 'komoditas':
          return mult * a.komoditas.localeCompare(b.komoditas);
        case 'kualitas':
          return mult * a.kualitas.localeCompare(b.kualitas);
        case 'satuan':
          return mult * a.satuanStandar.localeCompare(b.satuanStandar);
        case 'kuesioner':
          return mult * a.kuesioner.localeCompare(b.kuesioner);
        case 'm1Prev':
          return mult * (a.m1Prev - b.m1Prev);
        case 'm2Prev':
          return mult * (a.m2Prev - b.m2Prev);
        case 'm1Curr':
          return mult * (a.m1Curr - b.m1Curr);
        case 'm2Curr':
          return mult * (a.m2Curr - b.m2Curr);
        case 'rhM1':
          return mult * (a.rhM1 - b.rhM1);
        case 'rhM2':
          return mult * (a.rhM2 - b.rhM2);
        case 'geoPrev':
          return mult * (a.geoPrev - b.geoPrev);
        case 'geoCurr':
          return mult * (a.geoCurr - b.geoCurr);
        case 'rh':
          return mult * (a.rh - b.rh);
        case 'status':
          return mult * a.status.localeCompare(b.status);
        case 'catatan': {
          const noteA = a.catatanM1 || a.catatanM2 || a.adjustmentNote || '';
          const noteB = b.catatanM1 || b.catatanM2 || b.adjustmentNote || '';
          return mult * noteA.localeCompare(noteB);
        }
        default:
          return 0;
      }
    });
  }, [quickFilteredRecords, recordsSortCol, recordsSortDir]);

  const paginatedRecords = useMemo(() => {
    if (recordsPageSize === 'all') return sortedRecords;
    const start = (recordsPage - 1) * Number(recordsPageSize);
    return sortedRecords.slice(start, start + Number(recordsPageSize));
  }, [sortedRecords, recordsPage, recordsPageSize]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalComm = aggregations.length;
    const countNaik = aggregations.filter((a) => a.status === 'NAIK').length;
    const countTurun = aggregations.filter((a) => a.status === 'TURUN').length;
    const countStabil = aggregations.filter((a) => a.status === 'STABIL').length;

    // Geometric mean of all commodity RH for Kalbar
    const validRhs = aggregations.map((a) => a.kalbarRh).filter((v) => v > 0);
    const avgRh =
      validRhs.length > 0
        ? validRhs.reduce((acc, v) => acc + v, 0) / validRhs.length
        : 100;

    return {
      totalRespondents: cleanRecords.length,
      totalCommodities: totalComm,
      countNaik,
      countTurun,
      countStabil,
      pctNaik: totalComm > 0 ? ((countNaik / totalComm) * 100).toFixed(1) : '0',
      pctTurun: totalComm > 0 ? ((countTurun / totalComm) * 100).toFixed(1) : '0',
      pctStabil: totalComm > 0 ? ((countStabil / totalComm) * 100).toFixed(1) : '0',
      avgRh: avgRh.toFixed(2),
      overallStatus: avgRh > 100.005 ? 'NAIK' : avgRh < 99.995 ? 'TURUN' : 'STABIL',
    };
  }, [aggregations, cleanRecords]);

  // Selected commodity for detail modal
  const selectedDetailCommodity = useMemo(() => {
    if (!detailCommodityCode) return null;
    return aggregations.find((a) => a.kodeKomoditas === detailCommodityCode) || null;
  }, [aggregations, detailCommodityCode]);

  // Ensure periods are always present even if legacy dataset is loaded
  const effectivePeriods = useMemo(() => {
    if (dataset.periods && dataset.periods.length > 0) {
      return dataset.periods;
    }
    return generatePeriodsFromRecords(cleanRecords, dataset.activePeriodId || '2026-09');
  }, [dataset.periods, cleanRecords, dataset.activePeriodId]);

  const handleImportSuccess = (
    rawIncomingRecords: HpbsRespondentRecord[],
    detectedPeriodTitle?: string,
    mode: 'replace_all' | 'append' = 'replace_all',
    customPeriodId?: string,
    customPeriodLabel?: string
  ) => {
    const newRecords = filterValidHpbsRecords(rawIncomingRecords);
    const targetId = customPeriodId || dataset.activePeriodId || '2026-09';
    const targetLabel = customPeriodLabel || detectedPeriodTitle || 'Data Mandiri';
    const targetShort = targetLabel.length > 8 ? targetLabel.slice(0, 8) : targetLabel;
    const targetComp = detectedPeriodTitle
      ? `${detectedPeriodTitle} vs Bulan Sebelumnya`
      : dataset.periodTitle || 'Bulan Berjalan vs Lalu';

    const newOrUpdatedPeriod: HpbsMonthlyPeriod = {
      id: targetId,
      label: targetLabel,
      shortLabel: targetShort,
      comparisonLabel: targetComp,
      records: newRecords,
      lastUpdated: new Date().toISOString(),
    };

    if (mode === 'replace_all') {
      // GANTI SELURUH DATASET: Hapus data default bawaan
      onUpdateDataset({
        periodTitle: targetComp,
        records: newRecords,
        activePeriodId: targetId,
        periods: [newOrUpdatedPeriod],
        lastUpdated: new Date().toISOString(),
        version: '2.1.0',
      });

      setAdjustmentToast(
        `✓ Seluruh data bawaan telah dihapus! Dataset kini sepenuhnya menggunakan ${newRecords.length} data dari file Anda.`
      );
    } else {
      // TAMBAHKAN KE DATASET / PERBARUI BULAN INI
      const basePeriods =
        dataset.periods && dataset.periods.length > 0
          ? dataset.periods
          : generatePeriodsFromRecords(newRecords, targetId);

      const existingIndex = basePeriods.findIndex((p) => p.id === targetId);
      let updatedPeriods: HpbsMonthlyPeriod[];
      if (existingIndex >= 0) {
        updatedPeriods = basePeriods.map((p, idx) =>
          idx === existingIndex ? newOrUpdatedPeriod : p
        );
      } else {
        updatedPeriods = [...basePeriods, newOrUpdatedPeriod].sort((a, b) =>
          a.id.localeCompare(b.id)
        );
      }

      onUpdateDataset({
        ...dataset,
        periodTitle: targetComp,
        records: newRecords,
        activePeriodId: targetId,
        periods: updatedPeriods,
        lastUpdated: new Date().toISOString(),
      });

      setAdjustmentToast(
        `✓ Berhasil menambahkan ${newRecords.length} data pedagang ke database SHPB!`
      );
    }

    setTimeout(() => setAdjustmentToast(null), 4500);
  };

  // Switch active monthly period
  const handlePeriodChange = (periodId: string) => {
    const targetPeriod = effectivePeriods.find((p) => p.id === periodId);
    if (!targetPeriod) return;

    onUpdateDataset({
      ...dataset,
      periodTitle: targetPeriod.comparisonLabel,
      activePeriodId: targetPeriod.id,
      records: targetPeriod.records,
      periods: effectivePeriods,
      lastUpdated: new Date().toISOString(),
    });
    setAdjustmentToast(`Beralih ke periode survei rutin: ${targetPeriod.label}`);
    setTimeout(() => setAdjustmentToast(null), 3500);
  };

  // Export Matriks 14 Kab/Kota to Excel
  const handleExportMatriks = (filteredOnly: boolean = false) => {
    const dataToExport = filteredOnly ? filteredAggregations : aggregations;
    if (dataToExport.length === 0) {
      setAdjustmentToast('Tidak ada data komoditas matriks untuk diekspor.');
      setTimeout(() => setAdjustmentToast(null), 3000);
      return;
    }

    const currentPeriod = effectivePeriods.find((p) => p.id === dataset.activePeriodId);
    const periodTitle = currentPeriod ? currentPeriod.label : dataset.periodTitle || 'HPBS Kalbar';

    exportHpbsMatriksToExcel(dataToExport, {
      periodTitle,
      filterQuery: searchQuery || undefined,
      selectedRegionName:
        selectedRegionId !== 'all'
          ? DEFAULT_REGIONS.find((r) => r.id === selectedRegionId)?.name
          : undefined,
      selectedStatus: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    });

    setAdjustmentToast(
      `✓ Berhasil mengekspor Matriks 14 Kab/Kota (${dataToExport.length} komoditas) ke Excel!`
    );
    setTimeout(() => setAdjustmentToast(null), 4000);
  };

  // Export Data Rinci Responden Pedagang to Excel (.xlsx)
  const handleExportResponden = (filteredOnly: boolean = false) => {
    const dataToExport = filteredOnly ? quickFilteredRecords : cleanRecords;
    if (dataToExport.length === 0) {
      setAdjustmentToast('Tidak ada data responden untuk diekspor.');
      setTimeout(() => setAdjustmentToast(null), 3000);
      return;
    }

    const currentPeriod = effectivePeriods.find((p) => p.id === dataset.activePeriodId);
    const periodTitle = currentPeriod ? currentPeriod.label : dataset.periodTitle || 'HPBS Kalbar';

    const selectedRegionObj = selectedRegionId !== 'all' ? DEFAULT_REGIONS.find((r) => r.id === selectedRegionId) : undefined;
    const regionName = filteredOnly && selectedRegionObj ? selectedRegionObj.name : 'Semua Kab/Kota (Se-Kalbar)';

    const filterParts: string[] = [];
    if (filteredOnly) {
      if (selectedRegionObj) filterParts.push(`Wilayah: ${selectedRegionObj.name}`);
      if (searchQuery.trim()) filterParts.push(`Pencarian: "${searchQuery}"`);
      if (selectedQuestionnaire !== 'ALL') filterParts.push(`Kuesioner: ${selectedQuestionnaire}`);
      if (selectedStatus !== 'ALL') filterParts.push(`Status: ${selectedStatus}`);
      if (recordsQuickView !== 'all') {
        const qView = recordsQuickViews.find((v) => v.id === recordsQuickView);
        if (qView) filterParts.push(`Kategori: ${qView.label}`);
      }
    }

    exportHpbsRespondenToExcel(dataToExport, {
      periodTitle,
      selectedRegionName: regionName,
      filterDescription: filterParts.length > 0 ? filterParts.join(' | ') : 'Semua Data Pencacahan',
    });

    setAdjustmentToast(
      `✓ Berhasil mengekspor data responden (${dataToExport.length} baris pencacahan) ke Excel!`
    );
    setTimeout(() => setAdjustmentToast(null), 4000);
  };

  // Handle price adjustment on a respondent record
  const handleSaveAdjustment = (
    recordId: string,
    adjustedData: {
      m1Prev: number;
      m2Prev: number;
      m1Curr: number;
      m2Curr: number;
      adjustmentNote: string;
    }
  ) => {
    const target = dataset.records.find((r) => r.id === recordId);
    if (!target) return;

    const updatedRecord = adjustRespondentPrice(target, adjustedData);
    const newRecords = dataset.records.map((r) => (r.id === recordId ? updatedRecord : r));

    // Also update within dataset.periods if available
    const activeId = dataset.activePeriodId || '2026-09';
    const updatedPeriods = dataset.periods
      ? dataset.periods.map((p) => {
          if (p.id === activeId) {
            return {
              ...p,
              records: p.records.map((r) => (r.id === recordId ? updatedRecord : r)),
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        })
      : undefined;

    onUpdateDataset({
      ...dataset,
      records: newRecords,
      periods: updatedPeriods,
      lastUpdated: new Date().toISOString(),
    });

    setAdjustmentToast(
      `Harga responden ${target.responden} berhasil di-adjust! RH otomatis terhitung: ${updatedRecord.rh.toFixed(2)} (${updatedRecord.status})`
    );
    setTimeout(() => setAdjustmentToast(null), 4500);
  };

  // Revert adjusted respondent price back to original
  const handleResetAdjustment = (recordId: string) => {
    const target = dataset.records.find((r) => r.id === recordId);
    if (!target) return;

    const restoredRecord = resetRespondentPrice(target);
    const newRecords = dataset.records.map((r) => (r.id === recordId ? restoredRecord : r));

    const activeId = dataset.activePeriodId || '2026-09';
    const updatedPeriods = dataset.periods
      ? dataset.periods.map((p) => {
          if (p.id === activeId) {
            return {
              ...p,
              records: p.records.map((r) => (r.id === recordId ? restoredRecord : r)),
              lastUpdated: new Date().toISOString(),
            };
          }
          return p;
        })
      : undefined;

    onUpdateDataset({
      ...dataset,
      records: newRecords,
      periods: updatedPeriods,
      lastUpdated: new Date().toISOString(),
    });

    setAdjustmentToast(`Harga responden ${target.responden} dikembalikan ke nilai awal.`);
    setTimeout(() => setAdjustmentToast(null), 3500);
  };

  const handleResetClick = () => {
    if (onRequireOwner) {
      onRequireOwner('Reset Data Standar HPBS', onResetDataset);
    } else {
      onResetDataset();
    }
  };

  const formatRupiah = (val: number) => {
    if (!val || val === 0) return 'Rp 0';
    return `Rp ${val.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Analisis RH Komoditas HPB
            </h1>

            {/* Routine Survey Period Switcher */}
            {effectivePeriods && effectivePeriods.length > 0 && (
              <div className="mt-2.5 inline-flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/90 rounded-xl px-3 py-1.5 shadow-2xs">
                <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-xs font-bold text-emerald-950">Periode Survei:</span>
                <select
                  id="select-routine-period"
                  value={dataset.activePeriodId || '2026-09'}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="text-xs font-extrabold bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                >
                  {effectivePeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} &bull; {p.comparisonLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Live Toast Message for Adjustments & Period Switching */}
        {adjustmentToast && (
          <div className="mt-3 bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between text-xs animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{adjustmentToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setAdjustmentToast(null)}
              className="text-white/70 hover:text-white ml-3 p-1 rounded hover:bg-emerald-700/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Rata-rata RH Kalbar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Indeks RH Kalbar</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-800">{stats.avgRh}</span>
            <span className="text-[11px] text-slate-400 font-medium">poin</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
            {stats.overallStatus === 'NAIK' ? (
              <span className="text-rose-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> Tren Naik
              </span>
            ) : stats.overallStatus === 'TURUN' ? (
              <span className="text-blue-600 flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" /> Tren Turun
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-0.5">
                <Minus className="w-3.5 h-3.5" /> Stabil
              </span>
            )}
          </div>
        </div>

        {/* Komoditas Naik */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Komoditas Naik</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-rose-600">{stats.countNaik}</span>
            <span className="text-[11px] text-slate-400 font-medium">komoditas</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-600 font-bold">
            {stats.pctNaik}%
          </div>
        </div>

        {/* Komoditas Turun */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Komoditas Turun</span>
            <TrendingDown className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-blue-600">{stats.countTurun}</span>
            <span className="text-[11px] text-slate-400 font-medium">komoditas</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600 font-bold">
            {stats.pctTurun}%
          </div>
        </div>

        {/* Komoditas Stabil */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Komoditas Stabil</span>
            <Minus className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-800">{stats.countStabil}</span>
            <span className="text-[11px] text-slate-400 font-medium">komoditas</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-bold">
            {stats.pctStabil}%
          </div>
        </div>

        {/* Total Komoditas Terpantau */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Total Komoditas</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-800">{stats.totalCommodities}</span>
            <span className="text-[11px] text-slate-400 font-medium">item</span>
          </div>
        </div>

        {/* Total Responden Pedagang */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Titik Pantau</span>
            <Store className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-800">{stats.totalRespondents}</span>
            <span className="text-[11px] text-slate-400 font-medium">pedagang</span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher & Filter Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        {/* Active Sub-Menu Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Sub-Menu:</span>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-bold shadow-2xs">
              {activeSubTab === 'agregat_kalbar' && (
                <>
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>Agregat Se-Kalimantan Barat</span>
                </>
              )}
              {activeSubTab === 'matriks_wilayah' && (
                <>
                  <LayoutGrid className="w-4 h-4 text-blue-600" />
                  <span>Matriks 14 Kab/Kota</span>
                </>
              )}
              {activeSubTab === 'responden_detail' && (
                <>
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Detail Responden & Perbaikan</span>
                </>
              )}
              {activeSubTab === 'series_stabilitas' && (
                <>
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Series Bulanan & Stabilitas RH</span>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            {activeSubTab === 'series_stabilitas' ? (
              <span>Time-series rutin bulanan</span>
            ) : (
              <>
                Menampilkan{' '}
                <span className="font-bold text-slate-700">
                  {activeSubTab === 'responden_detail'
                    ? filteredRecords.length
                    : filteredAggregations.length}
                </span>{' '}
                data
              </>
            )}
          </div>
        </div>

        {/* Filter Controls Row (Hidden when on series_stabilitas because it has dedicated controls) */}
        {activeSubTab !== 'series_stabilitas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAgregatPage(1);
                setMatriksPage(1);
                setRecordsPage(1);
              }}
              placeholder="Cari komoditas / nama toko / kualitas..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAgregatPage(1);
                  setMatriksPage(1);
                  setRecordsPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Wilayah */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Wilayah:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => {
                setSelectedRegionId(e.target.value);
                setAgregatPage(1);
                setMatriksPage(1);
                setRecordsPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="all">Semua 14 Kab/Kota (Agregat Kalbar)</option>
              {DEFAULT_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kuesioner */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Kuesioner:</span>
            <select
              value={selectedQuestionnaire}
              onChange={(e) => {
                setSelectedQuestionnaire(e.target.value as any);
                setAgregatPage(1);
                setMatriksPage(1);
                setRecordsPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="all">Semua Kuesioner (V-HPBS.1 & V-HPBS.2)</option>
              <option value="V-HPBS.1">V-HPBS.1 (Bulanan / 1x Cacah)</option>
              <option value="V-HPBS.2">V-HPBS.2 (Mingguan / 2x Cacah)</option>
            </select>
          </div>

          {/* Filter Status RH */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Status RH:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setAgregatPage(1);
                setMatriksPage(1);
                setRecordsPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="all">Semua Status (Naik, Turun, Stabil)</option>
              <option value="EKSTREM">⚡ RH Ekstrim (Naik / Turun &gt; 3%)</option>
              <option value="EKSTREM_NAIK">▲ Naik Ekstrim (&gt; 3%)</option>
              <option value="EKSTREM_TURUN">▼ Turun Ekstrim (&gt; 3%)</option>
              <option value="NAIK">▲ Naik (RH &gt; 100)</option>
              <option value="TURUN">▼ Turun (RH &lt; 100)</option>
              <option value="STABIL">● Stabil (RH = 100)</option>
            </select>
          </div>
        </div>
        )}
      </div>

      {/* 4. Sub-Tab Content Views */}

      {/* VIEW A: AGREGAT SE-KALIMANTAN BARAT (PER KOMODITAS) */}
      {activeSubTab === 'agregat_kalbar' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Tabel Agregat Relatif Harga Kalimantan Barat per Komoditas
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Rata-rata Geometri Gabungan Seluruh Kab/Kota
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th
                    onClick={() => handleAgregatSort('no')}
                    className="py-3 px-3 w-12 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan No"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>No</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'no' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('komoditas')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Nama Komoditas"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Kode & Nama Komoditas</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'komoditas' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('kuesioner')}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Tipe Kuesioner"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Kuesioner</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'kuesioner' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('satuan')}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Satuan Standar"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Satuan</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'satuan' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('prev')}
                    className="py-3 px-3 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Rata-rata Geometri Bulan Lalu (N-1)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rata2 Geo (N-1)</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'prev' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('curr')}
                    className="py-3 px-3 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Rata-rata Geometri Bulan Berjalan (N)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rata2 Geo (N)</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'curr' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('rh')}
                    className="py-3 px-3 text-right font-black text-emerald-950 cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Relatif Harga Kalbar"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RH Kalbar</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'rh' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('change')}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Persentase Perubahan Harga"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Perubahan (%)</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'change' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('status')}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors"
                    title="Urutkan Status (Naik, Turun, Stabil)"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'status' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th
                    onClick={() => handleAgregatSort('catatan')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors min-w-[200px]"
                    title="Urutkan Catatan Analisis / Lapangan"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Catatan</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          agregatSortCol === 'catatan' ? 'text-emerald-700 font-black' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quickFilteredAggregations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      Tidak ada data komoditas yang sesuai filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedAggregations.map((item, idx) => {
                    const isNaik = item.status === 'NAIK';
                    const isTurun = item.status === 'TURUN';
                    const rowNumber =
                      (agregatPageSize === 'all' ? 0 : (agregatPage - 1) * Number(agregatPageSize)) +
                      idx +
                      1;

                    return (
                      <tr
                        key={item.kodeKomoditas}
                        onClick={() => setDetailCommodityCode(item.kodeKomoditas)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                            {item.komoditas}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.kodeKomoditas}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.kuesioner === 'V-HPBS.2'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200/80'
                                : 'bg-blue-100 text-blue-800 border border-blue-200/80'
                            }`}
                          >
                            {item.kuesioner}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-600">
                          {item.satuanStandar}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                          {formatRupiah(item.kalbarGeoPrev)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-800">
                          {formatRupiah(item.kalbarGeoCurr)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-sm">
                          <span
                            className={`${
                              isNaik
                                ? 'text-rose-600'
                                : isTurun
                                ? 'text-blue-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {item.kalbarRh.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span
                            className={`${
                              isNaik
                                ? 'text-rose-600'
                                : isTurun
                                ? 'text-blue-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {item.percentChange > 0 ? '+' : ''}
                            {item.percentChange.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isNaik ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                              <ArrowUpRight className="w-3 h-3" /> Naik
                            </span>
                          ) : isTurun ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                              <ArrowDownRight className="w-3 h-3" /> Turun
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                              <Minus className="w-3 h-3 text-slate-400" /> Stabil
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 px-3 text-xs max-w-[260px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNoteModal(item);
                          }}
                        >
                          {item.catatan ? (
                            <div className="flex items-start gap-1.5 group/note">
                              {item.customNote ? (
                                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Analis
                                </span>
                              ) : (
                                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <span
                                className="text-slate-700 text-[11px] line-clamp-2 leading-relaxed hover:text-emerald-700 transition-colors"
                                title={item.catatan}
                              >
                                {item.catatan}
                              </span>
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-600 rounded transition-opacity shrink-0 ml-auto cursor-pointer"
                                title="Edit catatan komoditas"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-300 group-hover:text-emerald-600 transition-colors">
                              <span className="text-[11px] group-hover:hidden">-</span>
                              <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700">
                                <Plus className="w-3 h-3" /> Catatan
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailCommodityCode(item.kodeKomoditas);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat rincian 14 Kab/Kota"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination and View Filter Controls */}
          <DataPaginationBar
            currentPage={agregatPage}
            totalItems={quickFilteredAggregations.length}
            pageSize={agregatPageSize}
            onPageChange={setAgregatPage}
            onPageSizeChange={setAgregatPageSize}
            pageSizeOptions={[15, 25, 50, 100, 'all']}
            itemLabel="komoditas"
            quickViews={agregatQuickViews}
            activeQuickView={agregatQuickView}
            onQuickViewChange={(viewId) => {
              setAgregatQuickView(viewId);
              setAgregatPage(1);
            }}
          />
        </div>
      )}

      {/* VIEW B: MATRIKS PERBANDINGAN 14 KAB/KOTA */}
      {activeSubTab === 'matriks_wilayah' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-emerald-600" />
                Matriks Perbandingan Relatif Harga (RH) di 14 Kabupaten / Kota
              </h3>
              <p className="text-xs text-slate-500">
                Nilai &gt; 100 menunjukkan kenaikan harga pedagang, nilai &lt; 100 menunjukkan penurunan harga.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <span className="flex items-center gap-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  Naik
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Turun
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                  Stabil
                </span>
              </div>

              {/* Tombol Ekspor Excel Matriks */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExportMatriks(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Ekspor seluruh data matriks komoditas 14 Kab/Kota beserta sheet harga & statistik ke Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Ekspor Excel Matriks</span>
                </button>
                {filteredAggregations.length !== aggregations.length && (
                  <button
                    type="button"
                    onClick={() => handleExportMatriks(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title={`Ekspor hanya ${filteredAggregations.length} komoditas yang sesuai filter pencarian/status saat ini`}
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>Filter ({filteredAggregations.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-3 sticky left-0 bg-slate-100 z-10 w-48 border-r border-slate-200">
                    Komoditas
                  </th>
                  <th className="py-3 px-2.5 text-center bg-emerald-50 text-emerald-900 border-r border-emerald-200 font-black">
                    Agregat Kalbar
                  </th>
                  {DEFAULT_REGIONS.map((r) => (
                    <th key={r.id} className="py-3 px-2 text-center whitespace-nowrap min-w-[70px]">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMatriksAggregations.map((item) => {
                  return (
                    <tr
                      key={item.kodeKomoditas}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{item.komoditas}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.kuesioner} • {item.satuanStandar}
                        </div>
                      </td>
                      {/* Kalbar Agregat */}
                      <td className="py-2.5 px-2.5 text-center font-mono font-black bg-emerald-50/40 border-r border-emerald-100">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            item.status === 'NAIK'
                              ? 'bg-rose-100 text-rose-800 font-bold'
                              : item.status === 'TURUN'
                              ? 'bg-blue-100 text-blue-800 font-bold'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.kalbarRh.toFixed(2)}
                        </span>
                      </td>

                      {/* 14 Regions */}
                      {DEFAULT_REGIONS.map((r) => {
                        const reg = item.regionalData[r.id];
                        if (!reg) {
                          return (
                            <td key={r.id} className="py-2.5 px-2 text-center text-slate-300">
                              -
                            </td>
                          );
                        }

                        const isNaik = reg.status === 'NAIK';
                        const isTurun = reg.status === 'TURUN';

                        return (
                          <td key={r.id} className="py-2.5 px-2 text-center font-mono">
                            <span
                              title={`${r.name}: RH ${reg.rh} (${reg.status}, ${reg.respondentCount} pedagang)`}
                              className={`px-1.5 py-0.5 rounded text-[11px] transition-all ${
                                isNaik
                                  ? 'bg-rose-50 text-rose-700 font-bold'
                                  : isTurun
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : 'text-slate-600'
                              }`}
                            >
                              {reg.rh.toFixed(1)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matriks Pagination */}
          <DataPaginationBar
            currentPage={matriksPage}
            totalItems={filteredAggregations.length}
            pageSize={matriksPageSize}
            onPageChange={setMatriksPage}
            onPageSizeChange={setMatriksPageSize}
            pageSizeOptions={[15, 25, 50, 100, 'all']}
            itemLabel="komoditas"
          />

          {/* Matriks Action Bar & Export Footer */}
          <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] sm:text-xs">
                File Excel mencakup <strong>3 Lembar Kerja (Sheets)</strong>: Matriks RH 14 Wilayah, Level Harga Pedagang (N-1 vs N), dan Ringkasan Statistik Daerah.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExportMatriks(false)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh Excel Matriks (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW C: DETAIL RESPONDEN (DATA MENTAH PERSIS SEPERTI FORMAT V-HPBS DI IMAGE) */}
      {activeSubTab === 'responden_detail' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Data Rinci Responden Pedagang (Format Kuesioner V-HPBS)
              </h3>
              <p className="text-xs text-slate-500">
                Memuat data harga M1/M2 bulan sebelumnya (N-1), bulan berjalan (N), rata-rata geometri, dan catatan perubahan harga.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium hidden md:inline">
                Total <strong className="text-slate-800">{quickFilteredRecords.length}</strong> baris data pencacahan
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-export-responden-all"
                  onClick={() => handleExportResponden(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Ekspor seluruh data pencacahan responden pedagang ke file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Ekspor Excel Responden</span>
                </button>
                {quickFilteredRecords.length !== cleanRecords.length && (
                  <button
                    type="button"
                    id="btn-export-responden-filtered"
                    onClick={() => handleExportResponden(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title={`Ekspor hanya ${quickFilteredRecords.length} baris data pencacahan yang sesuai filter saat ini`}
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>Filter ({quickFilteredRecords.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Views & Top Pagination */}
          <DataPaginationBar
            currentPage={recordsPage}
            totalItems={quickFilteredRecords.length}
            pageSize={recordsPageSize}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
            pageSizeOptions={[25, 50, 100, 250, 'all']}
            itemLabel="baris pencacahan"
            quickViews={recordsQuickViews}
            activeQuickView={recordsQuickView}
            onQuickViewChange={(viewId) => {
              setRecordsQuickView(viewId);
              setRecordsPage(1);
            }}
          />

          {/* Active Extreme Filter Banner */}
          {recordsQuickView.startsWith('extreme') && (
            <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Filter RH Ekstrim Aktif:</strong> Menampilkan{' '}
                  <span className="font-bold underline">{quickFilteredRecords.length}</span> responden
                  dengan fluktuasi Relatif Harga {recordsQuickView === 'extreme_up' ? 'naik > 3%' : recordsQuickView === 'extreme_down' ? 'turun > 3%' : 'ekstrim (naik / turun lebih dari 3%)'}.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecordsQuickView('all');
                  setRecordsPage(1);
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-amber-100/60 border border-amber-300 rounded-lg text-amber-800 transition-colors cursor-pointer shrink-0"
              >
                Reset Filter
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th
                    onClick={() => handleRecordsSort('responden')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Nama Toko / Responden"
                  >
                    <div className="flex items-center gap-1">
                      <span>Responden</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'responden' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('kabKota')}
                    className="py-3 px-2 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Kabupaten / Kota"
                  >
                    <div className="flex items-center gap-1">
                      <span>Kab/Kota</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'kabKota' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('kodeKomoditas')}
                    className="py-3 px-2 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Kode Komoditas"
                  >
                    <div className="flex items-center gap-1">
                      <span>Kode</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'kodeKomoditas' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('komoditas')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Nama Komoditas"
                  >
                    <div className="flex items-center gap-1">
                      <span>Komoditas</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'komoditas' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('kualitas')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Kualitas"
                  >
                    <div className="flex items-center gap-1">
                      <span>Kualitas</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'kualitas' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('satuan')}
                    className="py-3 px-2 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Satuan"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Satuan</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'satuan' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('kuesioner')}
                    className="py-3 px-2 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Kuesioner"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Kuesioner</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'kuesioner' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('m1Prev')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan M1 (N-1)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>M1 (N-1)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'm1Prev' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('m2Prev')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan M2 (N-1)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>M2 (N-1)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'm2Prev' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('m1Curr')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan M1 (N)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>M1 (N)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'm1Curr' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('m2Curr')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan M2 (N)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>M2 (N)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'm2Curr' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('rhM1')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan RH (M1)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RH (M1)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'rhM1' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('rhM2')}
                    className="py-3 px-2 text-right cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan RH (M2)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RH (M2)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'rhM2' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('geoPrev')}
                    className="py-3 px-2.5 text-right font-bold text-slate-700 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Rata-rata Geometri (N-1)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rata2 Geo (N-1)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'geoPrev' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('geoCurr')}
                    className="py-3 px-2.5 text-right font-bold text-slate-700 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Rata-rata Geometri (N)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rata2 Geo (N)</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'geoCurr' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('rh')}
                    className="py-3 px-2.5 text-right font-black text-emerald-950 cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Relatif Harga"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>RH</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'rh' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('status')}
                    className="py-3 px-2.5 text-center cursor-pointer select-none hover:bg-slate-200/80 transition-colors whitespace-nowrap"
                    title="Urutkan Status"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'status' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleRecordsSort('catatan')}
                    className="py-3 px-3 cursor-pointer select-none hover:bg-slate-200/80 transition-colors min-w-[150px]"
                    title="Urutkan Catatan Petugas"
                  >
                    <div className="flex items-center gap-1">
                      <span>Catatan Petugas</span>
                      <ArrowUpDown className={`w-3 h-3 ${recordsSortCol === 'catatan' ? 'text-emerald-700 font-black' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th className="py-3 px-2.5 text-center sticky right-0 bg-slate-100 z-10 border-l border-slate-200 whitespace-nowrap">
                    Aksi / Perbaikan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quickFilteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="py-12 text-center text-slate-400">
                      Tidak ada data responden yang sesuai filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => {
                    const isNaik = r.status === 'NAIK';
                    const isTurun = r.status === 'TURUN';
                    const isExtreme = Math.abs(r.rh - 100) > 3;

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/70 transition-colors font-normal ${
                          r.isAdjusted
                            ? 'bg-amber-50/30'
                            : isExtreme
                            ? r.rh > 100
                              ? 'bg-rose-50/20'
                              : 'bg-blue-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{r.responden}</span>
                            {r.isAdjusted && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                                title={`Harga responden telah disesuaikan manual: ${r.adjustmentNote || '-'}`}
                              >
                                Adj
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                          {r.kabKotaName}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-400">
                          {r.kodeKomoditas}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                          {r.komoditas}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                          {r.kualitas}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-medium">
                          {r.satuanStandar}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.kuesioner === 'V-HPBS.2'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {r.kuesioner}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                          {r.m1Prev ? r.m1Prev.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.m2Prev ? r.m2Prev.toLocaleString('id-ID') : '0.00'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700 font-medium">
                          {r.m1Curr ? r.m1Curr.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.m2Curr ? r.m2Curr.toLocaleString('id-ID') : '0.00'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                          {r.rhM1 ? r.rhM1.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.kuesioner === 'V-HPBS.2' && r.rhM2 ? r.rhM2.toFixed(2) : '0.00'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-medium text-slate-600 bg-slate-50/50">
                          {r.geoPrev.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-800 bg-slate-50/50">
                          {r.geoCurr.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono">
                          <div className="flex flex-col items-end">
                            <span
                              className={`text-sm font-black ${
                                isNaik
                                  ? 'text-rose-600'
                                  : isTurun
                                  ? 'text-blue-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {r.rh.toFixed(2)}
                            </span>
                            {isExtreme && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold ${
                                  r.rh > 100
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                                title={`RH Ekstrim: fluktuasi ${r.rh > 100 ? '+' : ''}${(r.rh - 100).toFixed(1)}% (> 3%)`}
                              >
                                <Zap className="w-2.5 h-2.5 shrink-0" />
                                {r.rh > 100 ? `+${(r.rh - 100).toFixed(1)}%` : `${(r.rh - 100).toFixed(1)}%`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {isNaik ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">
                              Naik
                            </span>
                          ) : isTurun ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                              Turun
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Stabil
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 italic max-w-xs truncate">
                          {r.catatanM1 || r.catatanM2 || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setAdjustingRecord(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="Koreksi harga responden & kalkulasi otomatis RH"
                          >
                            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Adjust RH</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
          <DataPaginationBar
            currentPage={recordsPage}
            totalItems={quickFilteredRecords.length}
            pageSize={recordsPageSize}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
            pageSizeOptions={[25, 50, 100, 250, 'all']}
            itemLabel="baris pencacahan"
          />

          {/* Action Bar & Export Footer for Responden Detail */}
          <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Unduh rekapitulasi data responden pedagang (format resmi BPS V-HPBS) dalam format spreadsheet Excel
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportResponden(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File Excel Responden ({cleanRecords.length} Baris)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW D: SERIES BULANAN & STABILITAS RELATIF HARGA */}
      {activeSubTab === 'series_stabilitas' && (
        <HpbsStabilitySeriesView
          periods={effectivePeriods}
          initialRegionId={selectedRegionId !== 'all' ? selectedRegionId : undefined}
        />
      )}

      {/* 5. Detail Commodity Drawer / Modal */}
      {selectedDetailCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedDetailCommodity.kuesioner === 'V-HPBS.2'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedDetailCommodity.kuesioner}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedDetailCommodity.kodeKomoditas}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedDetailCommodity.komoditas}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailCommodityCode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Kalbar Aggregate Metric */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl text-center">
                <div>
                  <span className="text-xs text-slate-500 block">Rata2 Geo Kalbar (N-1)</span>
                  <span className="text-sm font-bold text-slate-700">
                    {formatRupiah(selectedDetailCommodity.kalbarGeoPrev)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Rata2 Geo Kalbar (N)</span>
                  <span className="text-sm font-bold text-slate-800">
                    {formatRupiah(selectedDetailCommodity.kalbarGeoCurr)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-emerald-800 font-semibold block">
                    Relatif Harga Kalbar
                  </span>
                  <span
                    className={`text-lg font-black ${
                      selectedDetailCommodity.status === 'NAIK'
                        ? 'text-rose-600'
                        : selectedDetailCommodity.status === 'TURUN'
                        ? 'text-blue-600'
                        : 'text-emerald-800'
                    }`}
                  >
                    {selectedDetailCommodity.kalbarRh.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Regional Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Persebaran Relatif Harga di 14 Kabupaten / Kota:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEFAULT_REGIONS.map((r) => {
                    const reg = selectedDetailCommodity.regionalData[r.id];
                    if (!reg) {
                      return (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-400">{r.name}</span>
                          <span className="text-slate-300 italic">Tidak dipantau</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 block">{r.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {reg.respondentCount} pedagang • N-1: {formatRupiah(reg.geoPrev)} ➔ N:{' '}
                            {formatRupiah(reg.geoCurr)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-black text-xs block ${
                              reg.status === 'NAIK'
                                ? 'text-rose-600'
                                : reg.status === 'TURUN'
                                ? 'text-blue-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {reg.rh.toFixed(2)}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              reg.status === 'NAIK'
                                ? 'text-rose-500'
                                : reg.status === 'TURUN'
                                ? 'text-blue-500'
                                : 'text-slate-400'
                            }`}
                          >
                            {reg.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Commodity Note in Drawer */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    Catatan Komoditas (Agregat Se-Kalbar)
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleOpenNoteModal(selectedDetailCommodity)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    {selectedDetailCommodity.customNote ? 'Edit Catatan Kustom' : 'Tulis Catatan Kustom'}
                  </button>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {selectedDetailCommodity.catatan ? (
                    <div>
                      <p className="whitespace-pre-wrap">{selectedDetailCommodity.catatan}</p>
                      {selectedDetailCommodity.customNote && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Catatan analis telah tersimpan secara persisten
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">
                      Belum ada catatan untuk komoditas ini. Klik tombol di atas untuk menambahkan catatan analisis.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailCommodityCode(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. HPBS Data Management Modal */}
      <HpbsDataManagementModal
        isOpen={isDataManagementModalOpen}
        onClose={() => setIsDataManagementModalOpen(false)}
        initialMode={dataManagementMode}
        hpbsDataset={dataset}
        onSaveHpbsDataset={(newDs) => {
          onUpdateDataset(newDs);
          setAdjustmentToast('Data V-HPBS berhasil diperbarui dan disimpan!');
          setTimeout(() => setAdjustmentToast(null), 3500);
        }}
        onResetHpbs={handleResetClick}
        onSwitchPeriod={handlePeriodChange}
        isOwner={isOwner}
        onOpenOwnerAuth={(act) => onRequireOwner?.(act || 'Kelola Data HPBS', () => {})}
      />

      {/* 7. Import Modal */}
      <HpbsImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        sampleRecords={dataset.records}
        existingPeriods={effectivePeriods.map((p) => ({ id: p.id, label: p.label }))}
        activePeriodId={dataset.activePeriodId || '2026-09'}
      />

      {/* 8. Price Adjustment Modal */}
      <HpbsPriceAdjustmentModal
        isOpen={!!adjustingRecord}
        record={adjustingRecord}
        onClose={() => setAdjustingRecord(null)}
        onSaveAdjustment={handleSaveAdjustment}
        onResetAdjustment={handleResetAdjustment}
      />

      {/* 9. Commodity Note Edit Modal (Agregat Se-Kalbar) */}
      {editingCommodityNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                      {editingCommodityNote.kodeKomoditas}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        editingCommodityNote.kuesioner === 'V-HPBS.2'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {editingCommodityNote.kuesioner}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight mt-0.5">
                    Catatan: {editingCommodityNote.komoditas}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCommodityNote(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Summary Stats Pill */}
              <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[11px]">Relatif Harga (RH) Se-Kalbar</span>
                  <span
                    className={`text-base font-black ${
                      editingCommodityNote.status === 'NAIK'
                        ? 'text-rose-600'
                        : editingCommodityNote.status === 'TURUN'
                        ? 'text-blue-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {editingCommodityNote.kalbarRh.toFixed(2)}{' '}
                    <span className="text-xs font-semibold text-slate-500">
                      ({editingCommodityNote.percentChange > 0 ? '+' : ''}
                      {editingCommodityNote.percentChange.toFixed(2)}%)
                    </span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Satuan Standar</span>
                  <span className="font-bold text-slate-700">{editingCommodityNote.satuanStandar}</span>
                </div>
              </div>

              {/* Respondent Notes from Enumerators (if any) */}
              {editingCommodityNote.respondentNotes && editingCommodityNote.respondentNotes.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-700" />
                      Catatan Petugas Lapangan ({editingCommodityNote.respondentNotes.length} responden)
                    </span>
                    <span className="text-[10px] text-amber-700 italic">Dari kuesioner pedagang</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {editingCommodityNote.respondentNotes.map((rn, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-white rounded-lg border border-amber-200/60 text-[11px] text-slate-700 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-amber-950 text-[10px]">
                            {rn.kabKotaName} • {rn.responden}
                          </div>
                          <div className="text-slate-600 italic mt-0.5">"{rn.note}"</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteInputText((prev) =>
                              prev ? `${prev}; ${rn.note}` : rn.note
                            );
                          }}
                          className="shrink-0 text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                          title="Tambahkan teks ini ke Catatan Analis"
                        >
                          Salin
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Analyst Note Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tulis Catatan Analis (Agregat Se-Kalbar):
                </label>
                <textarea
                  rows={4}
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  placeholder="Contoh: Terjadi fluktuasi harga karena pasokan dari Jawa tertunda gelombang tinggi, stok di pedagang grosir menipis..."
                  className="w-full p-3 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition-colors leading-relaxed"
                />
              </div>

              {/* Quick Suggestion Templates */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Template cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Pasokan melimpah karena puncak panen lokal',
                    'Pasokan terhambat cuaca buruk dan distribusi laut',
                    'Kenaikan biaya angkut dan logistik antar pulau',
                    'Permintaan konsumen meningkat menjelang hari raya',
                    'Kenaikan harga pakan dan bibit di tingkat produsen',
                    'Harga relatif stabil, pasokan normal di seluruh pasar',
                  ].map((tpl, tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => {
                        setNoteInputText((prev) => (prev ? `${prev}. ${tpl}` : tpl));
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              {editingCommodityNote.customNote ? (
                <button
                  type="button"
                  onClick={handleClearCommodityNote}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  Hapus Catatan Kustom
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCommodityNote(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCommodityNote}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
