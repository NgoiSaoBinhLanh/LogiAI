import { AuditActionType } from '@prisma/client';
import { prisma } from '../../config/database';
import { invalidateUsersRbacCache } from '../../config/redis';
import { emitRbacUpdate } from '../../sockets/socket.server';
import { recordAuditLog } from '../../utils/audit';
import {
  CloneRoleInput,
  CreateRoleInput,
  UpdateRolePermissionsInput,
} from './roles.schema';

export class RoleDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  ADMIN: [
    'USER_READ',
    'USER_WRITE',
    'ROLE_MANAGE',
    'BRANCH_READ',
    'BRANCH_WRITE',
    'PRODUCT_READ',
    'PRODUCT_WRITE',
    'STOCK_READ',
    'TICKET_CREATE',
    'TICKET_APPROVE',
    'TRANSFER_TRACK',
    'ORDER_READ',
    'ORDER_ALLOCATE',
    'AUDIT_READ',
    'ALERT_MANAGE',
  ],
  BRANCH_MANAGER: [
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
  WAREHOUSE_STAFF: ['BRANCH_READ', 'PRODUCT_READ', 'STOCK_READ', 'TICKET_CREATE', 'ORDER_READ'],
  DISPATCHER: [
    'BRANCH_READ',
    'STOCK_READ',
    'TRANSFER_TRACK',
    'ORDER_READ',
    'ORDER_ALLOCATE',
    'ALERT_MANAGE',
  ],
};

export class RolesService {
  async listPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    return permissions;
  }

  async listRoles() {
    const roles = await prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, code: true, name: true, module: true } } },
        },
        _count: {
          select: { users: true, userRoles: true },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description,
      permissionVersion: r.permissionVersion,
      updatedAt: r.updatedAt,
      userCount: Math.max(r._count.users, r._count.userRoles),
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }

  async createRole(input: CreateRoleInput, actorId: bigint, ipAddress: string | null) {
    const existing = await prisma.role.findUnique({ where: { roleCode: input.roleCode } });
    if (existing) {
      throw new RoleDomainError('DUPLICATE_ROLE', 'Tên/Mã vai trò đã tồn tại', 409);
    }

    const role = await prisma.role.create({
      data: {
        roleCode: input.roleCode,
        roleName: input.roleName,
        description: input.description ?? null,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'RBAC',
      newData: { roleCode: role.roleCode, roleName: role.roleName },
      ipAddress,
    });

    return {
      ...role,
      userCount: 0,
      permissions: [] as string[],
    };
  }

  async cloneRole(
    sourceRoleId: bigint,
    input: CloneRoleInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const source = await prisma.role.findUnique({
      where: { id: sourceRoleId },
      include: { rolePermissions: true },
    });
    if (!source) {
      throw new RoleDomainError('ROLE_NOT_FOUND', 'Không tìm thấy vai trò nguồn', 404);
    }

    const dup = await prisma.role.findUnique({ where: { roleCode: input.roleCode } });
    if (dup) {
      throw new RoleDomainError('DUPLICATE_ROLE', 'Mã vai trò mới đã tồn tại', 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          roleCode: input.roleCode,
          roleName: input.roleName,
          description: input.description ?? `Sao chép từ ${source.roleName}`,
        },
      });

      if (source.rolePermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: source.rolePermissions.map((rp) => ({
            roleId: role.id,
            permissionId: rp.permissionId,
          })),
        });
      }

      return role;
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'RBAC',
      newData: { clonedFrom: source.roleCode, newRoleCode: created.roleCode },
      ipAddress,
    });

    return created;
  }

  async updateRolePermissions(
    roleId: bigint,
    input: UpdateRolePermissionsInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });

    if (!role) {
      throw new RoleDomainError('ROLE_NOT_FOUND', 'Không tìm thấy vai trò', 404);
    }

    // PB03 Constraint: Không cho phép tước quyền quản trị tối cao của Super Admin (ADMIN)
    if (role.roleCode === 'ADMIN') {
      const requiredAdminPerms = ['ROLE_MANAGE', 'USER_READ', 'USER_WRITE'];
      const missingCritical = requiredAdminPerms.filter((p) => !input.permissionCodes.includes(p));
      if (missingCritical.length > 0) {
        throw new RoleDomainError(
          'PROTECTED_ADMIN_ROLE',
          'Không được phép thu hồi quyền quản trị cốt lõi của vai trò ADMIN mặc định',
          400
        );
      }
    }

    const validPerms = await prisma.permission.findMany({
      where: { code: { in: input.permissionCodes } },
    });

    const oldPerms = role.rolePermissions.map((rp) => rp.permission.code);

    const affectedUsers = await prisma.user.findMany({
      where: {
        OR: [{ roleId: role.id }, { userRoles: { some: { roleId: role.id } } }],
      },
      select: { id: true },
    });
    const affectedUserIds = affectedUsers.map((u) => u.id);

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

      if (validPerms.length > 0) {
        await tx.rolePermission.createMany({
          data: validPerms.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }

      await tx.role.update({
        where: { id: role.id },
        data: { permissionVersion: { increment: 1 } },
      });

      if (affectedUserIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: affectedUserIds } },
          data: { permissionVersion: { increment: 1 } },
        });
      }
    });

    // Vô hiệu hóa cache Redis ngay lập tức & phát sự kiện Realtime cho các client thuộc vai trò này
    await invalidateUsersRbacCache(affectedUserIds);
    emitRbacUpdate(affectedUserIds, role.roleCode);

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.PERMISSION_CHANGE,
      module: 'RBAC',
      oldData: { roleCode: role.roleCode, permissions: oldPerms },
      newData: {
        roleCode: role.roleCode,
        permissions: validPerms.map((p) => p.code),
      },
      ipAddress,
    });

    return {
      roleId: role.id,
      roleCode: role.roleCode,
      permissions: validPerms.map((p) => p.code),
      affectedUsersCount: affectedUserIds.length,
    };
  }

  async resetRoleDefault(roleId: bigint, actorId: bigint, ipAddress: string | null) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new RoleDomainError('ROLE_NOT_FOUND', 'Không tìm thấy vai trò', 404);
    }

    const defaultCodes = DEFAULT_ROLE_PERMS[role.roleCode] || [];
    return this.updateRolePermissions(
      roleId,
      { permissionCodes: defaultCodes, otpVerified: true },
      actorId,
      ipAddress
    );
  }
}

export const rolesService = new RolesService();
