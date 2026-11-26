'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { ApiError } from '@/services/api';
import { BranchOpsApi, FleetApi } from '@/services/operations.service';
import { BranchDetailItem, LiveFleetItem } from '@/types/operations';
import { useAuth } from '@/store/auth-context';

const DynamicFleetMap = dynamic(() => import('@/components/maps/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-surface-container-low text-sm text-on-surface-variant">
      Đang khởi tạo bản đồ GPS Leaflet...
    </div>
  ),
});

export default function FleetTrackingPage() {
  const { socket } = useAuth();
  const [branches, setBranches] = useState<BranchDetailItem[]>([]);
  const [vehicles, setVehicles] = useState<LiveFleetItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'IN_TRANSIT' | 'DELAYED'>('ALL');
  const [mapStyle, setMapStyle] = useState<'STREET' | 'SATELLITE'>('STREET');
  const [loading, setLoading] = useState(true);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fRes] = await Promise.all([BranchOpsApi.list(), FleetApi.listLive()]);
      setBranches(bRes.branches);
      setVehicles(fRes.items);
      if (fRes.items.length > 0 && !selectedId) {
        setSelectedId(fRes.items[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu đội xe GPS');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  // Đồng bộ GPS realtime qua WebSocket
  useEffect(() => {
    if (!socket) return;
    const onGpsUpdate = (payload: {
      transferId: string;
      code: string;
      latitude: number;
      longitude: number;
      speedKmh: number;
    }) => {
      toast.info(
        `GPS Live ${payload.code}: ${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}`
      );
      loadFleet();
    };
    socket.on('fleet:gps', onGpsUpdate);
    return () => {
      socket.off('fleet:gps', onGpsUpdate);
    };
  }, [socket, loadFleet]);

  const filteredVehicles = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchKw =
        !kw ||
        v.code.toLowerCase().includes(kw) ||
        (v.vehiclePlate || '').toLowerCase().includes(kw) ||
        (v.driverName || '').toLowerCase().includes(kw);
      const matchTab =
        tab === 'ALL'
          ? true
          : tab === 'IN_TRANSIT'
            ? v.status === 'IN_TRANSIT'
            : v.isDelayed;
      return matchKw && matchTab;
    });
  }, [vehicles, search, tab]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || null,
    [vehicles, selectedId]
  );

  // Mô phỏng cập nhật 1 bước GPS hướng về kho đích (hỗ trợ kiểm thử trực quan)
  const handleSimulateGpsStep = async (v: LiveFleetItem) => {
    const nextLat = v.currentLat + (v.destBranch.latitude - v.currentLat) * 0.25;
    const nextLng = v.currentLng + (v.destBranch.longitude - v.currentLng) * 0.25;
    try {
      await FleetApi.updateGps(v.id, {
        latitude: Number(nextLat.toFixed(6)),
        longitude: Number(nextLng.toFixed(6)),
        speedKmh: 64,
        note: `Di chuyển hướng về ${v.destBranch.code}`,
      });
      toast.success(`Đã cập nhật tọa độ GPS mới cho chuyến ${v.code}`);
      await loadFleet();
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật GPS thất bại');
    }
  };

  const inTransitCount = vehicles.filter((v) => v.status === 'IN_TRANSIT').length;
  const delayedCount = vehicles.filter((v) => v.isDelayed).length;

  return (
    <AppShell>
      {/* Full-bleed Split Viewport (GiamSatVanChuyenThoiGianThuc.html) */}
      <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Stream Panel (w-80 / w-96) */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-surface-container-lowest flex flex-col border-r border-surface-container-low overflow-hidden">
          <div className="p-4 space-y-3 border-b border-surface-container-low">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  local_shipping
                </span>
                <h2 className="text-headline-sm font-bold text-on-surface">
                  Đội xe Trực tuyến ({vehicles.length})
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                GPS Live
              </span>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-2.5">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã chuyến, biển số, tài xế..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-container-low pl-9 pr-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${vehicles.length})` },
                  { id: 'IN_TRANSIT', label: `Đang chạy (${inTransitCount})` },
                  { id: 'DELAYED', label: `Trễ ETA (${delayedCount})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-primary-container text-white shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-outline">Đang tải tọa độ xe...</div>
            ) : filteredVehicles.length === 0 ? (
              <div className="py-12 text-center text-xs text-outline">
                Không có chuyến vận chuyển phù hợp
              </div>
            ) : (
              filteredVehicles.map((v) => {
                const selected = v.id === selectedId;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`cursor-pointer rounded-xl p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all space-y-2.5 relative overflow-hidden ${
                      v.isDelayed
                        ? 'bg-[#FEF2F2]/80 border-l-4 border-error'
                        : selected
                          ? 'bg-secondary-container/45 border-l-4 border-primary-container'
                          : 'bg-surface-container-lowest hover:bg-surface-container-low/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-primary">{v.code}</span>
                      {v.isDelayed ? (
                        <span className="px-2 py-0.5 rounded-full bg-error text-white text-[10px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          Trễ ETA
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'IN_TRANSIT'
                              ? 'bg-primary-fixed text-primary'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {v.status}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                      <span>{v.sourceBranch.code}</span>
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        arrow_forward
                      </span>
                      <span>{v.destBranch.code}</span>
                      <span className="text-outline font-normal">·</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        {v.vehiclePlate || 'Xe nội bộ'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px] text-outline">
                          call
                        </span>
                        {v.driverName || '—'}
                      </span>
                      <span className="flex items-center gap-2 font-mono font-semibold">
                        <span>{v.speedKmh} km/h</span>
                        {v.temperatureC !== null && (
                          <span className="text-primary">{v.temperatureC}°C</span>
                        )}
                      </span>
                    </div>

                    {v.status === 'IN_TRANSIT' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSimulateGpsStep(v);
                        }}
                        className="w-full h-8 rounded-lg bg-surface-container-low hover:bg-primary-fixed text-primary text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">near_me</span>
                        <span>Cập nhật 1 bước GPS về kho đích</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Interactive Map Viewport with Floating Telemetry HUDs */}
        <section className="flex-1 relative min-h-[420px] bg-surface-container">
          <div className="absolute inset-0">
            <DynamicFleetMap
              branches={branches}
              vehicles={filteredVehicles}
              selectedVehicle={selectedVehicle}
              mapStyle={mapStyle}
              onSelectVehicle={(v) => setSelectedId(v.id)}
              className="h-full w-full"
            />
          </div>

          {/* Floating Top-Right Layer Switcher & Map Legend */}
          <div className="absolute top-4 right-4 z-[450] flex flex-col items-end gap-2.5 pointer-events-none">
            <div className="pointer-events-auto inline-flex rounded-xl bg-surface-container-lowest/90 backdrop-blur-md p-1 shadow-lg">
              <button
                type="button"
                onClick={() => setMapStyle('STREET')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  mapStyle === 'STREET'
                    ? 'bg-primary-container text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Đường bộ
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('SATELLITE')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  mapStyle === 'SATELLITE'
                    ? 'bg-primary-container text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Vệ tinh
              </button>
            </div>

            <div className="pointer-events-auto rounded-xl bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-2.5 shadow-lg text-[11px] space-y-1">
              <div className="font-bold text-on-surface mb-1">Chú thích trạng thái</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
                <span>Đang vận chuyển</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error" />
                <span>Cảnh báo trễ ETA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-inverse-surface" />
                <span>Hub / Chi nhánh</span>
              </div>
            </div>
          </div>

          {/* Floating Selected Vehicle Telematics Card */}
          {selectedVehicle && (
            <div className="hidden md:block absolute top-4 left-4 z-[450] w-80 bg-surface-container-lowest/95 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden">
              <div
                className={`h-1.5 w-full ${
                  selectedVehicle.isDelayed ? 'bg-error' : 'bg-primary-container'
                }`}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-sm text-primary">
                      {selectedVehicle.code}
                    </div>
                    <div className="text-[11px] text-outline">
                      {selectedVehicle.vehiclePlate || 'Xe nội bộ'} ·{' '}
                      {selectedVehicle.driverName || '—'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedVehicle.isDelayed
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-[#ECFDF5] text-[#10B981]'
                    }`}
                  >
                    {selectedVehicle.isDelayed ? 'Trễ ETA' : selectedVehicle.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-surface-container-low rounded-lg p-2.5 text-center">
                  <div>
                    <div className="text-[10px] text-outline">Tốc độ</div>
                    <div className="font-mono font-bold text-xs text-on-surface">
                      {selectedVehicle.speedKmh} km/h
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-outline">Nhiệt độ</div>
                    <div className="font-mono font-bold text-xs text-primary">
                      {selectedVehicle.temperatureC !== null
                        ? `${selectedVehicle.temperatureC}°C`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-outline">Tuyến</div>
                    <div className="font-mono font-bold text-xs text-on-surface">
                      {selectedVehicle.sourceBranch.code}→{selectedVehicle.destBranch.code}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Floating Telemetry HUD Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-[450] bg-surface-container-lowest/95 backdrop-blur-md shadow-xl rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <div>
                <span className="text-outline">Đang chạy:</span>{' '}
                <strong className="font-mono text-primary font-bold">
                  {inTransitCount}/{vehicles.length} xe
                </strong>
              </div>
              <div>
                <span className="text-outline">Trễ ETA &gt; 30p:</span>{' '}
                <strong
                  className={`font-mono font-bold ${
                    delayedCount > 0 ? 'text-error' : 'text-[#10B981]'
                  }`}
                >
                  {delayedCount} chuyến
                </strong>
              </div>
              <div className="hidden sm:block text-outline">
                Hub mạng lưới: <strong className="text-on-surface">{branches.length}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={loadFleet}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container hover:bg-primary text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}
              >
                refresh
              </span>
              <span>Làm mới GPS</span>
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
