'use client';

import Link from 'next/link';
import { useHealth } from '@/hooks/use-health';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Server, Database, CheckCircle2, XCircle, AlertTriangle, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function HomePage() {
  const { data, loading, error, refetch } = useHealth();

  const handleRefresh = async () => {
    toast.promise(refetch(), {
      loading: 'Đang kiểm tra kết nối hệ thống...',
      success: 'Đã cập nhật trạng thái mới nhất!',
      error: 'Không thể kết nối đến Backend',
    });
  };

  const isServerHealthy = data?.services.server.status === 'healthy';
  const isDbConnected = data?.services.database.status === 'connected';

  return (
    <main className="min-h-screen bg-slate-50/60 p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Hệ Thống Quản Trị CS445 Full-stack
            </h1>
            <p className="mt-1 text-slate-500">
              Kiến trúc Monorepo: Next.js App Router + Express.js + Prisma ORM + PostgreSQL
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Kiểm tra lại kết nối
            </Button>
            <Link href="/login">
              <Button className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Đăng nhập LOGAI
              </Button>
            </Link>
          </div>
        </div>

        {/* Trạng thái lỗi toàn cục */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <XCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Mất kết nối Backend API</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Cards trạng thái các service */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card Backend Server */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Backend API Server</CardTitle>
              <Server className="h-5 w-5 text-slate-500" />
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Trạng thái:</span>
                {isServerHealthy ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Hoạt động bình thường
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Mất kết nối
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Thời gian chạy (Uptime):</span>
                <span className="font-medium text-slate-800">
                  {data?.uptimeSeconds !== undefined ? `${data.uptimeSeconds}s` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Bộ nhớ (Heap Used):</span>
                <span className="font-medium text-slate-800">
                  {data?.services.server.memoryUsageMb !== undefined
                    ? `${data.services.server.memoryUsageMb} MB`
                    : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card Database PostgreSQL */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">PostgreSQL Database</CardTitle>
              <Database className="h-5 w-5 text-slate-500" />
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Trạng thái:</span>
                {isDbConnected ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Đã kết nối (Prisma)
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Chưa kết nối (Chạy docker compose)
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Độ trễ truy vấn (Latency):</span>
                <span className="font-medium text-slate-800">
                  {data?.services.database.latencyMs !== undefined
                    ? `${data.services.database.latencyMs} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">ORM Provider:</span>
                <span className="font-medium text-slate-800">Prisma (PostgreSQL)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bảng chi tiết thông tin hệ thống */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Chi Tiết Cấu Hình Dịch Vụ</CardTitle>
            <CardDescription>
              Thông số cấu hình môi trường phát triển hiện tại tại local
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Phân hệ</TableHead>
                  <TableHead>Địa chỉ (Endpoint / Host)</TableHead>
                  <TableHead>Công nghệ</TableHead>
                  <TableHead className="text-right">Tình trạng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Frontend Web</TableCell>
                  <TableCell>http://localhost:3000</TableCell>
                  <TableCell>Next.js 14, Tailwind, Shadcn/UI</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">Client Ready</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Backend API</TableCell>
                  <TableCell>http://localhost:5000/api/health</TableCell>
                  <TableCell>Express.js, TypeScript, Helmet, Zod</TableCell>
                  <TableCell className="text-right">
                    {isServerHealthy ? (
                      <Badge variant="success">Online</Badge>
                    ) : (
                      <Badge variant="destructive">Offline</Badge>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Cơ sở dữ liệu</TableCell>
                  <TableCell>localhost:5432 (cs445_db)</TableCell>
                  <TableCell>PostgreSQL 16 (Docker Compose)</TableCell>
                  <TableCell className="text-right">
                    {isDbConnected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Badge variant="warning">Standby</Badge>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bộ nhớ đệm / Queue</TableCell>
                  <TableCell>localhost:6379</TableCell>
                  <TableCell>Redis 7 (Docker Compose)</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">Optional Ready</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
