'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InventoryTicketItem } from '@/types/operations';

interface ThermalTicketPrinterProps {
  ticket: InventoryTicketItem;
  label?: string;
}

export function ThermalTicketPrinter({
  ticket,
  label = 'In phiếu nhiệt 80mm',
}: ThermalTicketPrinterProps) {
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: ticket.code,
  });

  const title =
    ticket.type === 'IMPORT'
      ? 'PHIẾU NHẬP KHO'
      : ticket.type === 'EXPORT'
      ? 'PHIẾU XUẤT KHO'
      : 'PHIẾU ĐIỀU CHỈNH KHO';

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handlePrint()}>
        <Printer className="h-4 w-4 mr-1.5" />
        {label}
      </Button>

      {/* Khổ giấy nhiệt 80mm ẩn trên màn hình, chỉ hiển thị khi in */}
      <div className="hidden">
        <div
          ref={printRef}
          className="w-[80mm] p-3 font-mono text-[11px] text-black bg-white"
        >
          <div className="text-center border-b border-dashed border-black pb-2">
            <p className="font-bold text-sm">LOGAI WAREHOUSE</p>
            <p className="font-bold text-xs mt-0.5">{title}</p>
            <p>Mã: {ticket.code}</p>
            <p>Ngày: {new Date(ticket.createdAt).toLocaleString('vi-VN')}</p>
          </div>

          <div className="py-2 border-b border-dashed border-black space-y-0.5">
            <p>Kho: {ticket.branch.code} - {ticket.branch.name}</p>
            <p>Người lập: {ticket.creator.fullName}</p>
            {ticket.supplierName && <p>NCC: {ticket.supplierName}</p>}
            {ticket.reason && <p>Lý do: {ticket.reason}</p>}
          </div>

          <table className="w-full my-2 text-[10px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">SKU / SP</th>
                <th className="py-1">Kệ</th>
                <th className="py-1 text-right">SL</th>
              </tr>
            </thead>
            <tbody>
              {ticket.details.map((d) => (
                <tr key={d.id} className="border-b border-dotted border-gray-400">
                  <td className="py-1 pr-1">
                    <div className="font-bold">{d.product.sku}</div>
                    <div>{d.product.name}</div>
                    <div>Lô: {d.batchNo}</div>
                  </td>
                  <td className="py-1 align-top">{d.bin.code}</td>
                  <td className="py-1 text-right align-top font-bold">
                    {d.qty} {d.product.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between pt-2 border-t border-dashed border-black">
            <div className="space-y-4">
              <p>Chữ ký thủ kho</p>
              <p className="text-[9px] text-gray-600">(Ký, ghi rõ họ tên)</p>
            </div>
            <QRCodeSVG value={ticket.code} size={52} />
          </div>
        </div>
      </div>
    </>
  );
}
