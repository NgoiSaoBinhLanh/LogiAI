'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth-context';
import { useRealtime } from '@/store/realtime-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href: string;
  iconName: string;
  anyPermissions: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Tổng quan & AI',
    items: [
      {
        label: 'Tổng quan KPIs',
        href: '/dashboard',
        iconName: 'dashboard',
        anyPermissions: ['STOCK_READ', 'ORDER_READ', 'BRANCH_READ'],
      },
      {
        label: 'Dự báo & Cảnh báo AI',
        href: '/ai/forecast',
        iconName: 'auto_awesome',
        anyPermissions: ['ALERT_MANAGE', 'STOCK_READ'],
      },
      {
        label: 'Đề xuất điều chuyển AI',
        href: '/ai/transfer-optimization',
        iconName: 'swap_horiz',
        anyPermissions: ['ALERT_MANAGE', 'TRANSFER_TRACK'],
      },
      {
        label: 'Trung tâm Cảnh báo Realtime',
        href: '/alerts',
        iconName: 'notifications_active',
        anyPermissions: ['ALERT_MANAGE', 'STOCK_READ', 'ORDER_READ', 'TRANSFER_TRACK'],
      },
    ],
  },
  {
    title: 'Mạng lưới & Danh mục',
    items: [
      {
        label: 'Mạng lưới Kho & Hub',
        href: '/branches',
        iconName: 'warehouse',
        anyPermissions: ['BRANCH_READ', 'BRANCH_WRITE'],
      },
      {
        label: 'Sản phẩm & Mã vạch',
        href: '/products',
        iconName: 'qr_code_2',
        anyPermissions: ['PRODUCT_READ', 'PRODUCT_WRITE'],
      },
      {
        label: 'Tồn kho toàn chuỗi',
        href: '/inventory/stocks',
        iconName: 'inventory_2',
        anyPermissions: ['STOCK_READ'],
      },
    ],
  },
  {
    title: 'Vận hành Kho & Đơn hàng',
    items: [
      {
        label: 'Nhập kho (Receiving)',
        href: '/inventory/inbound',
        iconName: 'forklift',
        anyPermissions: ['TICKET_CREATE'],
      },
      {
        label: 'Xuất kho (FEFO Picking)',
        href: '/inventory/outbound',
        iconName: 'shopping_cart_checkout',
        anyPermissions: ['TICKET_CREATE'],
      },
      {
        label: 'Kiểm kê kho',
        href: '/inventory/stock-checks',
        iconName: 'fact_check',
        anyPermissions: ['TICKET_CREATE', 'STOCK_READ'],
      },
      {
        label: 'Phân bổ đơn hàng',
        href: '/orders/allocation',
        iconName: 'call_split',
        anyPermissions: ['ORDER_ALLOCATE', 'ORDER_READ'],
      },
      {
        label: 'Kanban Đóng gói & SLA',
        href: '/orders/kanban',
        iconName: 'view_kanban',
        anyPermissions: ['ORDER_READ', 'ORDER_ALLOCATE'],
      },
      {
        label: 'Giám sát Đội xe GPS',
        href: '/transfers/fleet',
        iconName: 'local_shipping',
        anyPermissions: ['TRANSFER_TRACK'],
      },
    ],
  },
  {
    title: 'Phê duyệt Chi nhánh',
    items: [
      {
        label: 'Duyệt Kiểm kê tồn kho',
        href: '/approvals/stock-checks',
        iconName: 'rule',
        anyPermissions: ['TICKET_APPROVE'],
      },
      {
        label: 'Duyệt Lệnh điều chuyển',
        href: '/approvals/transfers',
        iconName: 'approval_delegation',
        anyPermissions: ['TICKET_APPROVE'],
      },
    ],
  },
  {
    title: 'Quản trị Hệ thống',
    items: [
      {
        label: 'Quản lý Nhân sự',
        href: '/users',
        iconName: 'manage_accounts',
        anyPermissions: ['USER_READ', 'USER_WRITE'],
      },
      {
        label: 'Phân quyền RBAC',
        href: '/settings/rbac',
        iconName: 'admin_panel_settings',
        anyPermissions: ['ROLE_MANAGE'],
      },
      {
        label: 'Nhật ký Audit Logs',
        href: '/audit-logs',
        iconName: 'history',
        anyPermissions: ['AUDIT_READ'],
      },
    ],
  },
];

