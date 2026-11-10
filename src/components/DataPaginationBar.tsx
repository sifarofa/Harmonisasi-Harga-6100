import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye } from 'lucide-react';

export interface QuickViewOption {
  id: string;
  label: string;
  count?: number;
}

export interface DataPaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number | 'all';
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | 'all') => void;
  pageSizeOptions?: (number | 'all')[];
  itemLabel?: string;
  className?: string;
  quickViews?: QuickViewOption[];
  activeQuickView?: string;
  onQuickViewChange?: (viewId: string) => void;
}

export const DataPaginationBar: React.FC<DataPaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, 'all'],
  itemLabel = 'data',
  className = '',
  quickViews,
  activeQuickView,
  onQuickViewChange,
}) => {
  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? Math.max(totalItems, 1) : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : isAll ? 1 : (validPage - 1) * effectivePageSize + 1;
  const endItem = totalItems === 0 ? 0 : isAll ? totalItems : Math.min(validPage * effectivePageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (validPage <= 3) {
      pages.push(1, 2, 3, '...', totalPages);
    } else if (validPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', validPage, '...', totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`bg-slate-50/90 border-t border-slate-200 px-3 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left section: Quick Views & Counts */}
      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
        {/* Quick view filters if provided */}
        {quickViews && quickViews.length > 0 && onQuickViewChange && (
          <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-lg p-0.5 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5 pr-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-500" />
              View:
            </span>
            {quickViews.map((qv) => {
              const isActive = (activeQuickView || quickViews[0].id) === qv.id;
              return (
                <button
                  key={qv.id}
                  type="button"
                  onClick={() => onQuickViewChange(qv.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {qv.label}
                  {qv.count !== undefined && (
                    <span
                      className={`ml-1 text-[10px] px-1 py-0.2 rounded-full ${
                        isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {qv.count.toLocaleString('id-ID')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Total counts info */}
        <div className="text-slate-600 font-medium">
          Menampilkan{' '}
          <span className="font-bold text-slate-900">
            {startItem.toLocaleString('id-ID')} - {endItem.toLocaleString('id-ID')}
          </span>{' '}
          dari{' '}
          <span className="font-bold text-emerald-800">
            {totalItems.toLocaleString('id-ID')}
          </span>{' '}
          {itemLabel}
        </div>
      </div>

      {/* Right section: Rows-per-page selector & Page navigation */}
      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
        {/* Rows per page selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="select-page-size" className="text-slate-500 font-medium whitespace-nowrap text-[11px]">
            Tampilkan:
          </label>
          <select
            id="select-page-size"
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
              onPageSizeChange(val);
              onPageChange(1);
            }}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'Semua Baris' : `${opt} baris`}
              </option>
            ))}
          </select>
        </div>

        {/* Page navigation buttons */}
        {!isAll && totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => onPageChange(1)}
              title="Halaman Pertama"
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-2xs cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => onPageChange(validPage - 1)}
              title="Halaman Sebelumnya"
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-0.5">
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-slate-400">
                      &bull;&bull;&bull;
                    </span>
                  );
                }
                const isCurrent = p === validPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`min-w-[26px] h-[26px] rounded-md text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => onPageChange(validPage + 1)}
              title="Halaman Berikutnya"
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              title="Halaman Terakhir"
              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-2xs cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
