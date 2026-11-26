'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PermissionGuard } from '@/components/auth/permission-guard';
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
import { OrderApi, ProductApi } from '@/services/operations.service';
import { CustomerOrderItem, ProductItem } from '@/types/operations';

interface BranchSuggestion {
  branchId: string;
  branchCode: string;
  branchName: string;
  branchType: string;
  canFulfillAll: boolean;
  distanceKm: number | null;
  missingItems: Array<{ sku: string; required: number; available: number }>;
}

export default function OrderAllocationPage() {
  const [orders, setOrders] = useState<CustomerOrderItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState('');

  // Dialog Tạo đơn mới
  const [createOpen, setCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [channel, setChannel] = useState('SHOPEE');
  const [lat, setLat] = useState('10.776889');
  const [lng, setLng] = useState('106.700806');
  const [prodId, setProdId] = useState('');
  const [qty, setQty] = useState('2');

  // Dialog Gợi ý & Phân bổ kho (PB11)
  const [allocOrder, setAllocOrder] = useState<CustomerOrderItem | null>(null);
  const [suggestions, setSuggestions] = useState<BranchSuggestion[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        OrderApi.list({ search: search || undefined, limit: 30 }),
        ProductApi.list({ limit: 100 }),
      ]);
      setOrders(oRes.items);
      setProducts(pRes.items);
      if (pRes.items.length > 0 && !prodId) setProdId(pRes.items[0].id);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách đơn hàng');
    }
  }, [search, prodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = products.find((item) => item.id === prodId);
    if (!p) return;
    try {
      await OrderApi.create({
        channel,
        customerName,
        customerAddress,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        items: [{ productId: p.id, qty: parseInt(qty, 10), price: p.unitPrice }],
      });
      toast.success('Đã tiếp nhận đơn hàng mới!');
      setCreateOpen(false);
      setCustomerName('');
      setCustomerAddress('');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Tạo đơn thất bại');
    }
  };

  const openAllocateDialog = async (order: CustomerOrderItem) => {
    setAllocOrder(order);
    setSuggestions([]);
    setSelectedBranchId('');
    try {
      const res = await OrderApi.suggestBranch(order.id);
      setSuggestions(res.suggestions);
      const optimal = res.suggestions.find((s) => s.canFulfillAll);
      if (optimal) setSelectedBranchId(optimal.branchId);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tính gợi ý chi nhánh');
    }
  };

  const handleConfirmAllocate = async () => {
    if (!allocOrder || !selectedBranchId) return;
    try {
      await OrderApi.allocate(allocOrder.id, selectedBranchId);
      toast.success(
        `Đã phân bổ đơn ${allocOrder.code} và giữ chỗ (Reserved) tồn kho thành công!`
      );
      setAllocOrder(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Phân bổ thất bại');
    }
  };

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Vận hành Kho &amp; Đơn hàng</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">
              Định tuyến &amp; Phân bổ Đơn hàng (PB11)
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Tính khoảng cách GPS kết hợp tồn khả dụng để đề xuất kho xử lý tối ưu và giữ chỗ tồn
          </p>
        </div>

        <PermissionGuard permission="ORDER_ALLOCATE">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            <span>Tạo đơn hàng mới</span>
          </button>
        </PermissionGuard>
      </div>

      <div className="space-y-6">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="relative max-w-md">
            <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-4 bg-surface-container-low/50">
            <h2 className="text-headline-sm font-bold text-on-surface">
              Danh sách Đơn Hàng ({orders.length})
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Đơn hàng ở trạng thái NEW cần được phân bổ về chi nhánh tối ưu trước khi đóng gói
              Kanban
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-6 pr-3 font-semibold">Mã đơn / Kênh</th>
                  <th className="py-3 px-3 font-semibold">Khách hàng &amp; Địa chỉ</th>
                  <th className="py-3 px-3 font-semibold">Sản phẩm &amp; Tổng tiền</th>
                  <th className="py-3 px-3 font-semibold">Kho xử lý</th>
                  <th className="py-3 px-3 font-semibold">Trạng thái</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">Phân bổ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 pl-6 pr-3">
                      <p className="font-mono font-bold text-primary">{o.code}</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-surface-container-low text-[10px] font-bold text-on-surface-variant">
                        {o.channel}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-semibold text-on-surface">{o.customerName}</p>
                      <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          location_on
                        </span>
                        {o.customerAddress}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      {o.details.map((d) => (
                        <div key={d.id} className="text-on-surface">
                          <span className="font-mono font-semibold">{d.product.sku}</span> × {d.qty}
                        </div>
                      ))}
                      <p className="font-mono font-bold text-primary mt-0.5">
                        {o.totalAmount.toLocaleString('vi-VN')} đ
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      {o.assignedBranch ? (
                        <span className="rounded bg-surface-container-low px-2.5 py-1 font-bold text-on-surface">
                          {o.assignedBranch.code} — {o.assignedBranch.name}
                        </span>
                      ) : (
                        <span className="italic text-outline">Chưa gán kho</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          o.status === 'NEW'
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : o.status === 'DELIVERED'
                              ? 'bg-[#ECFDF5] text-[#10B981]'
                              : 'bg-primary-fixed text-primary'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right">
                      {o.status === 'NEW' && (
                        <PermissionGuard permission="ORDER_ALLOCATE">
                          <button
                            type="button"
                            onClick={() => openAllocateDialog(o)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary-container hover:bg-primary text-white px-3 py-1.5 text-label-sm font-semibold shadow-xs transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              auto_awesome
                            </span>
                            <span>Gợi ý &amp; Phân bổ</span>
                          </button>
                        </PermissionGuard>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dialog Tạo Đơn Mới */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tiếp nhận Đơn hàng Mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                options={[
                  { value: 'SHOPEE', label: 'Shopee' },
                  { value: 'TIKTOK', label: 'TikTok Shop' },
                  { value: 'LAZADA', label: 'Lazada' },
                  { value: 'WEBSITE', label: 'Website B2C' },
                  { value: 'B2B', label: 'Khách hàng B2B' },
                ]}
              />
              <Input
                placeholder="Tên khách hàng *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <Input
              placeholder="Địa chỉ giao hàng *"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Vĩ độ (Lat)"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <Input
                placeholder="Kinh độ (Lng)"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Select
                  value={prodId}
                  onChange={(e) => setProdId(e.target.value)}
                  options={products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
                />
              </div>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Lưu đơn hàng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Gợi Ý Chi Nhánh Tối Ưu (PB11) */}
      <Dialog open={!!allocOrder} onOpenChange={(o) => !o && setAllocOrder(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Đề xuất Chi nhánh Tối ưu — {allocOrder?.code}</DialogTitle>
            <DialogDescription>
              Xếp hạng theo: Đủ tồn khả dụng toàn đơn + Khoảng cách GPS ngắn nhất tới khách hàng
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
            {suggestions.map((s, idx) => (
              <div
                key={s.branchId}
                onClick={() => s.canFulfillAll && setSelectedBranchId(s.branchId)}
                className={`rounded-xl p-3.5 transition-all ${
                  !s.canFulfillAll
                    ? 'opacity-60 bg-surface-container-low cursor-not-allowed'
                    : selectedBranchId === s.branchId
                      ? 'bg-primary-fixed/60 ring-2 ring-primary-container cursor-pointer'
                      : 'bg-surface-container-low hover:bg-surface-container cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">{s.branchName}</span>
                    {idx === 0 && s.canFulfillAll && (
                      <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold">
                        Gợi ý tối ưu #1
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-primary">
                    {s.distanceKm !== null ? `${s.distanceKm} km` : 'Chưa có GPS'}
                  </span>
                </div>
                {s.canFulfillAll ? (
                  <p className="text-xs text-emerald-700 mt-1">
                    Đủ toàn bộ tồn khả dụng để giữ chỗ và đóng gói ngay
                  </p>
                ) : (
                  <p className="text-xs text-error mt-1">
                    Thiếu hàng:{' '}
                    {s.missingItems
                      .map((m) => `${m.sku} (Cần ${m.required}/Còn ${m.available})`)
                      .join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOrder(null)}>
              Hủy
            </Button>
            <Button
              disabled={!selectedBranchId}
              onClick={handleConfirmAllocate}
              className="bg-primary-container hover:bg-primary text-white"
            >
              <span className="material-symbols-outlined text-[18px] mr-1.5">check_circle</span>
              Xác nhận gán chi nhánh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
