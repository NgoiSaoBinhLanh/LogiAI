'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import { RbacApi } from '@/services/iam.service';
import { PermissionItem, RoleItem } from '@/types/auth';
import { useAuth } from '@/store/auth-context';

export default function RbacSettingsPage() {
  const { refreshUserPermissions } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog thêm/sao chép vai trò
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Dialog xác nhận lưu cấu hình nhạy cảm (2FA/Confirm step theo UI04)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([RbacApi.listRoles(), RbacApi.listPermissions()]);
      setRoles(rRes.roles);
      setPermissions(pRes.permissions);

      if (rRes.roles.length > 0) {
        const target =
          (selectedRoleId && rRes.roles.find((r) => r.id === selectedRoleId)) || rRes.roles[0];
        setSelectedRoleId(target.id);
        setDraftPerms(target.permissions);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải cấu hình RBAC');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const filteredRoles = useMemo(() => {
    const kw = roleSearch.trim().toLowerCase();
    if (!kw) return roles;
    return roles.filter(
      (r) => r.roleName.toLowerCase().includes(kw) || r.roleCode.toLowerCase().includes(kw)
    );
  }, [roles, roleSearch]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    for (const p of permissions) {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    }
    return groups;
  }, [permissions]);

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRoleId(role.id);
    setDraftPerms(role.permissions);
  };

  const togglePermission = (code: string) => {
    setDraftPerms((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const toggleAllRead = (checked: boolean) => {
    const readCodes = permissions
      .filter((p) => p.code.endsWith('_READ') || p.code.endsWith('_TRACK'))
      .map((p) => p.code);

    if (checked) {
      setDraftPerms((prev) => Array.from(new Set([...prev, ...readCodes])));
    } else {
      setDraftPerms((prev) => prev.filter((c) => !readCodes.includes(c)));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await RbacApi.updateRolePermissions(selectedRole.id, draftPerms);
      toast.success(
        `Đã lưu quyền cho ${selectedRole.roleName}. Áp dụng tức thì cho ${res.affectedUsersCount} tài khoản!`
      );
      setConfirmSaveOpen(false);
      await loadData();
      await refreshUserPermissions();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu ma trận phân quyền thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (!selectedRole) return;
    try {
      await RbacApi.resetRoleDefault(selectedRole.id);
      toast.success(`Đã khôi phục cấu hình mặc định cho ${selectedRole.roleName}`);
      await loadData();
      await refreshUserPermissions();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Khôi phục thất bại');
    }
  };

  const handleCreateOrCloneRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (cloneSourceId) {
        await RbacApi.cloneRole(cloneSourceId, {
          roleCode: newRoleCode,
          roleName: newRoleName,
          description: newRoleDesc || undefined,
        });
        toast.success('Đã sao chép cấu hình vai trò mới!');
      } else {
        await RbacApi.createRole({
          roleCode: newRoleCode,
          roleName: newRoleName,
          description: newRoleDesc || undefined,
        });
        toast.success('Đã tạo vai trò mới!');
      }
      setRoleModalOpen(false);
      setNewRoleCode('');
      setNewRoleName('');
      setNewRoleDesc('');
      setCloneSourceId(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    }
  };

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip (PhanQuyenTruyCapRBAC.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Quản trị hệ thống</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              Phân quyền Truy cập (RBAC — UI04)
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản trị ma trận phân quyền chi tiết theo vai trò — cập nhật trực tiếp qua Redis Pub/Sub
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-lg bg-surface-container-low text-label-sm font-semibold text-on-surface flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Scope: Toàn hệ thống
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-primary-fixed text-label-sm font-bold text-primary">
            Audit Policy: SHA-256
          </span>
          <button
            type="button"
            onClick={() => {
              setCloneSourceId(null);
              setRoleModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Tạo vai trò mới</span>
          </button>
        </div>
      </div>

      {/* 32% Left Role List / 68% Right Matrix (PhanQuyenTruyCapRBAC.html) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Role Panel (32%) */}
        <aside className="w-full lg:w-[32%] bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-4 border-b border-surface-container-low space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-sm font-bold text-on-surface">
                Danh sách Vai trò ({roles.length})
              </h2>
              <span className="text-label-sm font-mono text-outline">RBAC Matrix</span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã hoặc tên vai trò..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="divide-y divide-surface-container-low max-h-[520px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-6 text-center text-body-sm text-outline">Đang tải vai trò...</div>
            ) : (
              filteredRoles.map((r) => {
                const isSelected = selectedRoleId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left px-4 py-3.5 relative transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-surface-container-low'
                        : 'hover:bg-surface-container-low/50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container" />
                    )}
                    <div className="min-w-0 flex-1 pl-1">
                      <div className="flex items-center gap-2">
                        <span className="text-label-lg font-bold text-on-surface truncate">
                          {r.roleName}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-primary text-[10px] font-bold shrink-0">
                            Đang chọn
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-body-sm text-on-surface-variant">
                        <span className="font-mono text-[11px] text-primary font-semibold">
                          {r.roleCode}
                        </span>
                        <span>·</span>
                        <span>{r.permissions.length} quyền</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-label-sm font-mono font-bold text-on-surface shrink-0">
                      {r.userCount} NV
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Left Card Footer Actions */}
          <div className="p-3 bg-surface-container-low/70 flex items-center justify-between gap-2 text-label-sm">
            {selectedRole ? (
              <button
                type="button"
                onClick={() => {
                  setCloneSourceId(selectedRole.id);
                  setNewRoleCode(`${selectedRole.roleCode}_COPY`);
                  setNewRoleName(`${selectedRole.roleName} (Bản sao)`);
                  setRoleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Sao chép vai trò này</span>
              </button>
            ) : (
              <span />
            )}
            <Link
              href="/audit-logs"
              prefetch={false}
              className="inline-flex items-center gap-1 font-semibold text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Lịch sử quyền</span>
            </Link>
          </div>
        </aside>

        {/* Right Permission Matrix Panel (68%) */}
        <section className="w-full lg:w-[68%] bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          {selectedRole ? (
            <>
              {/* Role Header */}
              <div className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-surface-container-low">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-headline-md font-bold text-on-surface">
                      {selectedRole.roleName}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-label-sm font-bold">
                      {selectedRole.roleCode}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {selectedRole.description ||
                      'Cấu hình ma trận quyền chi tiết áp dụng trên toàn hệ thống.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px]">restart_alt</span>
                    <span>Khôi phục mặc định</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSaveOpen(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px]">save</span>
                    <span>Lưu cấu hình</span>
                  </button>
                </div>
              </div>

              {/* Branch Isolation Policy Box */}
              <div className="mx-6 mt-5 rounded-xl bg-surface-container-low p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    security
                  </span>
                </div>
                <div className="text-body-sm text-on-surface-variant">
                  <p className="font-bold text-on-surface">
                    Chính sách Cách ly Dữ liệu Chi nhánh (Branch Isolation Policy)
                  </p>
                  <p className="mt-0.5">
                    Các tài khoản gán trực thuộc chi nhánh cụ thể sẽ tự động giới hạn phạm vi truy
                    cập theo Chi nhánh đó kể cả khi sở hữu quyền đọc/ghi. Thay đổi ma trận quyền sẽ
                    cập nhật tức thì qua cơ chế RBAC Dynamic Version.
                  </p>
                </div>
              </div>

              {/* Quick Select Controls */}
              <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-label-md font-semibold text-on-surface">
                  Chi tiết Ma trận Quyền hạn theo Phân hệ
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllRead(true)}
                    className="px-3 py-1 rounded bg-primary-fixed/60 hover:bg-primary-fixed text-primary text-label-sm font-semibold transition-colors"
                  >
                    Chọn tất cả quyền Xem
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllRead(false)}
                    className="px-3 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-label-sm font-semibold transition-colors"
                  >
                    Bỏ chọn quyền Xem
                  </button>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto px-6 pb-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                      <th className="py-2.5 px-4 rounded-l-lg font-semibold w-44">Phân hệ</th>
                      <th className="py-2.5 px-4 font-semibold">Quyền chi tiết</th>
                      <th className="py-2.5 px-4 font-semibold">Mã quyền</th>
                      <th className="py-2.5 px-4 rounded-r-lg font-semibold text-center w-24">
                        Kích hoạt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low text-body-sm">
                    {Object.entries(groupedPermissions).map(([moduleName, perms]) =>
                      perms.map((p, idx) => {
                        const checked = draftPerms.includes(p.code);
                        return (
                          <tr
                            key={p.code}
                            onClick={() => togglePermission(p.code)}
                            className={`cursor-pointer transition-colors ${
                              checked
                                ? 'bg-primary-fixed/15 hover:bg-primary-fixed/25'
                                : 'hover:bg-surface-container-low/50'
                            }`}
                          >
                            {idx === 0 && (
                              <td
                                rowSpan={perms.length}
                                className="py-3 px-4 font-bold text-on-surface align-top bg-surface-container-low/30"
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-label-sm font-bold text-primary">
                                  {moduleName}
                                </span>
                              </td>
                            )}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-on-surface">{p.name}</div>
                              {p.description && (
                                <div className="text-[11px] text-outline mt-0.5">
                                  {p.description}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-primary font-semibold">
                              {p.code}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${
                                  checked
                                    ? 'bg-primary-container text-on-primary'
                                    : 'bg-surface-container text-outline'
                                }`}
                              >
                                {checked && (
                                  <span className="material-symbols-outlined text-[15px]">
                                    check
                                  </span>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Counter & Security Status */}
              <div className="px-6 py-3.5 bg-surface-container-low/70 flex flex-wrap items-center justify-between gap-2 text-body-sm">
                <span className="text-on-surface-variant">
                  Tổng quyền đang kích hoạt cho{' '}
                  <strong className="font-mono text-on-surface">{selectedRole.roleCode}</strong>:{' '}
                  <strong className="font-mono text-primary">
                    {draftPerms.length}/{permissions.length}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-label-sm font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  Redis Instant Sync · Ready
                </span>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-on-surface-variant text-body-md">
              Chọn một vai trò bên trái để cấu hình quyền hạn
            </div>
          )}
        </section>
      </div>

      {/* Dialog Thêm / Sao chép vai trò */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {cloneSourceId ? 'Sao chép cấu hình vai trò' : 'Tạo vai trò mới'}
            </DialogTitle>
            <DialogDescription>
              Định nghĩa mã vai trò viết hoa (vd: EXECUTIVE_VIEWER) và tên hiển thị
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrCloneRole} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mã vai trò (Code) *</label>
              <Input
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                placeholder="ORDER_SPECIALIST"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tên vai trò *</label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Chuyên viên xử lý đơn hàng"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mô tả</label>
              <Input
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Mô tả phạm vi trách nhiệm"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-primary-container hover:bg-primary text-white">
                Lưu vai trò
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác thực thay đổi quyền nhạy cảm */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <span className="material-symbols-outlined text-[22px]">gpp_maybe</span>
              Xác nhận cập nhật ma trận RBAC động
            </DialogTitle>
            <DialogDescription>
              Cấu hình mới sẽ tăng <strong>permissionVersion</strong>, xóa cache Redis và có hiệu
              lực ngay ở request tiếp theo đối với tất cả nhân sự thuộc vai trò{' '}
              <strong>{selectedRole?.roleName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaveOpen(false)}>
              Kiểm tra lại
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={saving}
              className="bg-primary-container hover:bg-primary text-white"
            >
              {saving ? 'Đang áp dụng...' : 'Xác nhận & Áp dụng ngay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
