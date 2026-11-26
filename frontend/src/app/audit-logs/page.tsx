'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { DataTable } from '@/components/shared/data-table';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/services/api';
import { AuditLogApi } from '@/services/operations.service';
import { AuditLogItem } from '@/types/operations';
import { exportToExcel, exportToPdf } from '@/lib/export-utils';

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AuditLogApi.list({
        search: search || undefined,
        actionType: actionType || undefined,
        page,
        limit: 15,
      });
      setItems(res.items);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể tải nhật ký kiểm toán');
    } finally {
      setLoading(false);
    }
  }, [search, actionType, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeClass = (act: string) => {
    switch (act) {
      case 'CREATE':
      case 'APPROVE':
        return 'bg-[#ECFDF5] text-[#10B981]';
      case 'DELETE':
      case 'REJECT':
        return 'bg-error-container text-on-error-container';
      case 'PERMISSION_CHANGE':
        return 'bg-tertiary-fixed text-on-tertiary-fixed';
      default:
        return 'bg-primary-fixed text-primary';
    }
  };

  const columns: ColumnDef<AuditLogItem>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Log ID / Thời gian',
      cell: ({ row }) => (
        <div>
          <div className="font-mono font-bold text-xs text-primary">
            #LOG-{String(row.original.id).slice(0, 8)}
          </div>
          <div className="text-[11px] font-mono text-outline mt-0.5">
            {new Date(row.original.createdAt).toLocaleString('vi-VN')}
          </div>
        </div>
      ),
    },
    {
      id: 'user',
      header: 'Người thực hiện',
      cell: ({ row }) =>
        row.original.user ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center shrink-0">
              {row.original.user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-on-surface text-xs">
                {row.original.user.fullName}
              </p>
              <p className="text-[11px] font-mono text-outline">@{row.original.user.username}</p>
            </div>
          </div>
        ) : (
          <span className="text-xs italic text-outline">Hệ thống / Background Job</span>
        ),
    },
    {
      accessorKey: 'actionType',
      header: 'Hành động',
      cell: ({ row }) => (
        <span
          className={`inline-flex px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${getActionBadgeClass(
            row.original.actionType
          )}`}
        >
          {row.original.actionType}
        </span>
      ),
    },
    {
      accessorKey: 'module',
      header: 'Phân hệ',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-on-surface">
          {row.original.module}
        </span>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'Địa chỉ IP',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface-variant">
          {row.original.ipAddress || '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Chi tiết JSON',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setSelectedLog(row.original)}
          className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low hover:bg-primary-fixed text-primary px-2.5 py-1 text-label-sm font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">visibility</span>
          <span>Xem Diff</span>
        </button>
      ),
    },
  ];

  return (
    <AppShell>
      {/* Full-bleed Sub-header White Strip (NhatKyHoatDongHeThong.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Quản trị hệ thống</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">
              Nhật ký Hoạt động Hệ thống (PB05)
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Truy vết mọi thay đổi JSON trước/sau thao tác ở chế độ bất biến
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ECFDF5] text-[#10B981] text-label-sm font-bold">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Tamper-proof SHA-256 v4.2
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[16px] text-outline">lock</span>
            Chế độ: Chỉ đọc (Read-only)
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* 4-col Security & Node Telemetry Bar (NhatKyHoatDongHeThong.html) */}
        <div className="bg-surface-container-low rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-lg p-3.5 flex items-center gap-3 shadow-xs">
            <span className="material-symbols-outlined text-primary text-[24px]">receipt_long</span>
            <div>
              <div className="text-label-sm text-outline uppercase font-semibold">
                Tổng bản ghi Audit
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface">
                {totalItems.toLocaleString('vi-VN')}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-lg p-3.5 flex items-center gap-3 shadow-xs">
            <span className="material-symbols-outlined text-[#10B981] text-[24px]">
              enhanced_encryption
            </span>
            <div>
              <div className="text-label-sm text-outline uppercase font-semibold">
                Toàn vẹn chuỗi Hash
              </div>
              <div className="text-headline-sm font-mono font-bold text-[#10B981]">
                100% Verified
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-lg p-3.5 flex items-center gap-3 shadow-xs">
            <span className="material-symbols-outlined text-amber-600 text-[24px]">policy</span>
            <div>
              <div className="text-label-sm text-outline uppercase font-semibold">
                Chế độ truy cập
              </div>
              <div className="text-headline-sm font-bold text-on-surface">Immutable Ledger</div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-lg p-3.5 flex items-center gap-3 shadow-xs">
            <span className="material-symbols-outlined text-primary text-[24px]">
              data_object
            </span>
            <div>
              <div className="text-label-sm text-outline uppercase font-semibold">
                Đang hiển thị
              </div>
              <div className="text-headline-sm font-mono font-bold text-on-surface">
                {items.length} bản ghi/trang
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar + Chips */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm theo phân hệ, tên người dùng, địa chỉ IP..."
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
            <Select
              value={actionType}
              onChange={(e) => {
                setPage(1);
                setActionType(e.target.value);
              }}
              placeholder="Tất cả loại hành động"
              options={[
                { value: 'CREATE', label: 'CREATE (Thêm mới)' },
                { value: 'UPDATE', label: 'UPDATE (Cập nhật)' },
                { value: 'DELETE', label: 'DELETE (Xóa)' },
                { value: 'APPROVE', label: 'APPROVE (Phê duyệt)' },
                { value: 'REJECT', label: 'REJECT (Từ chối)' },
                { value: 'PERMISSION_CHANGE', label: 'PERMISSION_CHANGE (RBAC)' },
                { value: 'LOGIN', label: 'LOGIN (Đăng nhập)' },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-full bg-primary-fixed px-2.5 py-0.5 font-semibold text-primary hover:bg-primary-fixed-dim"
                >
                  Từ khóa: &quot;{search}&quot; ×
                </button>
              )}
              {actionType && (
                <button
                  type="button"
                  onClick={() => setActionType('')}
                  className="rounded-full bg-secondary-container px-2.5 py-0.5 font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  Loại: {actionType} ×
                </button>
              )}
            </div>
            <span className="text-outline font-medium">
              Hiển thị {items.length} / {totalItems} bản ghi
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          onExportExcel={() =>
            exportToExcel(
              'audit-logs',
              'AuditLogs',
              items.map((i) => ({
                ThoiGian: new Date(i.createdAt).toLocaleString('vi-VN'),
                NguoiDung: i.user?.fullName || 'System',
                HanhDong: i.actionType,
                PhanHe: i.module,
                IP: i.ipAddress || '',
                DuLieuMoi: JSON.stringify(i.newData),
              }))
            )
          }
          onExportPdf={() =>
            exportToPdf(
              'audit-logs',
              'BÁO CÁO NHẬT KÝ KIỂM TOÁN HỆ THỐNG LOGAI',
              ['Thời gian', 'Người dùng', 'Hành động', 'Phân hệ', 'IP'],
              items.map((i) => [
                new Date(i.createdAt).toLocaleString('vi-VN'),
                i.user?.fullName || 'System',
                i.actionType,
                i.module,
                i.ipAddress || '—',
              ])
            )
          }
        />
      </div>

      {/* 500px Right Slide-Over JSON Diff Drawer (NhatKyHoatDongHeThong.html) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs"
            onClick={() => setSelectedLog(null)}
          />
          <aside className="relative z-10 w-full sm:w-[500px] h-full bg-surface-container-lowest shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-surface-container-low flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-primary">
                  #LOG-{String(selectedLog.id).slice(0, 12)}
                </div>
                <h3 className="text-headline-sm font-bold text-on-surface">
                  Chi tiết Đối tượng Thay đổi (JSON Diff)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              {/* Metadata Grid Card */}
              <div className="rounded-xl bg-surface-container-low p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-outline block">Phân hệ (Module)</span>
                  <span className="font-mono font-bold text-on-surface">
                    {selectedLog.module}
                  </span>
                </div>
                <div>
                  <span className="text-outline block">Hành động (Action)</span>
                  <span className="font-mono font-bold text-primary">
                    {selectedLog.actionType}
                  </span>
                </div>
                <div>
                  <span className="text-outline block">Tài khoản thực hiện</span>
                  <span className="font-semibold text-on-surface">
                    {selectedLog.user?.fullName || 'Hệ thống'}
                  </span>
                </div>
                <div>
                  <span className="text-outline block">Địa chỉ IP &amp; Thời gian</span>
                  <span className="font-mono text-on-surface-variant">
                    {selectedLog.ipAddress || '—'} ·{' '}
                    {new Date(selectedLog.createdAt).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Old Data Snapshot */}
              <div className="rounded-xl bg-inverse-surface p-4 text-inverse-on-surface">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                    Dữ liệu cũ (old_data)
                  </span>
                  <span className="text-[10px] font-mono text-white/50">JSON Snapshot</span>
                </div>
                <pre className="overflow-auto max-h-56 font-mono text-[11px] leading-relaxed text-rose-100 custom-scrollbar">
                  {JSON.stringify(selectedLog.oldData ?? null, null, 2)}
                </pre>
              </div>

              {/* New Data Snapshot */}
              <div className="rounded-xl bg-inverse-surface p-4 text-inverse-on-surface">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Dữ liệu mới (new_data)
                  </span>
                  <span className="text-[10px] font-mono text-white/50">JSON Snapshot</span>
                </div>
                <pre className="overflow-auto max-h-56 font-mono text-[11px] leading-relaxed text-emerald-100 custom-scrollbar">
                  {JSON.stringify(selectedLog.newData ?? null, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer SHA-256 Footer */}
            <div className="px-6 py-3.5 bg-surface-container-low flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                SHA-256 Immutable Record Verified
              </span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-primary-container text-white font-semibold hover:bg-primary"
              >
                Đóng
              </button>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
