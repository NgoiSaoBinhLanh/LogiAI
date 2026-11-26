'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { DataTable } from '@/components/shared/data-table';
import { BarcodeLabelPrinter } from '@/components/barcode/barcode-label-printer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import { ProductApi } from '@/services/operations.service';
import { CategoryItem, ProductItem } from '@/types/operations';
import { exportToExcel, exportToPdf, parseExcelRows } from '@/lib/export-utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Dialog In tem (UI11)
  const [printProduct, setPrintProduct] = useState<ProductItem | null>(null);

  // Dialog Thêm SP
  const [createOpen, setCreateOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [catId, setCatId] = useState('');
  const [unit, setUnit] = useState('Cái');
  const [unitPrice, setUnitPrice] = useState('0');
  const [costPrice, setCostPrice] = useState('0');
  const [minStock, setMinStock] = useState('10');
  const [maxStock, setMaxStock] = useState('500');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        ProductApi.list({
          search: search || undefined,
          categoryId: categoryId || undefined,
          page,
          limit: 15,
        }),
        ProductApi.listCategories(),
      ]);
      setProducts(pRes.items);
      setTotalPages(pRes.pagination.totalPages);
      setTotalItems(pRes.pagination.total);
      setCategories(cRes.categories);
      if (cRes.categories.length > 0 && !catId) {
        setCatId(cRes.categories[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh mục sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, page, catId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ProductApi.create({
        sku,
        barcode: barcode || `893${Date.now().toString().slice(-10)}`,
        name,
        categoryId: catId,
        unit,
        unitPrice: parseFloat(unitPrice),
        costPrice: parseFloat(costPrice),
        minStock: parseInt(minStock, 10),
        maxStock: parseInt(maxStock, 10),
      });
      toast.success('Đã thêm sản phẩm mới và sinh mã vạch!');
      setCreateOpen(false);
      setSku('');
      setBarcode('');
      setName('');
      await fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Thêm sản phẩm thất bại');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseExcelRows(file);
      if (rows.length === 0) {
        toast.error('File Excel không có dữ liệu');
        return;
      }
      const mapped = rows.map((r) => ({
        sku: String(r.sku || r.SKU || ''),
        barcode: String(r.barcode || r.Barcode || r.sku || r.SKU || ''),
        name: String(r.name || r.Name || r['Tên sản phẩm'] || ''),
        categoryCode: String(r.categoryCode || r.Category || 'CAT-ELEC'),
        unit: String(r.unit || r.Unit || 'Cái'),
        unitPrice: Number(r.unitPrice || r.Price || 0),
        costPrice: Number(r.costPrice || 0),
        minStock: Number(r.minStock || 10),
        maxStock: Number(r.maxStock || 500),
      }));

      const res = await ProductApi.importBulk(mapped);
      toast.success(`Import thành công: ${res.createdCount} mới, ${res.updatedCount} cập nhật!`);
      await fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Import Excel thất bại');
    } finally {
      e.target.value = '';
    }
  };

  const columns: ColumnDef<ProductItem>[] = [
    {
      accessorKey: 'sku',
      header: 'SKU / Barcode',
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-bold text-primary text-xs">{row.original.sku}</p>
          <p className="font-mono text-[11px] text-outline mt-0.5">{row.original.barcode}</p>
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên sản phẩm',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-on-surface text-xs">{row.original.name}</p>
          <span className="inline-flex mt-0.5 px-2 py-0.2 rounded bg-surface-container-low text-[10px] font-medium text-on-surface-variant">
            {row.original.category.name}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'unitPrice',
      header: 'Đơn giá',
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-xs text-on-surface">
          {row.original.unitPrice.toLocaleString('vi-VN')} đ{' '}
          <span className="text-outline font-sans">/ {row.original.unit}</span>
        </span>
      ),
    },
    {
      accessorKey: 'totalAvailable',
      header: 'Tồn khả dụng & Ngưỡng Min',
      cell: ({ row }) => {
        const pct = Math.min(
          100,
          Math.round((row.original.totalAvailable / Math.max(1, row.original.maxStock || 100)) * 100)
        );
        const low = row.original.totalAvailable <= row.original.minStock;
        return (
          <div className="space-y-1.5 min-w-[140px]">
            <div className="flex items-center justify-between text-[11px]">
              <span
                className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                  low
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-[#ECFDF5] text-[#10B981]'
                }`}
              >
                {row.original.totalAvailable} (Min: {row.original.minStock})
              </span>
              <span className="font-mono text-outline">{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
              <div
                className={`h-full rounded-full ${low ? 'bg-error' : 'bg-primary-container'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: 'print',
      header: 'Tem nhãn (UI11)',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setPrintProduct(row.original)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-fixed/70 hover:bg-primary-fixed text-primary px-3 py-1.5 text-label-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">print</span>
          <span>In tem</span>
        </button>
      ),
    },
  ];

  const totalAvailableSum = products.reduce((acc, p) => acc + p.totalAvailable, 0);
  const lowStockCount = products.filter((p) => p.totalAvailable <= p.minStock).length;

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip (QuanLySanPhamVaInTem.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Mạng lưới &amp; Danh mục</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">Sản phẩm &amp; In Tem Mã vạch (UI11)</span>
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-mono text-[11px] font-bold">
              {totalItems} SKU
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản lý SKU, Barcode chuẩn Code128/QR, định mức tồn kho và in nhãn nhiệt 1:1
          </p>
        </div>

        <PermissionGuard permission="PRODUCT_WRITE">
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Import Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_box</span>
              <span>Thêm SKU mới</span>
            </button>
          </div>
        </PermissionGuard>
      </div>

      <div className="space-y-6">
        {/* 4 Executive Stats Cards (QuanLySanPhamVaInTem.html) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">Tổng số SKU</div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                {totalItems}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">qr_code_2</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Tồn kho khả dụng (Trang)
              </div>
              <div className="text-headline-md font-mono font-bold text-emerald-700 mt-1">
                {totalAvailableSum.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#10B981] text-[22px]">
                inventory_2
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Sẵn sàng in tem nhãn
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                {products.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">print</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Cảnh báo tồn thấp
              </div>
              <div className="text-headline-md font-mono font-bold text-error mt-1">
                {lowStockCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-[22px]">warning</span>
            </div>
          </div>
        </div>

        {/* Control Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm nhanh theo mã SKU, Barcode hoặc tên hàng hóa..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <Select
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value);
            }}
            placeholder="Tất cả nhóm ngành hàng"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          onExportExcel={() =>
            exportToExcel(
              'danh-muc-san-pham',
              'SanPham',
              products.map((p) => ({
                SKU: p.sku,
                Barcode: p.barcode,
                TenSanPham: p.name,
                DanhMuc: p.category.name,
                DonVi: p.unit,
                DonGia: p.unitPrice,
                TonKhaDung: p.totalAvailable,
              }))
            )
          }
          onExportPdf={() =>
            exportToPdf(
              'danh-muc-san-pham',
              'DANH MỤC SẢN PHẨM & ĐỊNH MỨC TỒN KHO LOGAI',
              ['SKU', 'Barcode', 'Tên sản phẩm', 'Danh mục', 'ĐVT', 'Đơn giá', 'Khả dụng'],
              products.map((p) => [
                p.sku,
                p.barcode,
                p.name,
                p.category.name,
                p.unit,
                p.unitPrice.toLocaleString('vi-VN'),
                p.totalAvailable,
              ])
            )
          }
        />
      </div>

      {/* Dialog Thêm Sản Phẩm */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Thêm Sản Phẩm Mới</DialogTitle>
            <DialogDescription>
              Để trống Barcode nếu muốn hệ thống tự sinh mã Code128 hợp lệ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Mã SKU (duy nhất) *"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
              <Input
                placeholder="Barcode (tự sinh nếu trống)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </div>
            <Input
              placeholder="Tên sản phẩm *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                placeholder="Đơn vị tính *"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Giá bán"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Giá vốn"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Tồn tối thiểu"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Tồn tối đa"
                value={maxStock}
                onChange={(e) => setMaxStock(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Lưu sản phẩm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog In Tem Nhiệt (UI11) */}
      <BarcodeLabelPrinter
        open={!!printProduct}
        onOpenChange={(o) => !o && setPrintProduct(null)}
        product={printProduct}
      />
    </AppShell>
  );
}
