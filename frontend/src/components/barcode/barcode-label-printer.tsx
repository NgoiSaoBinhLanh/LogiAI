'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
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
import { ProductItem } from '@/types/operations';

interface BarcodeLabelPrinterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
}

export function BarcodeLabelPrinter({
  open,
  onOpenChange,
  product,
}: BarcodeLabelPrinterProps) {
  const [printer, setPrinter] = useState('Zebra ZD421 Thermal (USB - Online)');
  const [labelSize, setLabelSize] = useState<'50x30' | '58mm' | '80mm'>('50x30');
  const [quantity, setQuantity] = useState(1);
  const [showName, setShowName] = useState(true);
  const [showSkuZone, setShowSkuZone] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [includeQr, setIncludeQr] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !product || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, product.barcode || product.sku, {
        format: 'CODE128',
        width: 1.6,
        height: 42,
        displayValue: true,
        fontSize: 11,
        margin: 4,
      });
    } catch {
      // Fallback nếu chuỗi chứa ký tự không hợp lệ
    }
  }, [open, product, labelSize]);

  const handlePrint = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: `Tem_${product?.sku || 'SKU'}`,
    onAfterPrint: () => {
      toast.success(`Đã gửi lệnh in ${quantity} tem mã vạch tới ${printer}`);
      onOpenChange(false);
    },
  });

  if (!product) return null;

  const widthClass =
    labelSize === '50x30' ? 'w-[230px]' : labelSize === '58mm' ? 'w-[245px]' : 'w-[300px]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-headline-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">print</span>
            Cấu hình In Tem Nhãn Mã Vạch —{' '}
            <span className="font-mono text-primary">{product.sku}</span>
          </DialogTitle>
          <DialogDescription>
            Chuẩn hóa Code128 &amp; QR Code tương thích máy in nhiệt khổ 50×30mm / 58mm / 80mm
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2 pt-2">
          {/* Cột cấu hình */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-label-md font-semibold text-on-surface-variant">
                Máy in nhiệt
              </label>
              <Select
                value={printer}
                onChange={(e) => setPrinter(e.target.value)}
                options={[
                  {
                    value: 'Zebra ZD421 Thermal (USB - Online)',
                    label: 'Zebra ZD421 Thermal (Online)',
                  },
                  {
                    value: 'Xprinter XP-350B 80mm (LAN - Online)',
                    label: 'Xprinter XP-350B 80mm (Online)',
                  },
                  { value: 'Trình in trình duyệt / PDF', label: 'Trình in hệ thống / PDF' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface-variant">
                  Kích thước tem
                </label>
                <Select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value as '50x30' | '58mm' | '80mm')}
                  options={[
                    { value: '50x30', label: '50 × 30 mm' },
                    { value: '58mm', label: 'Khổ nhiệt 58 mm' },
                    { value: '80mm', label: 'Khổ nhiệt 80 mm' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-md font-semibold text-on-surface-variant">
                  Số lượng tem
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-surface-container-low p-3.5">
              <p className="text-label-md font-bold text-on-surface">
                Tùy chọn hiển thị trên tem
              </p>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={showName} onCheckedChange={(c) => setShowName(c === true)} />
                In tên sản phẩm
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={showSkuZone}
                  onCheckedChange={(c) => setShowSkuZone(c === true)}
                />
                In mã SKU &amp; Danh mục
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={showPrice} onCheckedChange={(c) => setShowPrice(c === true)} />
                In giá niêm yết ({product.unitPrice.toLocaleString('vi-VN')} đ)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={includeQr} onCheckedChange={(c) => setIncludeQr(c === true)} />
                Kèm QR Code truy xuất nhanh
              </label>
            </div>

            <div className="flex items-center justify-between text-xs text-outline">
              <span>Chuẩn mã hóa: Code128</span>
              <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-mono font-bold">
                Hàng đợi: {quantity} tem
              </span>
            </div>
          </div>

          {/* Cột Xem trước tem 1:1 (dot-grid preview per QuanLySanPhamVaInTem.html) */}
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-5"
            style={{
              backgroundImage: 'radial-gradient(#c4c5d7 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          >
            <span className="mb-3 px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-[10px] font-mono font-bold uppercase tracking-wider text-primary shadow-xs">
              1:1 LIVE THERMAL PREVIEW
            </span>
            <div ref={printAreaRef} className="space-y-2">
              {Array.from({ length: Math.min(quantity, 1) }).map((_, idx) => (
                <div
                  key={idx}
                  className={`${widthClass} rounded-lg bg-white p-3 text-slate-900 shadow-md print:shadow-none`}
                >
                  {showName && (
                    <p className="text-xs font-bold leading-tight line-clamp-2">{product.name}</p>
                  )}
                  {showSkuZone && (
                    <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                      SKU: {product.sku} · {product.category.code}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <svg ref={svgRef} className="max-w-full" />
                    {includeQr && (
                      <QRCodeSVG
                        value={JSON.stringify({ sku: product.sku, barcode: product.barcode })}
                        size={44}
                      />
                    )}
                  </div>
                  {showPrice && (
                    <p className="mt-1 border-t border-slate-200 pt-1 text-right text-xs font-mono font-bold">
                      {product.unitPrice.toLocaleString('vi-VN')} VNĐ / {product.unit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy bỏ
          </Button>
          <Button
            onClick={() => handlePrint()}
            className="bg-primary-container hover:bg-primary text-white"
          >
            <span className="material-symbols-outlined text-[18px] mr-1.5">print</span>
            Lệnh in ({quantity} tem)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
