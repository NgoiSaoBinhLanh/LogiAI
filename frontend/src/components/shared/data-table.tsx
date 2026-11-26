'use client';

import React, { useState } from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onExportExcel,
  onExportPdf,
  emptyMessage = 'Không có dữ liệu phù hợp',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      {(onExportExcel || onExportPdf) && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-on-surface-variant">
            Tổng số bản ghi:{' '}
            <strong className="font-mono text-on-surface">{totalItems}</strong>
          </span>
          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-on-surface px-3 py-1.5 text-xs font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">
                  table_view
                </span>
                <span>Xuất Excel</span>
              </button>
            )}
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-on-surface px-3 py-1.5 text-xs font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-error">
                  picture_as_pdf
                </span>
                <span>Xuất PDF</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
        <Table>
          <TableHeader className="bg-surface-container-low">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-label-sm uppercase font-semibold text-on-surface-variant"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? 'flex cursor-pointer select-none items-center gap-1 hover:text-primary'
                            : ''
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="material-symbols-outlined text-[14px] text-outline">
                            swap_vert
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y divide-surface-container-low">
            {loading ? (
              <TableRow className="border-0">
                <TableCell colSpan={columns.length} className="py-10 text-center text-outline">
                  Đang tải dữ liệu...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="border-0">
                <TableCell colSpan={columns.length} className="py-10 text-center text-outline">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-0 hover:bg-surface-container-low/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-on-surface-variant">
          Trang <strong className="font-mono text-on-surface">{page}</strong> /{' '}
          <strong className="font-mono text-on-surface">{Math.max(1, totalPages)}</strong>
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-on-surface shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            <span>Trước</span>
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-on-surface shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors"
          >
            <span>Sau</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
