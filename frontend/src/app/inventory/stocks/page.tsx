'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { DataTable } from '@/components/shared/data-table';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/services/api';
import { BranchOpsApi, InventoryApi } from '@/services/operations.service';
import { BranchDetailItem, StockItem } from '@/types/operations';
import { exportToExcel, exportToPdf } from '@/lib/export-utils';

export default function StocksPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        InventoryApi.listStocks({
          search: search || undefined,
          branchId: branchId || undefined,
          lowStockOnly,
          page,
          limit: 15,
        }),
        BranchOpsApi.list().catch(() => ({ branches: [] as BranchDetailItem[] })),
      ]);
      setStocks(sRes.items);
      setTotalPages(sRes.pagination.totalPages);
      setTotalItems(sRes.pagination.total);
      setBranches(bRes.branches);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tải dữ liệu tồn kho');
    } finally {
      setLoading(false);
    }
  }, [search, branchId, lowStockOnly, page]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const columns: ColumnDef<StockItem>[] = [
    {
      id: 'product',
      header: 'SKU / Sản phẩm',
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-bold text-primary text-xs">{row.original.product.sku}</p>
          <p className="text-xs text-on-surface font-medium mt-0.5">
            {row.original.product.name}
          </p>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Chi nhánh & Kệ Bin',
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-bold text-on-surface">{row.original.branch.code}</p>
          <p className="text-[11px] font-mono text-outline">
            {row.original.bin.zone.code} · {row.original.bin.code}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'batchNo',
      header: 'Lô & Hạn dùng',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs font-semibold text-on-surface">
            {row.original.batchNo}
          </p>
          <p className="text-[11px] text-outline">
            EXP:{' '}
            {row.original.expDate
              ? new Date(row.original.expDate).toLocaleDateString('vi-VN')
              : 'Không HSD'}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'qtyOnHand',
      header: 'Tồn thực / Giữ chỗ',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface">
          <strong>{row.original.qtyOnHand}</strong> / {row.original.qtyReserved}
        </span>
      ),
    },
    {
      accessorKey: 'qtyAvailable',
      header: 'Khả dụng',
      cell: ({ row }) => {
        const low = row.original.qtyAvailable <= row.original.product.minStock;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                low
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-[#ECFDF5] text-[#10B981]'
              }`}
            >
              {row.original.qtyAvailable} {row.original.product.unit}
            </span>
            {row.original.isLocked && (
              <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold">
                Đang kiểm kê
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Mạng lưới &amp; Danh mục</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">
              Tồn kho Thời gian thực theo Lô &amp; Kệ Bin
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Theo dõi tồn khả dụng (OnHand − Reserved), hạn sử dụng FEFO và trạng thái khóa kiểm kê
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary-fixed text-primary font-mono text-xs font-bold">
          {totalItems} lô đang quản lý
        </span>
      </div>

      <div className="space-y-6">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] grid gap-3 md:grid-cols-4 items-center">
          <div className="relative md:col-span-2">
            <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm SKU, Barcode, tên sản phẩm, mã lô..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <Select
            value={branchId}
            onChange={(e) => {
              setPage(1);
              setBranchId(e.target.value);
            }}
            placeholder="Tất cả chi nhánh"
            options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer select-none">
            <Checkbox
              checked={lowStockOnly}
              onCheckedChange={(c) => {
                setPage(1);
                setLowStockOnly(c === true);
              }}
            />
            Chỉ xem hàng dưới định mức Min
          </label>
        </div>

        <DataTable
          columns={columns}
          data={stocks}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          onExportExcel={() =>
            exportToExcel(
              'bao-cao-ton-kho',
              'TonKho',
              stocks.map((s) => ({
                Kho: s.branch.code,
                KeBin: s.bin.code,
                SKU: s.product.sku,
                TenSanPham: s.product.name,
                MaLo: s.batchNo,
                TonThuc: s.qtyOnHand,
                GiuCho: s.qtyReserved,
                KhaDung: s.qtyAvailable,
              }))
            )
          }
          onExportPdf={() =>
            exportToPdf(
              'bao-cao-ton-kho',
              'BÁO CÁO TỒN KHO CHI TIẾT THEO LÔ & KỆ BIN',
              ['Kho', 'Kệ', 'SKU', 'Tên SP', 'Lô', 'Tồn', 'Giữ chỗ', 'Khả dụng'],
              stocks.map((s) => [
                s.branch.code,
                s.bin.code,
                s.product.sku,
                s.product.name,
                s.batchNo,
                s.qtyOnHand,
                s.qtyReserved,
                s.qtyAvailable,
              ])
            )
          }
        />
      </div>
    </AppShell>
  );
}
