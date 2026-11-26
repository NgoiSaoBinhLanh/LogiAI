'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import { BranchOpsApi } from '@/services/operations.service';
import { BranchDetailItem } from '@/types/operations';
import { exportToPdf } from '@/lib/export-utils';

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterChip, setFilterChip] = useState<'ALL' | 'ACTIVE' | 'HIGH_LOAD' | 'MAINTENANCE'>(
    'ALL'
  );
  const [zoneFilter, setZoneFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [closeBlocker, setCloseBlocker] = useState<{
    totalStock: number;
    activeTransfers: number;
    activeOrders: number;
  } | null>(null);

  // Dialog Tạo Hub
  const [hubOpen, setHubOpen] = useState(false);
  const [hubCode, setHubCode] = useState('');
  const [hubName, setHubName] = useState('');
  const [hubType, setHubType] = useState<'HUB' | 'SATELLITE' | 'STORE'>('SATELLITE');
  const [hubAddress, setHubAddress] = useState('');
  const [hubLat, setHubLat] = useState('10.801465');
  const [hubLng, setHubLng] = useState('106.647328');
  const [hubCap, setHubCap] = useState('10000');
  const [hubPhone, setHubPhone] = useState('');

  // Dialog Tạo Zone / Bin
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');

  const [binOpen, setBinOpen] = useState(false);
  const [binZoneId, setBinZoneId] = useState('');
  const [binCode, setBinCode] = useState('');
  const [binCap, setBinCap] = useState('500');

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await BranchOpsApi.list();
      setBranches(res.branches);
      if (res.branches.length > 0 && !selectedId) {
        setSelectedId(res.branches[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return branches.filter((b) => {
      const matchSearch =
        !kw || b.name.toLowerCase().includes(kw) || b.code.toLowerCase().includes(kw);
      const matchChip =
        filterChip === 'ALL'
          ? true
          : filterChip === 'ACTIVE'
            ? b.status === 'ACTIVE'
            : filterChip === 'HIGH_LOAD'
              ? b.occupancyPct >= 80
              : b.status === 'MAINTENANCE' || b.status === 'INACTIVE';
      return matchSearch && matchChip;
    });
  }, [branches, search, filterChip]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedId) || null,
    [branches, selectedId]
  );

  const visibleZones = useMemo(() => {
    if (!selectedBranch) return [];
    if (!zoneFilter) return selectedBranch.zones;
    return selectedBranch.zones.filter((z) => z.id === zoneFilter);
  }, [selectedBranch, zoneFilter]);

  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await BranchOpsApi.create({
        code: hubCode,
        name: hubName,
        branchType: hubType,
        address: hubAddress,
        latitude: parseFloat(hubLat),
        longitude: parseFloat(hubLng),
        capacity: parseFloat(hubCap),
        managerPhone: hubPhone || undefined,
      });
      toast.success('Đã tạo chi nhánh/hub mới!');
      setHubOpen(false);
      setHubCode('');
      setHubName('');
      await loadBranches();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Tạo chi nhánh thất bại');
    }
  };

  const handleToggleBranchStatus = async (b: BranchDetailItem) => {
    setCloseBlocker(null);
    const nextStatus = b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await BranchOpsApi.updateStatus(b.id, nextStatus);
      toast.success(
        nextStatus === 'ACTIVE'
          ? `Đã kích hoạt lại chi nhánh ${b.name}`
          : `Đã ngừng hoạt động chi nhánh ${b.name}`
      );
      await loadBranches();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'BRANCH_CLOSE_BLOCKED') {
        const details = err.details as {
          totalStock: number;
          activeTransfers: number;
          activeOrders: number;
        };
        setCloseBlocker(details);
        toast.error(err.message);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
      }
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    try {
      await BranchOpsApi.createZone(selectedBranch.id, { code: zoneCode, name: zoneName });
      toast.success('Đã thêm khu vực (Zone) mới!');
      setZoneOpen(false);
      setZoneCode('');
      setZoneName('');
      await loadBranches();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Thêm Zone thất bại');
    }
  };

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await BranchOpsApi.createBin(binZoneId, { code: binCode, maxCapacity: parseFloat(binCap) });
      toast.success('Đã thêm kệ (Bin) mới!');
      setBinOpen(false);
      setBinCode('');
      await loadBranches();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Thêm Bin thất bại');
    }
  };

  const totalCap = branches.reduce((acc, b) => acc + b.capacity, 0);
  const totalQty = branches.reduce((acc, b) => acc + b.totalQty, 0);
  const avgOcc = totalCap > 0 ? Math.round((totalQty / totalCap) * 1000) / 10 : 0;
  const activeHubsCount = branches.filter((b) => b.status === 'ACTIVE').length;

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip (MangLuoiChiNhanh_SoDoKho.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#10B981] px-3 py-1 rounded-full text-label-md font-bold">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            {activeHubsCount}/{branches.length} Hubs trực tuyến
          </div>
          <span className="text-body-sm text-on-surface-variant">
            Tổng sức chứa:{' '}
            <strong className="font-mono text-on-surface">{totalCap.toLocaleString('vi-VN')} ĐV</strong> · Chiếm dụng TB:{' '}
            <strong className="font-mono text-primary">{avgOcc}%</strong>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              exportToPdf(
                'mang-luoi-chi-nhanh',
                'BÁO CÁO MẠNG LƯỚI KHO & CHI NHÁNH LOGAI',
                ['Mã Kho', 'Tên Chi Nhánh', 'Loại', 'Tồn Kho', 'Sức Chứa', 'Chiếm Dụng %', 'Trạng Thái'],
                branches.map((b) => [
                  b.code,
                  b.name,
                  b.branchType,
                  b.totalQty,
                  b.capacity,
                  `${b.occupancyPct}%`,
                  b.status,
                ])
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Xuất PDF</span>
          </button>

          <PermissionGuard permission="BRANCH_WRITE">
            <button
              type="button"
              onClick={() => setHubOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              <span>Thêm Hub mới</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* 40% / 60% Master-Detail Layout (MangLuoiChiNhanh_SoDoKho.html) */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Left 40% Master List */}
        <aside className="w-full xl:w-[40%] space-y-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-3">
            <div className="relative">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm theo tên kho, mã chi nhánh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'ACTIVE', label: 'Hoạt động' },
                  { id: 'HIGH_LOAD', label: 'Tải cao ≥ 80%' },
                  { id: 'MAINTENANCE', label: 'Ngừng / Bảo trì' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterChip(chip.id)}
                  className={`rounded-full px-3 py-1 text-label-sm font-semibold transition-colors ${
                    filterChip === chip.id
                      ? 'bg-primary-container text-white shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-surface-container-lowest rounded-xl p-8 text-center text-body-sm text-outline shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                Đang tải danh sách kho...
              </div>
            ) : (
              filtered.map((b) => {
                const active = b.id === selectedId;
                const binsCount = b.zones.reduce((acc, z) => acc + z.bins.length, 0);
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedId(b.id);
                      setCloseBlocker(null);
                      setZoneFilter('');
                    }}
                    className={`cursor-pointer rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all ${
                      active
                        ? 'bg-secondary-container/45 border-l-4 border-primary-container'
                        : 'bg-surface-container-lowest hover:bg-surface-container-low/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {b.code}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold text-on-surface-variant">
                            {b.branchType}
                          </span>
                        </div>
                        <h3 className="text-headline-sm font-bold text-on-surface mt-1">
                          {b.name}
                        </h3>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'ACTIVE'
                            ? 'bg-[#ECFDF5] text-[#10B981]'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {b.status === 'ACTIVE' ? 'Trực tuyến' : b.status}
                      </span>
                    </div>

                    <p className="text-body-sm text-on-surface-variant mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-outline">
                        location_on
                      </span>
                      <span className="truncate">{b.address}</span>
                    </p>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-on-surface-variant">Công suất chiếm dụng</span>
                        <span className="font-mono text-on-surface">
                          {b.totalQty.toLocaleString('vi-VN')} / {b.capacity.toLocaleString('vi-VN')} ({b.occupancyPct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.occupancyPct >= 85
                              ? 'bg-error'
                              : b.occupancyPct >= 65
                                ? 'bg-amber-500'
                                : 'bg-primary-container'
                          }`}
                          style={{ width: `${Math.min(100, b.occupancyPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-surface-container-low flex items-center justify-between text-[11px] text-outline">
                      <span>
                        {b.zones.length} Zones · {binsCount} Bins
                      </span>
                      <span className="font-medium text-primary">Xem sơ đồ →</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right 60% Detail & Warehouse Map */}
        <section className="w-full xl:w-[60%] bg-surface-container-lowest rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-5">
          {selectedBranch ? (
            <>
              {/* Detail Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-label-sm font-bold">
                      {selectedBranch.code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedBranch.status === 'ACTIVE'
                          ? 'bg-[#ECFDF5] text-[#10B981]'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      {selectedBranch.status === 'ACTIVE' ? 'Đang hoạt động' : selectedBranch.status}
                    </span>
                  </div>
                  <h2 className="text-headline-md font-bold text-on-surface mt-1.5">
                    {selectedBranch.name}
                  </h2>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    {selectedBranch.address}
                  </p>
                </div>

                <PermissionGuard permission="BRANCH_WRITE">
                  <button
                    type="button"
                    onClick={() => handleToggleBranchStatus(selectedBranch)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-label-md font-semibold transition-colors shrink-0 ${
                      selectedBranch.status === 'ACTIVE'
                        ? 'bg-error-container/70 hover:bg-error-container text-on-error-container'
                        : 'bg-[#ECFDF5] hover:bg-emerald-100 text-[#10B981]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      power_settings_new
                    </span>
                    <span>
                      {selectedBranch.status === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                    </span>
                  </button>
                </PermissionGuard>
              </div>

              {/* PB04 Red Blocker Alert Banner */}
              {closeBlocker && (
                <div className="rounded-xl bg-[#FEF2F2] border-l-4 border-error p-4 text-body-sm text-on-error-container space-y-1">
                  <div className="font-bold flex items-center gap-2 text-error">
                    <span className="material-symbols-outlined text-[20px]">report</span>
                    Không thể đóng / ngừng hoạt động chi nhánh (Ràng buộc an toàn PB04)
                  </div>
                  <p className="text-xs">
                    Chi nhánh vẫn còn{' '}
                    <strong>{closeBlocker.totalStock.toLocaleString('vi-VN')} ĐV tồn kho</strong>,{' '}
                    <strong>{closeBlocker.activeTransfers} phiếu điều chuyển</strong> và{' '}
                    <strong>{closeBlocker.activeOrders} đơn hàng đang xử lý</strong>. Vui lòng điều
                    chuyển hết hàng hóa trước khi đóng kho.
                  </p>
                </div>
              )}

              {/* Underline Tabs */}
              <Tabs defaultValue="zones" className="w-full">
                <TabsList className="bg-surface-container-low p-1 rounded-lg">
                  <TabsTrigger value="zones" className="rounded-md text-label-md font-semibold">
                    Sơ đồ lưu trữ ({selectedBranch.zones.length} Zones)
                  </TabsTrigger>
                  <TabsTrigger value="info" className="rounded-md text-label-md font-semibold">
                    Thông tin chung &amp; Hạ tầng
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="zones" className="space-y-4 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="w-56">
                      <Select
                        value={zoneFilter}
                        onChange={(e) => setZoneFilter(e.target.value)}
                        placeholder="Tất cả Khu vực (Zones)"
                        options={selectedBranch.zones.map((z) => ({
                          value: z.id,
                          label: `${z.code} — ${z.name}`,
                        }))}
                      />
                    </div>
                    <PermissionGuard permission="BRANCH_WRITE">
                      <button
                        type="button"
                        onClick={() => setZoneOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-fixed hover:bg-primary-fixed-dim text-primary px-3.5 py-2 text-label-md font-semibold transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span>Thêm Zone mới</span>
                      </button>
                    </PermissionGuard>
                  </div>

                  {visibleZones.length === 0 ? (
                    <div className="rounded-xl bg-surface-container-low p-8 text-center text-body-sm text-outline">
                      Chi nhánh chưa có khu vực lưu trữ (Zone) nào.
                    </div>
                  ) : (
                    visibleZones.map((zone) => (
                      <div
                        key={zone.id}
                        className="rounded-xl bg-surface-container-low/60 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary-container text-white font-mono font-bold text-xs flex items-center justify-center">
                              {zone.code.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-on-surface">
                                {zone.code} — {zone.name}
                              </div>
                              <div className="text-[11px] text-outline">
                                {zone.bins.length} kệ lưu trữ (Bins)
                              </div>
                            </div>
                          </div>

                          <PermissionGuard permission="BRANCH_WRITE">
                            <button
                              type="button"
                              onClick={() => {
                                setBinZoneId(zone.id);
                                setBinOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest hover:bg-primary-fixed text-primary px-3 py-1.5 text-label-sm font-semibold shadow-xs transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                add_box
                              </span>
                              <span>Thêm Kệ mới</span>
                            </button>
                          </PermissionGuard>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {zone.bins.map((bin) => (
                            <div
                              key={bin.id}
                              className={`rounded-lg p-3 text-xs space-y-1.5 transition-all shadow-xs ${
                                bin.occupancyPct >= 90
                                  ? 'bg-[#FEF2F2] text-on-error-container ring-1 ring-error/30'
                                  : bin.occupancyPct > 0
                                    ? 'bg-surface-container-lowest text-on-surface'
                                    : 'bg-surface-container/60 text-on-surface-variant'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-on-surface">
                                  {bin.code}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    bin.occupancyPct >= 90
                                      ? 'bg-error text-white'
                                      : bin.occupancyPct > 0
                                        ? 'bg-[#ECFDF5] text-[#10B981]'
                                        : 'bg-surface-container text-outline'
                                  }`}
                                >
                                  {bin.occupancyPct}%
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-on-surface-variant">
                                {bin.currentQty} / {Number(bin.maxCapacity)} đv
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="info" className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-surface-container-low p-4">
                      <p className="text-label-sm uppercase text-outline font-semibold">
                        Giá trị vốn hàng tồn
                      </p>
                      <p className="text-headline-sm font-mono font-bold text-primary mt-1">
                        {selectedBranch.totalValue.toLocaleString('vi-VN')} VNĐ
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-4">
                      <p className="text-label-sm uppercase text-outline font-semibold">
                        Nhân sự trực thuộc
                      </p>
                      <p className="text-headline-sm font-mono font-bold text-on-surface mt-1">
                        {selectedBranch.userCount} nhân viên
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-4">
                      <p className="text-label-sm uppercase text-outline font-semibold">
                        Tọa độ GPS (Lat / Lng)
                      </p>
                      <p className="text-body-md font-mono font-semibold text-on-surface mt-1">
                        {selectedBranch.latitude}, {selectedBranch.longitude}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-4">
                      <p className="text-label-sm uppercase text-outline font-semibold">
                        Số điện thoại điều hành
                      </p>
                      <p className="text-body-md font-mono font-semibold text-on-surface mt-1">
                        {selectedBranch.managerPhone || 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* AI Optimizer Recommendation Footer */}
              <div className="rounded-xl bg-gradient-to-r from-surface-container-low to-primary-fixed/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
                    auto_awesome
                  </span>
                  <div className="text-body-sm">
                    <span className="font-bold text-on-surface">
                      LogiAI Space Optimizer Recommendation:
                    </span>{' '}
                    <span className="text-on-surface-variant">
                      Khi tỷ lệ chiếm dụng kệ vượt 85%, chạy thuật toán điều phối để giải phóng tải.
                    </span>
                  </div>
                </div>
                <Link
                  href="/ai/transfer-optimization"
                  prefetch={false}
                  className="text-label-md font-bold text-primary hover:underline shrink-0"
                >
                  Chạy tối ưu AI →
                </Link>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-on-surface-variant text-body-md">
              Chọn một chi nhánh bên trái để xem sơ đồ chi tiết
            </div>
          )}
        </section>
      </div>

      {/* Dialog Thêm Hub */}
      <Dialog open={hubOpen} onOpenChange={setHubOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Thêm Chi nhánh / Hub mới</DialogTitle>
            <DialogDescription>Nhập thông tin định vị GPS và sức chứa kho</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHub} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Mã kho (vd: BR-CT-01)"
                value={hubCode}
                onChange={(e) => setHubCode(e.target.value)}
                required
              />
              <Select
                value={hubType}
                onChange={(e) => setHubType(e.target.value as 'HUB' | 'SATELLITE' | 'STORE')}
                options={[
                  { value: 'HUB', label: 'Kho Tổng (HUB)' },
                  { value: 'SATELLITE', label: 'Kho Vệ Tinh' },
                  { value: 'STORE', label: 'Cửa Hàng' },
                ]}
              />
            </div>
            <Input
              placeholder="Tên chi nhánh"
              value={hubName}
              onChange={(e) => setHubName(e.target.value)}
              required
            />
            <Input
              placeholder="Địa chỉ chi tiết"
              value={hubAddress}
              onChange={(e) => setHubAddress(e.target.value)}
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Vĩ độ (Lat)"
                value={hubLat}
                onChange={(e) => setHubLat(e.target.value)}
                required
              />
              <Input
                placeholder="Kinh độ (Lng)"
                value={hubLng}
                onChange={(e) => setHubLng(e.target.value)}
                required
              />
              <Input
                placeholder="Sức chứa"
                type="number"
                value={hubCap}
                onChange={(e) => setHubCap(e.target.value)}
                required
              />
            </div>
            <Input
              placeholder="SĐT Quản lý"
              value={hubPhone}
              onChange={(e) => setHubPhone(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHubOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Lưu Hub
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Thêm Zone */}
      <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Thêm Khu vực (Zone) — {selectedBranch?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateZone} className="space-y-3">
            <Input
              placeholder="Mã Zone (vd: Z-VIP)"
              value={zoneCode}
              onChange={(e) => setZoneCode(e.target.value)}
              required
            />
            <Input
              placeholder="Tên Zone (vd: Khu hàng giá trị cao)"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setZoneOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Thêm Zone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Thêm Bin */}
      <Dialog open={binOpen} onOpenChange={setBinOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Thêm Kệ Lưu Trữ (Bin)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBin} className="space-y-3">
            <Input
              placeholder="Mã kệ (vd: HCM-A02)"
              value={binCode}
              onChange={(e) => setBinCode(e.target.value)}
              required
            />
            <Input
              placeholder="Sức chứa tối đa"
              type="number"
              value={binCap}
              onChange={(e) => setBinCap(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBinOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Thêm Kệ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
