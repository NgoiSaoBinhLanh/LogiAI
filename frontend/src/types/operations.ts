export interface ZoneItem {
  id: string;
  branchId: string;
  code: string;
  name: string;
  bins: BinItem[];
}

export interface BinItem {
  id: string;
  zoneId: string;
  code: string;
  maxCapacity: string | number;
  status: 'ACTIVE' | 'FULL' | 'MAINTENANCE' | 'LOCKED';
  currentQty: number;
  occupancyPct: number;
}

export interface BranchDetailItem {
  id: string;
  code: string;
  name: string;
  branchType: 'HUB' | 'SATELLITE' | 'STORE';
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  managerPhone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED';
  totalQty: number;
  totalValue: number;
  skuCount: number;
  occupancyPct: number;
  userCount: number;
  zoneCount: number;
  zones: ZoneItem[];
}

export interface CategoryItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface ProductItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  category: { id: string; code: string; name: string };
  unit: string;
  unitPrice: number;
  costPrice: number;
  weight: number | null;
  dimensions: string | null;
  storageCondition: string | null;
  minStock: number;
  maxStock: number;
  totalOnHand: number;
  totalAvailable: number;
  createdAt: string;
}

export interface StockItem {
  id: string;
  branchId: string;
  branch: { id: string; code: string; name: string };
  productId: string;
  product: {
    id: string;
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    unitPrice: number;
    minStock: number;
    maxStock: number;
    category: { id: string; name: string };
  };
  binId: string;
  bin: { id: string; code: string; zone: { id: string; code: string; name: string } };
  batchNo: string;
  expDate: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  isLocked: boolean;
  updatedAt: string;
}

export interface SuggestedBinItem {
  id: string;
  code: string;
  zoneCode: string;
  zoneName: string;
  maxCapacity: number;
  usedQty: number;
  remainingCapacity: number;
}

export interface InventoryTicketItem {
  id: string;
  code: string;
  type: 'IMPORT' | 'EXPORT' | 'ADJUSTMENT';
  branchId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  supplierName: string | null;
  reason: string | null;
  createdAt: string;
  branch: { id: string; code: string; name: string };
  creator: { id: string; fullName: string; username: string };
  details: Array<{
    id: string;
    productId: string;
    binId: string;
    batchNo: string;
    expDate: string | null;
    qty: number;
    product: { id: string; sku: string; barcode: string; name: string; unit: string };
    bin: { id: string; code: string };
  }>;
}

export interface StockCheckItem {
  id: string;
  code: string;
  branchId: string;
  status: 'COUNTING' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
  rejectReason: string | null;
  createdAt: string;
  branch: { id: string; code: string; name: string };
  creator: { id: string; fullName: string; username: string };
  approver: { id: string; fullName: string; username: string } | null;
  details: Array<{
    id: string;
    productId: string;
    binId: string;
    qtySystem: number;
    qtyActual: number;
    discrepancyQty: number;
    reason: string | null;
    product: {
      id: string;
      sku: string;
      barcode: string;
      name: string;
      unit: string;
      costPrice: number;
    };
    bin: { id: string; code: string; zone: { id: string; code: string; name: string } };
  }>;
}

export interface TransferTicketItem {
  id: string;
  code: string;
  sourceBranchId: string;
  destBranchId: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY' | 'CANCELLED';
  transportMethod: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehiclePlate: string | null;
  temperatureC: number | null;
  eta: string | null;
  slaDeadline: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  currentLat: number | null;
  currentLng: number | null;
  aiSuggested: boolean;
  aiConfidence: number | null;
  createdAt: string;
  sourceBranch: { id: string; code: string; name: string; latitude: number; longitude: number };
  destBranch: { id: string; code: string; name: string; latitude: number; longitude: number };
  creator: { id: string; fullName: string };
  approver: { id: string; fullName: string } | null;
  details: Array<{
    id: string;
    productId: string;
    qtyRequested: number;
    qtyReceived: number | null;
    discrepancyReason: string | null;
    sourceAvailable: number;
    product: {
      id: string;
      sku: string;
      barcode: string;
      name: string;
      unit: string;
      minStock: number;
      weight: number | null;
    };
  }>;
}

