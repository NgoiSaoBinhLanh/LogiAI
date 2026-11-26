import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  AlertSeverity,
  AlertType,
  AuditActionType,
  BranchType,
  EntityStatus,
  OrderStatus,
  Prisma,
  PrismaClient,
  StockCheckStatus,
  TicketStatus,
  TicketType,
  TransferStatus,
} from '@prisma/client';

for (const envPath of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const prisma = new PrismaClient();

function mustGet<K, V>(map: Map<K, V>, key: K, label: string): V {
  const val = map.get(key);
  if (val === undefined) {
    throw new Error(`Missing seeded ${label}: ${String(key)}`);
  }
  return val;
}

function hashPassword(plainText: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main(): Promise<void> {
  console.log('Bắt đầu chạy seed dữ liệu mẫu (idempotent)...');

  // 1. Permissions mẫu cho RBAC động
  const permissionDefs = [
    { code: 'USER_READ', name: 'Xem danh sách nhân sự', module: 'IAM' },
    { code: 'USER_WRITE', name: 'Quản lý tài khoản & phân quyền', module: 'IAM' },
    { code: 'ROLE_MANAGE', name: 'Quản lý vai trò & RBAC động', module: 'IAM' },
    { code: 'BRANCH_READ', name: 'Xem danh sách chi nhánh/kho', module: 'BRANCH' },
    { code: 'BRANCH_WRITE', name: 'Cấu hình chi nhánh, zone & bin', module: 'BRANCH' },
    { code: 'PRODUCT_READ', name: 'Xem danh mục sản phẩm', module: 'CATALOG' },
    { code: 'PRODUCT_WRITE', name: 'Quản lý sản phẩm & định mức tồn', module: 'CATALOG' },
    { code: 'STOCK_READ', name: 'Xem tồn kho thời gian thực', module: 'INVENTORY' },
    { code: 'TICKET_CREATE', name: 'Tạo phiếu nhập/xuất/kiểm kê', module: 'INVENTORY' },
    { code: 'TICKET_APPROVE', name: 'Phê duyệt phiếu kho & điều chuyển', module: 'INVENTORY' },
    { code: 'TRANSFER_TRACK', name: 'Giám sát hành trình GPS điều chuyển', module: 'LOGISTICS' },
    { code: 'ORDER_READ', name: 'Xem đơn hàng bán lẻ', module: 'ORDER' },
    { code: 'ORDER_ALLOCATE', name: 'Phân bổ & xử lý đơn hàng', module: 'ORDER' },
    { code: 'AUDIT_READ', name: 'Xem nhật ký kiểm toán hệ thống', module: 'AUDIT' },
    { code: 'ALERT_MANAGE', name: 'Xem & xử lý cảnh báo AI/SLA', module: 'AI_ALERT' },
  ];

  const permissionMap = new Map<string, bigint>();
  for (const perm of permissionDefs) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: { code: perm.code, name: perm.name, module: perm.module },
    });
    permissionMap.set(perm.code, record.id);
  }

  // 2. Roles mẫu
  const roleDefs = [
    {
      roleCode: 'ADMIN',
      roleName: 'Quản trị viên hệ thống',
      description: 'Toàn quyền cấu hình hệ thống, RBAC động và giám sát toàn chuỗi',
      perms: permissionDefs.map((p) => p.code),
    },
    {
      roleCode: 'BRANCH_MANAGER',
      roleName: 'Quản lý chi nhánh',
      description: 'Quản lý vận hành kho, duyệt phiếu nhập xuất, điều chuyển và kiểm kê tại chi nhánh',
      perms: [
        'USER_READ',
        'BRANCH_READ',
        'PRODUCT_READ',
        'STOCK_READ',
        'TICKET_CREATE',
        'TICKET_APPROVE',
        'TRANSFER_TRACK',
        'ORDER_READ',
        'ORDER_ALLOCATE',
        'ALERT_MANAGE',
      ],
    },
    {
      roleCode: 'WAREHOUSE_STAFF',
      roleName: 'Nhân viên kho',
      description: 'Thực hiện nhập xuất hàng theo kệ Bin và kiểm kê thực tế',
      perms: ['BRANCH_READ', 'PRODUCT_READ', 'STOCK_READ', 'TICKET_CREATE', 'ORDER_READ'],
    },
    {
      roleCode: 'DISPATCHER',
      roleName: 'Điều phối viên vận tải',
      description: 'Theo dõi hành trình GPS xe điều chuyển và xử lý cảnh báo SLA',
      perms: ['BRANCH_READ', 'STOCK_READ', 'TRANSFER_TRACK', 'ORDER_READ', 'ORDER_ALLOCATE', 'ALERT_MANAGE'],
    },
  ];

  const roleMap = new Map<string, bigint>();
  for (const r of roleDefs) {
    const roleRecord = await prisma.role.upsert({
      where: { roleCode: r.roleCode },
      update: { roleName: r.roleName, description: r.description },
      create: {
        roleCode: r.roleCode,
        roleName: r.roleName,
        description: r.description,
      },
    });
    roleMap.set(r.roleCode, roleRecord.id);

    for (const permCode of r.perms) {
      const permId = permissionMap.get(permCode);
      if (permId !== undefined) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleRecord.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: roleRecord.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 3. Chi nhánh / Kho có tọa độ GPS thực tế
  const branchesData = [
    {
      code: 'BR-HCM-01',
      name: 'Kho Trung Tâm TP.HCM (Tân Bình)',
      branchType: BranchType.HUB,
      address: '123 Cộng Hòa, Phường 12, Quận Tân Bình, TP.HCM',
      latitude: 10.801465,
      longitude: 106.647328,
      capacity: 15000.0,
      managerPhone: '0901000001',
      status: EntityStatus.ACTIVE,
    },
    {
      code: 'BR-HN-01',
      name: 'Kho Miền Bắc Hà Nội (Long Biên)',
      branchType: BranchType.SATELLITE,
      address: '45 Nguyễn Văn Linh, Phúc Đồng, Long Biên, Hà Nội',
      latitude: 21.037892,
      longitude: 105.908341,
      capacity: 12000.0,
      managerPhone: '0901000002',
      status: EntityStatus.ACTIVE,
    },
    {
      code: 'BR-DN-01',
      name: 'Kho Miền Trung Đà Nẵng (Liên Chiểu)',
      branchType: BranchType.SATELLITE,
      address: '88 Nguyễn Lương Bằng, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng',
      latitude: 16.074811,
      longitude: 108.151822,
      capacity: 8500.0,
      managerPhone: '0901000003',
      status: EntityStatus.ACTIVE,
    },
  ];

  const branchMap = new Map<string, bigint>();
  for (const b of branchesData) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        branchType: b.branchType,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        capacity: b.capacity,
        managerPhone: b.managerPhone,
        status: b.status,
      },
      create: b,
    });
    branchMap.set(b.code, branch.id);
  }

  const hcmBranchId = mustGet(branchMap, 'BR-HCM-01', 'branch');
  const hnBranchId = mustGet(branchMap, 'BR-HN-01', 'branch');
  const dnBranchId = mustGet(branchMap, 'BR-DN-01', 'branch');

  // 4. Zone & Bin cho các kho
  const zoneBinDefs = [
    { branchId: hcmBranchId, zoneCode: 'Z-COLD', zoneName: 'Khu vực Kho Lạnh', binCode: 'HCM-C01', maxCap: 1000 },
    { branchId: hcmBranchId, zoneCode: 'Z-DRY', zoneName: 'Khu vực Hàng Khô', binCode: 'HCM-D01', maxCap: 2500 },
    { branchId: hnBranchId, zoneCode: 'Z-DRY', zoneName: 'Khu vực Hàng Khô HN', binCode: 'HN-D01', maxCap: 2000 },
    { branchId: dnBranchId, zoneCode: 'Z-DRY', zoneName: 'Khu vực Hàng Khô ĐN', binCode: 'DN-D01', maxCap: 1500 },
  ];

  const binMap = new Map<string, bigint>();
  for (const zb of zoneBinDefs) {
    const zone = await prisma.zone.upsert({
      where: {
        branchId_code: { branchId: zb.branchId, code: zb.zoneCode },
      },
      update: { name: zb.zoneName },
      create: {
        branchId: zb.branchId,
        code: zb.zoneCode,
        name: zb.zoneName,
      },
    });

    const bin = await prisma.bin.upsert({
      where: {
        zoneId_code: { zoneId: zone.id, code: zb.binCode },
      },
      update: { maxCapacity: zb.maxCap },
      create: {
        zoneId: zone.id,
        code: zb.binCode,
        maxCapacity: zb.maxCap,
      },
    });
    binMap.set(zb.binCode, bin.id);
  }

  // 5. Tài khoản test theo từng vai trò
  const defaultPass = hashPassword('Password@123');
  const usersData = [
    {
      username: 'admin',
      email: 'admin@cs445.local',
      fullName: 'Nguyễn Văn A',
      phone: '0909000001',
      branchId: null as bigint | null,
      roleCode: 'ADMIN',
    },
    {
      username: 'manager_hcm',
      email: 'manager.hcm@cs445.local',
      fullName: 'Trần Văn B',
      phone: '0909000002',
      branchId: hcmBranchId,
      roleCode: 'BRANCH_MANAGER',
    },
    {
      username: 'staff_hcm',
      email: 'staff.hcm@cs445.local',
      fullName: 'Lê Thị C',
      phone: '0909000003',
      branchId: hcmBranchId,
      roleCode: 'WAREHOUSE_STAFF',
    },
    {
      username: 'dispatcher_vn',
      email: 'dispatcher@cs445.local',
      fullName: 'Phạm Văn D',
      phone: '0909000004',
      branchId: hnBranchId,
      roleCode: 'DISPATCHER',
    },
  ];

  const userMap = new Map<string, bigint>();
  for (const u of usersData) {
    const roleId = mustGet(roleMap, u.roleCode, 'role');
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        branchId: u.branchId,
        roleId,
        status: EntityStatus.ACTIVE,
      },
      create: {
        username: u.username,
        email: u.email,
        password: defaultPass,
        fullName: u.fullName,
        phone: u.phone,
        branchId: u.branchId,
        roleId,
        status: EntityStatus.ACTIVE,
      },
    });
    userMap.set(u.username, user.id);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
  }

  const adminId = mustGet(userMap, 'admin', 'user');
  const managerHcmId = mustGet(userMap, 'manager_hcm', 'user');
  const staffHcmId = mustGet(userMap, 'staff_hcm', 'user');

  // 6. Danh mục & Sản phẩm có mã vạch
  const categoriesData = [
    { code: 'CAT-ELEC', name: 'Thiết bị điện tử & IoT', description: 'Cảm biến, thiết bị mạng, linh kiện điện tử' },
    { code: 'CAT-FMCG', name: 'Hàng tiêu dùng nhanh (FMCG)', description: 'Thực phẩm đóng gói, đồ uống bảo quản tiêu chuẩn' },
    { code: 'CAT-PHARMA', name: 'Vật tư y tế & Dược phẩm', description: 'Sản phẩm yêu cầu kiểm soát nhiệt độ và hạn sử dụng' },
  ];

  const catMap = new Map<string, bigint>();
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: c,
    });
    catMap.set(c.code, cat.id);
  }

  const productsData = [
    {
      sku: 'SKU-IOT-001',
      barcode: '8935001000011',
      name: 'Cảm biến nhiệt độ GPS Tracker Pro',
      categoryId: mustGet(catMap, 'CAT-ELEC', 'category'),
      unit: 'Cái',
      unitPrice: 1250000,
      costPrice: 850000,
      weight: 0.35,
      dimensions: '10x8x4 cm',
      storageCondition: 'Khô ráo, tránh ẩm',
      minStock: 20,
      maxStock: 500,
    },
    {
      sku: 'SKU-FMCG-002',
      barcode: '8935001000028',
      name: 'Sữa hạt dinh dưỡng hộp 1L (Thùng 12 hộp)',
      categoryId: mustGet(catMap, 'CAT-FMCG', 'category'),
      unit: 'Thùng',
      unitPrice: 360000,
      costPrice: 280000,
      weight: 12.5,
      dimensions: '40x30x22 cm',
      storageCondition: 'Nhiệt độ phòng < 28°C',
      minStock: 50,
      maxStock: 1000,
    },
    {
      sku: 'SKU-MED-003',
      barcode: '8935001000035',
      name: 'Bộ test nhanh y tế vô trùng (Hộp 25 test)',
      categoryId: mustGet(catMap, 'CAT-PHARMA', 'category'),
      unit: 'Hộp',
      unitPrice: 480000,
      costPrice: 320000,
      weight: 0.45,
      dimensions: '20x15x10 cm',
      storageCondition: 'Kho lạnh 2°C - 8°C',
      minStock: 30,
      maxStock: 600,
    },
  ];

  const productMap = new Map<string, bigint>();
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        barcode: p.barcode,
        name: p.name,
        categoryId: p.categoryId,
        unit: p.unit,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        weight: p.weight,
        dimensions: p.dimensions,
        storageCondition: p.storageCondition,
        minStock: p.minStock,
        maxStock: p.maxStock,
      },
      create: p,
    });
    productMap.set(p.sku, prod.id);
  }

  const prodIotId = mustGet(productMap, 'SKU-IOT-001', 'product');
  const prodFmcgId = mustGet(productMap, 'SKU-FMCG-002', 'product');
  const prodMedId = mustGet(productMap, 'SKU-MED-003', 'product');

  const hcmColdBinId = mustGet(binMap, 'HCM-C01', 'bin');
  const hcmDryBinId = mustGet(binMap, 'HCM-D01', 'bin');
  const hnDryBinId = mustGet(binMap, 'HN-D01', 'bin');

  // 7. Tồn kho thực tế theo lô & kệ Bin
  const stocksData = [
    {
      branchId: hcmBranchId,
      productId: prodIotId,
      binId: hcmDryBinId,
      batchNo: 'LOT-2026-A1',
      expDate: null as Date | null,
      qtyOnHand: 180,
      qtyReserved: 15,
    },
    {
      branchId: hcmBranchId,
      productId: prodMedId,
      binId: hcmColdBinId,
      batchNo: 'LOT-MED-2026-09',
      expDate: new Date('2026-12-15T00:00:00Z'),
      qtyOnHand: 12,
      qtyReserved: 0,
    },
    {
      branchId: hnBranchId,
      productId: prodFmcgId,
      binId: hnDryBinId,
      batchNo: 'LOT-FMCG-2026-11',
      expDate: new Date('2027-06-30T00:00:00Z'),
      qtyOnHand: 340,
      qtyReserved: 20,
    },
  ];

  for (const s of stocksData) {
    await prisma.stock.upsert({
      where: {
        branchId_productId_binId_batchNo: {
          branchId: s.branchId,
          productId: s.productId,
          binId: s.binId,
          batchNo: s.batchNo,
        },
      },
      update: { qtyOnHand: s.qtyOnHand, qtyReserved: s.qtyReserved, expDate: s.expDate },
      create: s,
    });
  }

  // 8. Phiếu nhập kho mẫu
  const invTicket = await prisma.inventoryTicket.upsert({
    where: { code: 'PNK-202611-0001' },
    update: {},
    create: {
      code: 'PNK-202611-0001',
      type: TicketType.IMPORT,
      branchId: hcmBranchId,
      status: TicketStatus.COMPLETED,
      createdBy: staffHcmId,
      approvedBy: managerHcmId,
      supplierName: 'Công ty TNHH Công Nghệ VietIoT',
      reason: 'Nhập hàng định kỳ tháng 11/2026',
      details: {
        create: [
          {
            productId: prodIotId,
            binId: hcmDryBinId,
            batchNo: 'LOT-2026-A1',
            qty: 180,
          },
        ],
      },
    },
  });

  // 9. Lệnh điều chuyển liên chi nhánh kèm GPS & SLA
  const now = new Date();
  const etaDate = new Date(now.getTime() + 18 * 60 * 60 * 1000);
  const slaDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const transfer = await prisma.transferTicket.upsert({
    where: { code: 'TRF-202611-0001' },
    update: {},
    create: {
      code: 'TRF-202611-0001',
      sourceBranchId: hcmBranchId,
      destBranchId: dnBranchId,
      status: TransferStatus.IN_TRANSIT,
      createdBy: managerHcmId,
      approvedBy: adminId,
      transportMethod: 'Xe tải lạnh 2.5 tấn',
      driverName: 'Nguyễn Minh Tài',
      driverPhone: '0988777666',
      vehiclePlate: '51C-889.99',
      temperatureC: 4.5,
      eta: etaDate,
      slaDeadline: slaDate,
      dispatchedAt: now,
      currentLat: 12.238791,
      currentLng: 109.196749,
      aiSuggested: true,
      aiConfidence: 94.5,
      details: {
        create: [
          {
            productId: prodIotId,
            qtyRequested: 40,
            qtyReceived: 0,
          },
        ],
      },
      trackingLogs: {
        create: [
          {
            latitude: 10.801465,
            longitude: 106.647328,
            speedKmh: 45.0,
            note: 'Xuất phát từ Kho Tân Bình TP.HCM',
          },
          {
            latitude: 12.238791,
            longitude: 109.196749,
            speedKmh: 62.5,
            note: 'Đang di chuyển qua địa phận Nha Trang - Khánh Hòa',
          },
        ],
      },
    },
  });

  // 10. Đợt kiểm kê mẫu
  await prisma.stockCheck.upsert({
    where: { code: 'KK-202611-0001' },
    update: {},
    create: {
      code: 'KK-202611-0001',
      branchId: hcmBranchId,
      status: StockCheckStatus.APPROVED,
      createdBy: staffHcmId,
      approvedBy: managerHcmId,
      details: {
        create: [
          {
            productId: prodMedId,
            binId: hcmColdBinId,
            qtySystem: 15,
            qtyActual: 12,
            discrepancyQty: -3,
            reason: 'Hư hỏng bao bì do vận chuyển nội bộ',
          },
        ],
      },
    },
  });

  // 11. Đơn hàng khách hàng mẫu
  const orderSla = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const customerOrder = await prisma.customerOrder.upsert({
    where: { code: 'ORD-202611-0001' },
    update: {},
    create: {
      code: 'ORD-202611-0001',
      channel: 'SHOPEE',
      customerName: 'Công ty Cổ phần Logistics Sài Gòn',
      customerAddress: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
      lat: 10.777928,
      lng: 106.701988,
      assignedBranchId: hcmBranchId,
      status: OrderStatus.PACKING,
      pickingProgress: 75,
      totalAmount: 6250000,
      slaDeadline: orderSla,
      details: {
        create: [
          {
            productId: prodIotId,
            qty: 5,
            price: 1250000,
          },
        ],
      },
    },
  });

  // 12. Cảnh báo AI & Nhật ký kiểm toán mẫu (Idempotent qua findFirst)
  const existingAlert = await prisma.aiAlert.findFirst({
    where: {
      alertType: AlertType.LOW_STOCK,
      branchId: hcmBranchId,
      productId: prodMedId,
    },
  });

  if (!existingAlert) {
    await prisma.aiAlert.create({
      data: {
        alertType: AlertType.LOW_STOCK,
        severity: AlertSeverity.HIGH,
        branchId: hcmBranchId,
        productId: prodMedId,
        title: 'Cảnh báo tồn kho dưới định mức tối thiểu & cận hạn sử dụng',
        message: 'Bộ test nhanh y tế tại Kho HCM chỉ còn 12 hộp (Min Stock: 30) và lô LOT-MED-2026-09 sắp hết hạn.',
        payload: {
          currentQty: 12,
          minStock: 30,
          suggestedAction: 'CREATE_IMPORT_OR_TRANSFER',
        },
      },
    });
  }

  const existingAudit = await prisma.systemAuditLog.findFirst({
    where: {
      module: 'SEED',
      actionType: AuditActionType.CREATE,
    },
  });

  if (!existingAudit) {
    await prisma.systemAuditLog.create({
      data: {
        userId: adminId,
        actionType: AuditActionType.CREATE,
        module: 'SEED',
        oldData: Prisma.JsonNull,
        newData: {
          inventoryTicketId: invTicket.id.toString(),
          transferTicketId: transfer.id.toString(),
          customerOrderId: customerOrder.id.toString(),
        },
        ipAddress: '127.0.0.1',
      },
    });
  }

  console.log('Seed dữ liệu thành công!');
}

main()
  .catch((err: unknown) => {
    console.error('Seed thất bại:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
