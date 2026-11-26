import { apiFetch } from './api';
import {
  AiAlertItem,
  AiForecastResponse,
  AiTransferSuggestionItem,
  AnalyticsKpisResponse,
  AuditLogItem,
  BranchDetailItem,
  CategoryItem,
  CustomerOrderItem,
  InventoryTicketItem,
  KanbanOrderItem,
  LiveFleetItem,
  PaginatedResult,
  ProductItem,
  StockCheckItem,
  StockItem,
  SuggestedBinItem,
  TransferTicketItem,
} from '../types/operations';

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const BranchOpsApi = {
  list: () => apiFetch<{ branches: BranchDetailItem[] }>('/api/branches'),
  create: (payload: {
    code: string;
    name: string;
    branchType: 'HUB' | 'SATELLITE' | 'STORE';
    address: string;
    latitude: number;
    longitude: number;
    capacity: number;
    managerPhone?: string;
  }) => apiFetch<{ branch: BranchDetailItem }>('/api/branches', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiFetch<{ branch: BranchDetailItem }>(`/api/branches/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateStatus: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED') =>
    apiFetch<{ branch: BranchDetailItem }>(`/api/branches/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  createZone: (branchId: string, payload: { code: string; name: string }) =>
    apiFetch<{ zone: unknown }>(`/api/branches/${branchId}/zones`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createBin: (zoneId: string, payload: { code: string; maxCapacity: number }) =>
    apiFetch<{ bin: unknown }>(`/api/branches/zones/${zoneId}/bins`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const ProductApi = {
  listCategories: () => apiFetch<{ categories: CategoryItem[] }>('/api/categories'),
  createCategory: (payload: { code: string; name: string; description?: string }) =>
    apiFetch<{ category: CategoryItem }>('/api/categories', { method: 'POST', body: JSON.stringify(payload) }),
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<ProductItem>>(`/api/products${toQuery(params)}`),
  create: (payload: Record<string, unknown>) =>
    apiFetch<{ product: ProductItem }>('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiFetch<{ product: ProductItem }>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  importBulk: (items: Array<Record<string, unknown>>) =>
    apiFetch<{ total: number; createdCount: number; updatedCount: number }>('/api/products/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
};

export const InventoryApi = {
  listStocks: (params: Record<string, string | number | boolean | undefined>) =>
    apiFetch<PaginatedResult<StockItem>>(`/api/inventory/stocks${toQuery(params)}`),
  suggestBins: (branchId?: string) =>
    apiFetch<{ bins: SuggestedBinItem[] }>(`/api/inventory/suggest-bin${toQuery({ branchId })}`),
  pickingList: (branchId?: string, productId?: string) =>
    apiFetch<{ items: Array<{ stockId: string; product: { id: string; sku: string; barcode: string; name: string; unit: string }; bin: { id: string; code: string; zone: { code: string; name: string } }; batchNo: string; expDate: string | null; qtyOnHand: number; qtyReserved: number; qtyAvailable: number; isLocked: boolean }> }>(
      `/api/inventory/picking-list${toQuery({ branchId, productId })}`
    ),
  listTickets: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<InventoryTicketItem>>(`/api/inventory/tickets${toQuery(params)}`),
  createTicket: (payload: Record<string, unknown>) =>
    apiFetch<{ ticket: InventoryTicketItem }>('/api/inventory/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmTicket: (id: string) =>
    apiFetch<{ ticket: InventoryTicketItem }>(`/api/inventory/tickets/${id}/confirm`, {
      method: 'POST',
    }),
};

export const StockCheckApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<StockCheckItem>>(`/api/stock-checks${toQuery(params)}`),
  create: (payload: { branchId: string; zoneId?: string }) =>
    apiFetch<{ stockCheck: StockCheckItem }>('/api/stock-checks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCounts: (id: string, items: Array<{ detailId: string; qtyActual: number; reason?: string }>) =>
    apiFetch<{ stockCheck: StockCheckItem }>(`/api/stock-checks/${id}/count`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }),
  submit: (id: string) =>
    apiFetch<{ stockCheck: StockCheckItem }>(`/api/stock-checks/${id}/submit`, { method: 'POST' }),
  approve: (id: string) =>
    apiFetch<{ stockCheck: StockCheckItem }>(`/api/stock-checks/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    apiFetch<{ stockCheck: StockCheckItem }>(`/api/stock-checks/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

export const TransferApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<TransferTicketItem>>(`/api/transfers${toQuery(params)}`),
  create: (payload: Record<string, unknown>) =>
    apiFetch<{ transfer: TransferTicketItem }>('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approve: (id: string, adjustedItems?: Array<{ detailId: string; qtyRequested: number }>) =>
    apiFetch<{ transfer: TransferTicketItem }>(`/api/transfers/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adjustedItems }),
    }),
  reject: (id: string) =>
    apiFetch<{ transfer: TransferTicketItem }>(`/api/transfers/${id}/reject`, { method: 'POST' }),
  dispatch: (id: string) =>
    apiFetch<{ transfer: TransferTicketItem }>(`/api/transfers/${id}/dispatch`, { method: 'POST' }),
  receive: (
    id: string,
    payload: {
      targetBinId: string;
      items: Array<{ detailId: string; qtyReceived: number; discrepancyReason?: string }>;
    }
  ) =>
    apiFetch<{ transfer: TransferTicketItem }>(`/api/transfers/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const OrderApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<CustomerOrderItem>>(`/api/orders${toQuery(params)}`),
  create: (payload: Record<string, unknown>) =>
    apiFetch<{ order: CustomerOrderItem }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  suggestBranch: (orderId: string) =>
    apiFetch<{
      suggestions: Array<{
        branchId: string;
        branchCode: string;
        branchName: string;
        branchType: string;
        canFulfillAll: boolean;
        distanceKm: number | null;
        missingItems: Array<{ sku: string; required: number; available: number }>;
      }>;
    }>(`/api/orders/${orderId}/suggest-branch`),
  allocate: (orderId: string, branchId: string) =>
    apiFetch<{ order: CustomerOrderItem }>(`/api/orders/${orderId}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ branchId }),
    }),
  getBoard: (branchId?: string) =>
    apiFetch<{ items: KanbanOrderItem[] }>(`/api/orders/board${toQuery({ branchId })}`),
  updateStage: (
    orderId: string,
    payload: {
      status: 'ALLOCATED' | 'PACKING' | 'SHIPPED' | 'DELIVERED';
      trackingNumber?: string;
      carrierName?: string;
      pickingProgress?: number;
    }
  ) =>
    apiFetch<{ order: CustomerOrderItem }>(`/api/orders/${orderId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const AlertsApi = {
  list: (params?: { isResolved?: boolean; branchId?: string; limit?: number }) =>
    apiFetch<{
      items: AiAlertItem[];
      summary: { unresolvedRed: number; unresolvedYellow: number; totalUnresolved: number };
    }>(`/api/alerts${toQuery(params || {})}`),
  resolve: (id: string) =>
    apiFetch<{ alert: AiAlertItem }>(`/api/alerts/${id}/resolve`, { method: 'PATCH' }),
  scanNow: () =>
    apiFetch<{
      summary: { pb19Created: number; pb12Created: number; pb14Created: number; scannedAt: string };
    }>('/api/alerts/scan', { method: 'POST' }),
};

export const AnalyticsApi = {
  getKpis: (period: 'week' | 'month' | 'quarter' = 'month', branchId?: string) =>
    apiFetch<AnalyticsKpisResponse>(`/api/analytics/kpis${toQuery({ period, branchId })}`),
};

export const AiApi = {
  getForecast: (branchId: string, productId: string, horizonDays: 7 | 14 | 30 = 14) =>
    apiFetch<AiForecastResponse>(
      `/api/ai/forecast${toQuery({ branchId, productId, horizonDays })}`
    ),
  getTransferSuggestions: (minSavingPct = 0) =>
    apiFetch<{
      algorithm: string;
      generatedAt: string;
      suggestions: AiTransferSuggestionItem[];
    }>(`/api/ai/transfer-suggestions${toQuery({ minSavingPct })}`),
  acceptSuggestions: (
    items: Array<{
      sourceBranchId: string;
      destBranchId: string;
      productId: string;
      qty: number;
      confidencePct?: number;
    }>
  ) =>
    apiFetch<{ createdCodes: string[]; count: number }>('/api/ai/transfer-suggestions/accept', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
};

export const FleetApi = {
  listLive: () => apiFetch<{ items: LiveFleetItem[] }>('/api/transfers/live'),
  updateGps: (
    transferId: string,
    payload: { latitude: number; longitude: number; speedKmh?: number; temperatureC?: number; note?: string }
  ) =>
    apiFetch<{ log: unknown }>(`/api/transfers/${transferId}/gps`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const AuditLogApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<PaginatedResult<AuditLogItem>>(`/api/audit-logs${toQuery(params)}`),
};
