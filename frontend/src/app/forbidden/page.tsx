'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="max-w-md w-full text-center shadow-md border-red-200">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="text-sm font-bold uppercase tracking-widest text-red-600">
            HTTP 403 Forbidden
          </div>
          <CardTitle className="text-2xl">Không có quyền truy cập</CardTitle>
          <CardDescription>
            Vai trò hiện tại của bạn chưa được cấp quyền truy cập vào phân hệ này theo ma trận RBAC động. Vui lòng liên hệ Quản trị viên hệ thống nếu bạn cần bổ sung quyền.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3 pt-2">
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay về Dashboard
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Đổi tài khoản</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