const ROUTE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Tổng quan Điều hành & KPIs Mạng lưới',
    subtitle: 'Giám sát hiệu suất kho vận theo thời gian thực',
  },
  '/ai/forecast': {
    title: 'Branch AI Dashboard — Dự báo & Cảnh báo Tồn kho',
    subtitle: 'Phân tích chuỗi thời gian AI & Đề xuất nhập hàng tự động',
  },
  '/ai/transfer-optimization': {
    title: 'Đề xuất Điều chuyển Tối ưu bằng AI',
    subtitle: 'Cân bằng tồn kho liên chi nhánh & Giảm thiểu chi phí logistics',
  },
  '/alerts': {
    title: 'Trung tâm Cảnh báo Realtime',
    subtitle: 'Giám sát cảnh báo tồn kho thấp, FEFO & đơn chậm SLA',
  },
  '/branches': {
    title: 'Mạng lưới Chi nhánh & Sơ đồ Kho (WMS)',
    subtitle: 'Quản lý Hub, Zones & Bin lưu trữ toàn hệ thống',
  },
  '/products': {
    title: 'Quản lý Sản phẩm & In Tem Mã vạch',
    subtitle: 'Danh mục SKU, Barcode & Giám sát ngưỡng tồn toàn chuỗi',
  },
  '/inventory/stocks': {
    title: 'Tồn kho Chi tiết & Lô hàng FEFO',
    subtitle: 'Theo dõi lô, hạn sử dụng & Vị trí kệ từng chi nhánh',
  },
  '/inventory/inbound': {
    title: 'Xử lý Nhập kho (Receiving Cockpit)',
    subtitle: 'Quét mã vạch tốc độ cao & Chỉ dẫn lưu kệ thông minh',
  },
  '/inventory/outbound': {
    title: 'Xử lý Xuất kho (FEFO Picking)',
    subtitle: 'Lộ trình lấy hàng tối ưu theo Zone & Lô hết hạn trước',
  },
  '/inventory/stock-checks': {
    title: 'Kiểm kê Kho (Stock Audit)',
    subtitle: 'Khởi tạo phiếu kiểm kê & Đối chiếu số liệu thực tế',
  },
  '/orders/allocation': {
    title: 'Điều phối & Phân bổ Đơn hàng AI',
    subtitle: 'Tự động định tuyến chi nhánh xuất hàng tối ưu SLA',
  },
  '/orders/kanban': {
    title: 'Giám sát Đóng gói & SLA Realtime',
    subtitle: 'Bảng điều phối Kanban đa kênh & Cảnh báo trễ SLA',
  },
  '/transfers/fleet': {
    title: 'Giám sát Vận chuyển Thời gian thực (GPS Fleet)',
    subtitle: 'Bản đồ hành trình & Telemetry xe trung chuyển liên chi nhánh',
  },
  '/approvals/stock-checks': {
    title: 'Phê duyệt Phiếu Kiểm kê & Đối chiếu Tài chính',
    subtitle: 'Hạch toán chênh lệch kiểm kê & Khoá sổ chi nhánh',
  },
  '/approvals/transfers': {
    title: 'Quản lý Luân chuyển Liên Chi nhánh',
    subtitle: 'Phê duyệt điều chuyển nội bộ & Giám sát tồn kho an toàn',
  },
  '/users': {
    title: 'Quản lý Nhân sự & Tài khoản Hệ thống',
    subtitle: 'Điều phối danh tính nhân sự & Phạm vi chi nhánh',
  },
  '/settings/rbac': {
    title: 'Phân quyền Truy cập Hệ thống (RBAC)',
    subtitle: 'Ma trận phân quyền chi tiết & Chính sách cách ly chi nhánh',
  },
  '/audit-logs': {
    title: 'Nhật ký Hoạt động Hệ thống (Audit Logs)',
    subtitle: 'Truy vết bất biến SHA-256 & Đối chiếu Snapshot dữ liệu',
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, hasAnyPermission, refreshUserPermissions } = useAuth();
  const { alerts, unresolvedRed, unresolvedYellow, connected, triggerScan, resolveAlert } =
    useRealtime();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-5 py-3.5 text-on-surface shadow-sm">
          <span className="material-symbols-outlined animate-spin text-primary text-[20px]">
            progress_activity
          </span>
          <span className="text-body-md font-medium">Đang tải không gian làm việc LOGAI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6">
        <p className="text-on-surface-variant font-medium">Phiên đăng nhập chưa được xác thực.</p>
        <Link href="/login">
          <Button className="bg-primary-container hover:bg-primary text-white rounded-lg">
            Đi tới trang Đăng nhập
          </Button>
        </Link>
      </div>
    );
  }

  const activeRouteMeta =
    Object.entries(ROUTE_META).find(
      ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )?.[1] ?? {
      title: 'LogiAI Enterprise WMS',
      subtitle: 'Hệ sinh thái Quản trị & Điều phối Kho vận AI',
    };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-surface-container-lowest text-on-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top: Brand + User Profile */}
      <div>
        <div className="h-16 px-5 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-on-primary text-[20px]">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[15px] tracking-tight text-on-surface leading-tight">
                  LogiAI
                </span>
                <span className="rounded bg-primary-fixed px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  OS
                </span>
              </div>
              <div className="text-[11px] font-medium text-outline leading-tight">
                Enterprise WMS Ecosystem
              </div>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* User Node Pill */}
        <div className="mx-3 mt-1 px-3 py-2.5 rounded-lg bg-surface-container-low flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">
              admin_panel_settings
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-label-md text-on-surface truncate">{user.fullName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                )}
              />
              <span className="text-[11px] text-secondary-slate font-medium truncate">
                Node: {user.roleCode}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {NAV_GROUPS.map((group, idx) => {
          const visibleItems = group.items.filter((item) =>
            hasAnyPermission(item.anyPermissions)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-0.5">
              <div
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider text-outline px-3 pb-1',
                  idx === 0 ? 'pt-1' : 'pt-3'
                )}
              >
                {group.title}
              </div>
              {visibleItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors overflow-hidden',
                      active
                        ? 'bg-secondary-container text-on-surface font-semibold'
                        : 'font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container" />
                    )}
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px] shrink-0',
                        active ? 'text-primary' : 'text-on-surface-variant'
                      )}
                    >
                      {item.iconName}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom Telemetry Card */}
      <div className="p-3 bg-surface-container-lowest">
        <div className="px-3 py-2 rounded-lg bg-surface-container-low flex items-center justify-between">
          <span className="text-label-sm font-medium text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">dns</span>
            System Telemetry
          </span>
          <span
            className={cn(
              'text-[11px] font-mono font-bold',
              connected ? 'text-emerald-700' : 'text-outline'
            )}
          >
            {connected ? '< 12ms' : 'Offline'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-outline">
          <span className="truncate">{user.branchName || 'Toàn mạng lưới'}</span>
          <span className="shrink-0 rounded bg-primary-fixed px-1.5 py-0.5 text-[10px] font-bold text-primary">
            RBAC v{user.permissionVersion}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[260px] shrink-0 lg:block lg:sticky lg:top-0 lg:h-screen z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-[260px] h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-surface-container-lowest/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-headline-sm font-bold text-on-surface truncate">
                {activeRouteMeta.title}
              </h1>
              <p className="text-[11px] text-on-surface-variant truncate">
                {activeRouteMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="hidden xl:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-surface-container-low text-[11px] font-semibold text-on-surface">
                {user.branchName || 'Phạm vi: Toàn hệ thống'}
              </span>
              <span className="px-2.5 py-1 rounded bg-primary-fixed text-[11px] font-bold text-primary">
                {user.roleCode}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  connected
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-surface-container-low text-on-surface-variant'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-outline'
                  )}
                />
                {connected ? 'Realtime Live' : 'Offline'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => refreshUserPermissions()}
              title="Đồng bộ quyền RBAC mới nhất"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors text-label-md font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span className="hidden md:inline">Đồng bộ quyền</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  {(unresolvedRed > 0 || unresolvedYellow > 0) && (
                    <span
                      className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm ${
                        unresolvedRed > 0 ? 'bg-error' : 'bg-amber-500'
                      }`}
                    >
                      {unresolvedRed + unresolvedYellow}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 p-0 rounded-xl shadow-xl border-0 bg-surface-container-lowest overflow-hidden"
              >
                <div className="flex items-center justify-between px-3.5 py-3 bg-surface-container-low">
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Cảnh báo Realtime (PB19/12/14)
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      <span className="text-error font-semibold">{unresolvedRed} Đỏ</span> ·{' '}
                      <span className="text-amber-600 font-semibold">{unresolvedYellow} Vàng</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-[11px] bg-white border-outline-variant/40"
                    onClick={() => triggerScan()}
                  >
                    Quét ngay
                  </Button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-surface-container-low">
                  {alerts.length === 0 ? (
                    <p className="p-4 text-center text-xs text-on-surface-variant">
                      Không có cảnh báo chưa xử lý
                    </p>
                  ) : (
                    alerts.slice(0, 6).map((a) => (
                      <div
                        key={a.id}
                        className={`p-3 text-xs space-y-1 border-l-4 ${
                          a.colorLevel === 'RED'
                            ? 'border-l-error bg-error-container/30'
                            : 'border-l-amber-500 bg-amber-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-on-surface line-clamp-1">
                            {a.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => resolveAlert(a.id)}
                            className="shrink-0 text-[10px] font-semibold text-primary-container hover:underline"
                          >
                            Xử lý
                          </button>
                        </div>
                        <p className="text-[11px] text-on-surface-variant line-clamp-2">
                          {a.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2.5 text-center bg-surface-container-lowest">
                  <Link
                    href="/alerts"
                    className="text-xs font-semibold text-primary-container hover:underline"
                  >
                    Xem toàn bộ trung tâm cảnh báo →
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2.5 rounded-lg bg-surface-container-low px-2.5 py-1.5 text-left transition-colors hover:bg-surface-container"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-white">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-bold text-on-surface leading-tight">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                      {user.email}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60 rounded-xl border-0 shadow-xl bg-surface-container-lowest"
              >
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-on-surface">{user.fullName}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Quyền hiện tại: {user.permissions.length} quyền (v{user.permissionVersion})
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-error focus:text-error focus:bg-error-container/30 font-medium cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full min-w-0">{children}</main>
      </div>
    </div>
  );
}
