'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/services/api';
import { BranchesApi, RbacApi, UsersApi } from '@/services/iam.service';
import { BranchSummary, RoleItem, UserAccountItem } from '@/types/auth';
import { useAuth } from '@/store/auth-context';
import { exportToExcel } from '@/lib/export-utils';

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserAccountItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dialog Tạo/Sửa nhân sự (UI05)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccountItem | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');
  const [formSendEmail, setFormSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, bRes] = await Promise.all([
        UsersApi.list({
          search: search || undefined,
          branchId: filterBranch || undefined,
          roleId: filterRole || undefined,
          status: filterStatus || undefined,
        }),
        RbacApi.listRoles().catch(() => ({ roles: [] as RoleItem[] })),
        BranchesApi.list().catch(() => ({ branches: [] as BranchSummary[] })),
      ]);
      setUsers(uRes.items);
      setRoles(rRes.roles);
      setBranches(bRes.branches);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [search, filterBranch, filterRole, filterStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormFullName('');
    setFormPhone('');
    setFormEmail('');
    setFormRoleId(roles[0]?.id || '');
    setFormBranchId('');
    setFormSendEmail(true);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (u: UserAccountItem) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormFullName(u.fullName);
    setFormPhone(u.phone);
    setFormEmail(u.email);
    setFormRoleId(u.roleId);
    setFormBranchId(u.branchId || '');
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editingUser) {
        await UsersApi.update(editingUser.id, {
          fullName: formFullName,
          phone: formPhone,
          email: formEmail,
          roleId: formRoleId,
          branchId: formBranchId || null,
        });
        toast.success('Đã cập nhật tài khoản và đồng bộ quyền RBAC!');
      } else {
        const res = await UsersApi.create({
          username: formUsername,
          fullName: formFullName,
          phone: formPhone,
          email: formEmail,
          roleId: formRoleId,
          branchId: formBranchId || null,
          sendEmail: formSendEmail,
        });
        toast.success(
          res.temporaryPassword
            ? `Đã tạo tài khoản! Mật khẩu tạm: ${res.temporaryPassword}`
            : 'Đã tạo tài khoản nhân viên mới!'
        );
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Lưu tài khoản thất bại';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u: UserAccountItem) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await UsersApi.updateStatus(u.id, nextStatus);
      toast.success(
        nextStatus === 'ACTIVE'
          ? `Đã mở khóa tài khoản ${u.username}`
          : `Đã khóa tài khoản ${u.username} và thu hồi mọi phiên`
      );
      fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể thay đổi trạng thái');
    }
  };

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const lockedCount = users.filter((u) => u.status !== 'ACTIVE').length;

  return (
    <AppShell>
      {/* Full-bleed Sub-header Context Strip (QuanLyTaiKhoan.html) */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 mb-6 bg-surface-container-lowest/95 px-6 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-label-md text-outline">
            <span>Quản trị hệ thống</span>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-primary font-semibold">Danh sách Nhân sự &amp; Tài khoản</span>
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary text-[11px] font-bold font-mono">
              {users.length} nhân sự
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Điều phối danh tính, gán phạm vi chi nhánh và kích hoạt thay đổi quyền RBAC tức thì
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              exportToExcel(
                'nhan-su-he-thong',
                'NhanSu',
                users.map((u) => ({
                  Username: u.username,
                  HoTen: u.fullName,
                  Email: u.email,
                  SDT: u.phone,
                  VaiTro: u.role.roleName,
                  ChiNhanh: u.branch ? `${u.branch.code} - ${u.branch.name}` : 'Toàn hệ thống',
                  TrangThai: u.status,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface px-3.5 py-2 text-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Xuất Excel</span>
          </button>

          <PermissionGuard permission="USER_WRITE">
            <button
              type="button"
              onClick={openCreateDialog}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-2 text-label-md font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Tạo tài khoản</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="space-y-6">
        {/* 4 Quick Metric Cards Grid (QuanLyTaiKhoan.html) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Đang hoạt động
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                {activeCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#10B981] text-[22px]">
                check_circle
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Hub &amp; Chi nhánh
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                {branches.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                location_on
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Tài khoản khóa / Tạm ngưng
              </div>
              <div className="text-headline-md font-mono font-bold text-error mt-1">
                {lockedCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-[22px]">lock</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center justify-between">
            <div>
              <div className="text-label-sm uppercase text-outline font-semibold">
                Vai trò phân quyền
              </div>
              <div className="text-headline-md font-mono font-bold text-on-surface mt-1">
                {roles.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                admin_panel_settings
              </span>
            </div>
          </div>
        </div>

        {/* Tonal Filter Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm tên, username, email, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-[560px]">
            <Select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              placeholder="Tất cả chi nhánh"
              options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
            />
            <Select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              placeholder="Tất cả vai trò"
              options={roles.map((r) => ({ value: r.id, label: r.roleName }))}
            />
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              placeholder="Tất cả trạng thái"
              options={[
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'SUSPENDED', label: 'Đang tạm khóa' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
            />
          </div>

          {(search || filterBranch || filterRole || filterStatus) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterBranch('');
                setFilterRole('');
                setFilterStatus('');
              }}
              title="Đặt lại bộ lọc"
              className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center gap-1 text-label-md font-semibold shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* High-Density Data Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b border-surface-container-low">
            <div>
              <h2 className="text-headline-sm font-bold text-on-surface">
                Hồ sơ Tài khoản Hệ thống ({users.length})
              </h2>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Mọi thay đổi vai trò hoặc khóa tài khoản có hiệu lực tức thì qua RBAC động
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase">
                  <th className="py-3 pl-6 pr-3 font-semibold">Nhân sự / Tài khoản</th>
                  <th className="py-3 px-3 font-semibold">Liên hệ</th>
                  <th className="py-3 px-3 font-semibold">Chi nhánh công tác</th>
                  <th className="py-3 px-3 font-semibold">Vai trò</th>
                  <th className="py-3 px-3 font-semibold">Trạng thái</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-outline">
                      Đang tải danh sách nhân sự...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-outline">
                      Không tìm thấy nhân sự phù hợp
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isActive = u.status === 'ACTIVE';
                    const isSelf = u.id === currentUser?.userId;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-surface-container-low/50 transition-colors"
                      >
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-on-surface">{u.fullName}</div>
                              <div className="text-[11px] font-mono text-outline">
                                @{u.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-xs text-on-surface">{u.email}</div>
                          <div className="text-[11px] font-mono text-outline mt-0.5">{u.phone}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low text-xs font-medium text-on-surface">
                            <span className="material-symbols-outlined text-[14px] text-primary">
                              location_on
                            </span>
                            {u.branch ? `${u.branch.code} · ${u.branch.name}` : 'Toàn hệ thống'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-primary-fixed text-primary text-[11px] font-bold">
                            {u.role.roleName}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isActive
                                ? 'bg-[#ECFDF5] text-[#10B981]'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-[#10B981]' : 'bg-error'
                              }`}
                            />
                            {isActive ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                        </td>
                        <td className="py-3.5 pl-3 pr-6 text-right">
                          <PermissionGuard permission="USER_WRITE">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditDialog(u)}
                                title="Chỉnh sửa tài khoản"
                                className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-primary-fixed text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleToggleStatus(u)}
                                title={
                                  isSelf
                                    ? 'Không thể khóa tài khoản đang đăng nhập'
                                    : isActive
                                      ? 'Khóa tài khoản'
                                      : 'Mở khóa tài khoản'
                                }
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-35 ${
                                  isActive
                                    ? 'bg-error-container/60 hover:bg-error-container text-on-error-container'
                                    : 'bg-[#ECFDF5] hover:bg-emerald-100 text-[#10B981]'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {isActive ? 'lock' : 'lock_open'}
                                </span>
                              </button>
                            </div>
                          </PermissionGuard>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tạo / Sửa tài khoản (QuanLyTaiKhoan.html) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-headline-sm">
              <span className="material-symbols-outlined text-primary text-[22px]">
                manage_accounts
              </span>
              {editingUser ? `Cập nhật nhân sự @${editingUser.username}` : 'Tạo tài khoản mới'}
            </DialogTitle>
            <DialogDescription>
              Gán vai trò RBAC và phạm vi chi nhánh làm việc cho nhân viên
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4">
            {formError && (
              <div
                className="rounded-lg bg-error-container/80 px-3.5 py-2.5 text-xs font-medium text-on-error-container flex items-center gap-2"
                style={{ boxShadow: 'inset 4px 0 0 0 #ba1a1a' }}
              >
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Họ và tên *
                </label>
                <Input
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Tên đăng nhập *
                </label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="nv_a"
                  disabled={!!editingUser}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Email doanh nghiệp *
                </label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="nva@cs445.local"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Số điện thoại *
                </label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0909123456"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Vai trò phân quyền *
                </label>
                <Select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  required
                  options={roles.map((r) => ({ value: r.id, label: r.roleName }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Chi nhánh công tác
                </label>
                <Select
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  placeholder="Toàn mạng lưới (Head Office)"
                  options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
                />
              </div>
            </div>

            {!editingUser && (
              <div className="flex items-center space-x-2 rounded-lg bg-surface-container-low p-3">
                <Checkbox
                  id="sendEmail"
                  checked={formSendEmail}
                  onCheckedChange={(c) => setFormSendEmail(c === true)}
                />
                <label htmlFor="sendEmail" className="text-xs text-on-surface-variant cursor-pointer">
                  Tự động tạo mật khẩu tạm thời và gửi thông tin kích hoạt qua email
                </label>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary-container hover:bg-primary text-white"
              >
                {saving ? 'Đang lưu...' : 'Lưu tài khoản'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
