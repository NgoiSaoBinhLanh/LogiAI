'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
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

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  title?: string;
  description?: string;
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
  title = 'Quét mã vạch / QR Code',
  description = 'Hướng camera về phía mã vạch sản phẩm/phiếu hoặc nhập mã thủ công bên dưới',
}: BarcodeScannerDialogProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'logai-html5-qrcode-reader';

  useEffect(() => {
    if (!open) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            setScanning(false);
          });
      }
      return;
    }

    let cancelled = false;
    const startTimer = setTimeout(async () => {
      try {
        setCameraError(null);
        const element = document.getElementById(regionId);
        if (!element || cancelled) return;

        const html5Qr = new Html5Qrcode(regionId);
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 140 } },
          (decodedText) => {
            onDetected(decodedText.trim());
            onOpenChange(false);
          },
          () => {
            // Bỏ qua frame không nhận diện được
          }
        );
        if (!cancelled) setScanning(true);
      } catch {
        if (!cancelled) {
          setCameraError(
            'Không thể truy cập camera thiết bị. Vui lòng cấp quyền camera hoặc nhập mã thủ công.'
          );
          setScanning(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onDetected, onOpenChange]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    onDetected(code);
    setManualCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 min-h-[220px] flex items-center justify-center">
            <div id={regionId} className="w-full" />
            {!scanning && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-xs gap-2">
                <Camera className="h-6 w-6 animate-pulse" />
                <span>Đang khởi động camera...</span>
              </div>
            )}
            {cameraError && (
              <div className="p-4 text-center text-xs text-amber-300">{cameraError}</div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              Hoặc nhập mã SKU / Barcode thủ công (Máy quét RF USB):
            </label>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Quét hoặc gõ mã (vd: 8935001000011)"
                autoFocus
              />
              <Button type="submit">Xác nhận</Button>
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
