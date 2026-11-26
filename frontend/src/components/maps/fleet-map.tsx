'use client';

import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { BranchDetailItem, LiveFleetItem } from '@/types/operations';

function createDivIcon(color: string, label: string, isTruck = false) {
  return L.divIcon({
    className: 'logai-map-marker',
    html: `<div style="display:flex;align-items:center;gap:4px;background:${color};color:#fff;padding:4px 8px;border-radius:9999px;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;">${
      isTruck ? '🚚 ' : '🏭 '
    }${label}</div>`,
    iconSize: [110, 28],
    iconAnchor: [55, 14],
  });
}

function MapFlyController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 7, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

interface FleetMapProps {
  branches: BranchDetailItem[];
  vehicles: LiveFleetItem[];
  selectedVehicle: LiveFleetItem | null;
  mapStyle: 'STREET' | 'SATELLITE';
  onSelectVehicle: (v: LiveFleetItem) => void;
  className?: string;
}

export default function FleetMap({
  branches,
  vehicles,
  selectedVehicle,
  mapStyle,
  onSelectVehicle,
  className = 'h-[360px] md:h-[540px] w-full rounded-xl',
}: FleetMapProps) {
  const defaultCenter: [number, number] = [15.8, 107.2];
  const focusCenter: [number, number] | null = selectedVehicle
    ? [selectedVehicle.currentLat, selectedVehicle.currentLng]
    : null;

  const tileUrl =
    mapStyle === 'SATELLITE'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <MapContainer
      center={defaultCenter}
      zoom={6}
      className={className}
      scrollWheelZoom
    >
      <TileLayer url={tileUrl} attribution="&copy; OpenStreetMap / Esri" />
      <MapFlyController center={focusCenter} />

      {/* Markers cho mạng lưới Chi nhánh / Kho */}
      {branches.map((b) => (
        <Marker
          key={`branch-${b.id}`}
          position={[b.latitude, b.longitude]}
          icon={createDivIcon(b.status === 'ACTIVE' ? '#1e293b' : '#64748b', b.code, false)}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">{b.name}</p>
              <p>Mã: {b.code} ({b.branchType})</p>
              <p>Chiếm dụng: {b.occupancyPct}% ({b.totalQty.toLocaleString('vi-VN')} đv)</p>
              <p className="text-slate-500">{b.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Polyline lộ trình & Markers các chuyến xe điều chuyển */}
      {vehicles.map((v) => {
        const routePoints: Array<[number, number]> = [
          [v.sourceBranch.latitude, v.sourceBranch.longitude],
          ...v.trackingLogs.map((l): [number, number] => [l.latitude, l.longitude]),
          [v.currentLat, v.currentLng],
          [v.destBranch.latitude, v.destBranch.longitude],
        ];

        const truckColor = v.isDelayed
          ? '#dc2626'
          : v.status === 'IN_TRANSIT'
          ? '#2563eb'
          : '#d97706';

        return (
          <React.Fragment key={`veh-${v.id}`}>
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: truckColor,
                weight: selectedVehicle?.id === v.id ? 5 : 3,
                dashArray: v.status === 'IN_TRANSIT' ? undefined : '6 6',
                opacity: 0.85,
              }}
            />

            <Marker
              position={[v.currentLat, v.currentLng]}
              icon={createDivIcon(truckColor, v.vehiclePlate || v.code, true)}
              eventHandlers={{
                click: () => onSelectVehicle(v),
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[200px]">
                  <p className="font-bold text-slate-900">
                    {v.code} — {v.vehiclePlate || 'Xe nội bộ'}
                  </p>
                  <p>
                    Tuyến: <strong>{v.sourceBranch.code}</strong> →{' '}
                    <strong>{v.destBranch.code}</strong>
                  </p>
                  <p>Tài xế: {v.driverName || '—'} ({v.driverPhone || '—'})</p>
                  <p>
                    Tốc độ: <strong>{v.speedKmh} km/h</strong>
                    {v.temperatureC !== null ? ` · Nhiệt độ: ${v.temperatureC}°C` : ''}
                  </p>
                  <p>
                    Trạng thái:{' '}
                    <span className={v.isDelayed ? 'text-red-600 font-bold' : 'text-blue-700 font-semibold'}>
                      {v.isDelayed ? 'TRỄ LỊCH TRÌNH (>30p)' : v.status}
                    </span>
                  </p>
                  {v.eta && (
                    <p className="text-slate-500">
                      ETA: {new Date(v.eta).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
