import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/store/auth-context';
import { RealtimeProvider } from '@/store/realtime-context';

export const metadata: Metadata = {
  title: 'LOGAI — Hệ Sinh Thái Quản Trị & Điều Phối Kho Vận AI',
  description: 'Hệ thống quản trị và điều phối kho vận đa chi nhánh tích hợp AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
        <AuthProvider>
          <RealtimeProvider>
            {children}
            <Toaster position="top-right" richColors />
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