export interface CustomerOrderItem {
  id: string;
  code: string;
  channel: string;
  customerName: string;
  customerAddress: string;
  lat: number | null;
  lng: number | null;
  assignedBranchId: string | null;
  status: 'NEW' | 'ALLOCATED' | 'PACKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  trackingNumber: string | null;
  carrierName: string | null;
  pickingProgress: number;
  totalAmount: number;
  slaDeadline: string | null;
  createdAt: string;
  assignedBranch: { id: string; code: string; name: string } | null;
  details: Array<{
    id: string;
    productId: string;
    qty: number;
    price: number;
    product: { id: string; sku: string; barcode: string; name: string; unit: string };
  }>;
}

export interface KanbanOrderItem extends CustomerOrderItem {
  slaStatus: 'ON_TIME' | 'AT_RISK' | 'BREACHED';
  slaRemainingMinutes: number;
}

export interface AiAlertItem {
  id: string;
  alertType: 'LOW_STOCK' | 'EXPIRING_SOON' | 'SLA_BREACH' | 'AI_TRANSFER_SUGGESTION' | 'CAPACITY_WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  colorLevel: 'RED' | 'YELLOW';
  branchId: string | null;
  productId: string | null;
  transferTicketId: string | null;
  orderId: string | null;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  isResolved: boolean;
  createdAt: string;
  branch?: { id: string; code: string; name: string } | null;
  product?: { id: string; sku: string; name: string } | null;
  transferTicket?: { id: string; code: string; status: string } | null;
  order?: { id: string; code: string; status: string } | null;
}

export interface AnalyticsKpisResponse {
  kpis: {
    totalInventoryValue: number;
    totalStockUnits: number;
    inventoryTurnoverRatio: number;
    slaFulfillmentRate: number;
    interBranchTransferCost: number;
    totalOrders: number;
    fulfilledOrders: number;
    activeProductsCount: number;
  };
  branchDistribution: Array<{
    branchCode: string;
    branchName: string;
    value: number;
    qty: number;
  }>;
  orderTrend: Array<{
    label: string;
    received: number;
    delivered: number;
    slaPct: number;
  }>;
  heatmap: {
    branches: string[];
    categories: string[];
    cells: Array<[number, number, number, number]>;
  };
  topSelling: Array<{
    sku: string;
    name: string;
    qtySold: number;
    revenue: number;
  }>;
  deadstock: {
    items: Array<{
      stockId: string;
      sku: string;
      productName: string;
      branchCode: string;
      branchName: string;
      qtyOnHand: number;
      stuckValue: number;
      expDate: string | null;
    }>;
    totalStuckCapital: number;
  };
}

export interface AiForecastResponse {
  branch: { id: string; code: string; name: string };
  product: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    minStock: number;
    maxStock: number;
  };
  horizonDays: 7 | 14 | 30;
  sufficientRealData: boolean;
  warningMessage: string | null;
  metrics: {
    currentAvailable: number;
    avgDailySales: number;
    totalForecastDemand: number;
    recommendedRestockQty: number;
    mapeAccuracyPct: number;
    safetyStock: number;
  };
  historySeries: Array<{ date: string; actual: number }>;
  forecastSeries: Array<{ date: string; min: number; expected: number; max: number }>;
}

export interface AiTransferSuggestionItem {
  suggestionKey: string;
  sourceBranchId: string;
  sourceBranchCode: string;
  sourceBranchName: string;
  sourceAvailable: number;
  destBranchId: string;
  destBranchCode: string;
  destBranchName: string;
  destAvailable: number;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  recommendedQty: number;
  distanceKm: number;
  estimatedCostVnd: number;
  savingPct: number;
  confidencePct: number;
  priority: 'URGENT' | 'COST_OPT' | 'REBALANCE';
  reason: string;
}

export interface LiveFleetItem {
  id: string;
  code: string;
  status: string;
  transportMethod: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehiclePlate: string | null;
  temperatureC: number | null;
  eta: string | null;
  dispatchedAt: string | null;
  isDelayed: boolean;
  currentLat: number;
  currentLng: number;
  speedKmh: number;
  sourceBranch: { id: string; code: string; name: string; latitude: number; longitude: number };
  destBranch: { id: string; code: string; name: string; latitude: number; longitude: number };
  details: Array<{
    id: string;
    qtyRequested: number;
    product: { sku: string; name: string; unit: string };
  }>;
  trackingLogs: Array<{
    id: string;
    latitude: number;
    longitude: number;
    speedKmh: number;
    note: string | null;
    recordedAt: string;
  }>;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  actionType: string;
  module: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: { roleCode: string; roleName: string };
  } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
