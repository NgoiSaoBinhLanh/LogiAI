'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth-context';
import { AuthApi } from '@/services/iam.service';
import { ApiError } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', username: 'admin', role: 'ADMIN' },
  { label: 'Quản lý HCM', username: 'manager_hcm', role: 'BRANCH_MANAGER' },
  { label: 'Nhân viên Kho', username: 'staff_hcm', role: 'WAREHOUSE_STAFF' },
  { label: 'Điều phối viên', username: 'dispatcher_vn', role: 'DISPATCHER' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await login({ identifier, password, rememberMe });
      toast.success('Đăng nhập thành công!');
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ xác thực.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSending(true);
    try {
      await AuthApi.forgotPassword(forgotEmail);
      toast.success('Đã gửi hướng dẫn khôi phục mật khẩu nếu email tồn tại.');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Email không hợp lệ');
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-surface text-on-surface">
      {/* Left Column: 60% Hero Atmospheric Showcase (dangnhap.html) */}
      <div className="w-full lg:w-[60%] min-h-[260px] lg:min-h-screen relative overflow-hidden bg-inverse-surface flex flex-col justify-between p-8 md:p-12 lg:p-16 text-on-primary">
        {/* Atmospheric Radial Gradient + Subtle Architectural Overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 25%, rgba(29,78,216,0.52), transparent 55%), radial-gradient(circle at 82% 72%, rgba(33,81,218,0.40), transparent 58%), linear-gradient(135deg, rgba(11,28,48,0.92) 0%, rgba(0,55,176,0.55) 100%)',
          }}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-15"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="logi-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#b7c4ff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#logi-grid)" />
        </svg>

        {/* Top Brand Mark */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary-container flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-on-primary text-[26px]">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">LogiAI</span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded bg-primary-fixed text-primary">
                  ECOSYSTEM
                </span>
              </div>
              <p className="text-xs text-primary-fixed-dim/80 font-medium">
                Enterprise WMS &amp; Logistics Architecture
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-white/90">
              Mesh Node: Active
            </span>
          </div>
        </div>

        {/* Main Hero Display Copy */}
        <div className="relative z-10 my-8 lg:my-auto max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-primary-container/40 backdrop-blur-sm text-primary-fixed-dim text-label-md">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>Autonomous Core Architecture v4.2</span>
          </div>

          <h1 className="text-3xl md:text-headline-xl font-bold tracking-tight text-white leading-[1.18]">
            Điều phối Chuỗi Cung Ứng <br />
            <span className="text-primary-fixed-dim">Thông minh &amp; Tự động hóa</span>
          </h1>

          <p className="text-sm md:text-body-lg text-white/80 leading-relaxed max-w-xl">
            Nền tảng quản trị kho vận đa chi nhánh tích hợp AI: Dự báo nhu cầu thời gian thực,
            FEFO Picking chính xác tuyệt đối và Tối ưu hóa tồn kho tự động toàn hệ thống.
          </p>

          {/* Telemetry Mini Metrics Grid (Glassmorphism) */}
          <div className="grid grid-cols-3 gap-4 pt-2 max-w-lg">
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md">
              <div className="text-xl font-bold text-white font-mono">99.98%</div>
              <div className="text-label-sm text-primary-fixed-dim mt-0.5">Độ sẵn sàng hệ thống</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md">
              <div className="text-xl font-bold text-emerald-300 font-mono">&lt; 12ms</div>
              <div className="text-label-sm text-primary-fixed-dim mt-0.5">
                Tốc độ đồng bộ đa kho
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md">
              <div className="text-xl font-bold text-white font-mono">ISO 27001</div>
              <div className="text-label-sm text-primary-fixed-dim mt-0.5">
                Tiêu chuẩn bảo mật dữ liệu
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-white/60 font-medium pt-4">
          <span>© 2026 LOGIAI ENTERPRISE SYSTEMS.</span>
          <span className="hidden sm:inline">Hỗ trợ kỹ thuật 24/7 · Enterprise SLA</span>
        </div>
      </div>

      {/* Right Column: 40% Auth Container (dangnhap.html) */}
      <div className="w-full lg:w-[40%] bg-surface-container-lowest flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
        <div className="max-w-[420px] w-full mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-primary text-label-md">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Cổng xác thực an ninh</span>
            </div>
            <h2 className="text-headline-lg text-on-surface tracking-tight font-bold">
              Đăng nhập hệ thống
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Vui lòng nhập thông tin định danh doanh nghiệp để truy cập.
            </p>
          </div>

          {/* Error Feedback Banner matching dangnhap.html */}
          {errorMsg && (
            <div
              className="rounded-lg bg-error-container/90 px-4 py-3 text-body-sm font-medium text-on-error-container flex items-start gap-2.5"
              style={{ boxShadow: 'inset 4px 0 0 0 #ba1a1a' }}
            >
              <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">
                error
              </span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="identifier"
                className="block text-label-md font-semibold text-on-surface"
              >
                Tên đăng nhập / Email
              </label>
              <div className="relative flex items-center rounded-lg bg-surface-container-lowest transition-all shadow-[0_0_0_1px_#747686] focus-within:shadow-[0_0_0_2px_#0037b0]">
                <span className="material-symbols-outlined text-outline text-[19px] pl-3.5 shrink-0">
                  alternate_email
                </span>
                <input
                  id="identifier"
                  type="text"
                  placeholder="vd: admin hoặc admin@cs445.local"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full h-11 bg-transparent px-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-label-md font-semibold text-on-surface"
                >
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-label-md font-semibold text-primary hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative flex items-center rounded-lg bg-surface-container-lowest transition-all shadow-[0_0_0_1px_#747686] focus-within:shadow-[0_0_0_2px_#0037b0]">
                <span className="material-symbols-outlined text-outline text-[19px] pl-3.5 shrink-0">
                  password
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 bg-transparent px-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pr-3 text-outline hover:text-on-surface transition-colors"
                  aria-label="Hiện/ẩn mật khẩu"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-body-sm font-medium text-on-surface-variant cursor-pointer select-none"
                >
                  Ghi nhớ phiên đăng nhập
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-primary-container hover:bg-primary text-white font-semibold text-label-lg shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}</span>
            </Button>
          </form>

          {/* SSO Divider & Enterprise Identity Buttons */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-outline-variant/40" />
            </div>
            <div className="relative flex justify-center text-[11px] font-bold uppercase tracking-wider">
              <span className="bg-surface-container-lowest px-3 text-outline">
                Hoặc đăng nhập bằng SSO
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                toast.info(
                  'SSO Microsoft Azure AD yêu cầu cấu hình Tenant ID ở môi trường Enterprise.'
                )
              }
              className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container text-label-md font-semibold text-on-surface flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              <span>Azure AD</span>
            </button>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  'SSO Okta Identity Cloud yêu cầu cấu hình OIDC Client ở môi trường Enterprise.'
                )
              }
              className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container text-label-md font-semibold text-on-surface flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">shield</span>
              <span>Okta Cloud</span>
            </button>
          </div>

          {/* Demo Accounts Quick-Fill Box */}
          <div className="rounded-xl bg-surface-container-low p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-label-md font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  check_circle
                </span>
                Tài khoản Seed mẫu
              </p>
              <code className="text-[11px] font-mono bg-surface-container-lowest px-2 py-0.5 rounded text-primary font-semibold">
                Password@123
              </code>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setIdentifier(acc.username);
                    setPassword('Password@123');
                    setErrorMsg(null);
                  }}
                  className="rounded-lg bg-surface-container-lowest px-3 py-2 text-left hover:bg-primary-fixed/40 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="text-xs font-bold text-on-surface block">{acc.label}</span>
                  <span className="text-[11px] font-mono text-on-surface-variant">
                    {acc.username}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-medium text-outline flex items-center justify-center gap-1.5 pt-1">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">
              verified_user
            </span>
            Bảo mật cấp doanh nghiệp AES-256 &amp; Audit Traceability
          </p>
        </div>
      </div>

      {/* Dialog Quên mật khẩu */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-headline-sm">
              <span className="material-symbols-outlined text-primary text-[22px]">key</span>
              Khôi phục mật khẩu
            </DialogTitle>
            <DialogDescription>
              Nhập email doanh nghiệp đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="name@cs445.local"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              className="rounded-lg"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={forgotSending}
                className="bg-primary-container hover:bg-primary text-white"
              >
                {forgotSending ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
