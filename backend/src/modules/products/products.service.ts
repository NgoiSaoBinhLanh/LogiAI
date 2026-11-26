import { AuditActionType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateCategoryInput,
  CreateProductInput,
  ImportProductsInput,
  ListProductsQuery,
  UpdateProductInput,
} from './products.schema';

export class ProductDomainError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class ProductsService {
  async listCategories() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async createCategory(input: CreateCategoryInput, actorId: bigint, ipAddress: string | null) {
    const dup = await prisma.category.findUnique({ where: { code: input.code } });
    if (dup) {
      throw new ProductDomainError('DUPLICATE_CATEGORY', 'Mã danh mục đã tồn tại', 409);
    }

    const cat = await prisma.category.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'CATEGORY',
      newData: { id: cat.id.toString(), code: cat.code, name: cat.name },
      ipAddress,
    });

    return cat;
  }

  async listProducts(query: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {};
    if (query.categoryId) {
      where.categoryId = BigInt(query.categoryId);
    }
    if (query.search) {
      where.OR = [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
          stocks: {
            select: { qtyOnHand: true, qtyReserved: true },
          },
        },
      }),
    ]);

    const mapped = items.map((p) => {
      const totalOnHand = p.stocks.reduce((acc, s) => acc + s.qtyOnHand, 0);
      const totalReserved = p.stocks.reduce((acc, s) => acc + s.qtyReserved, 0);
      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        categoryId: p.categoryId,
        category: p.category,
        unit: p.unit,
        unitPrice: Number(p.unitPrice),
        costPrice: Number(p.costPrice),
        weight: p.weight ? Number(p.weight) : null,
        dimensions: p.dimensions,
        storageCondition: p.storageCondition,
        minStock: p.minStock,
        maxStock: p.maxStock,
        totalOnHand,
        totalAvailable: totalOnHand - totalReserved,
        createdAt: p.createdAt,
      };
    });

    return {
      items: mapped,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createProduct(input: CreateProductInput, actorId: bigint, ipAddress: string | null) {
    const dup = await prisma.product.findFirst({
      where: { OR: [{ sku: input.sku }, { barcode: input.barcode }] },
    });
    if (dup) {
      throw new ProductDomainError('DUPLICATE_SKU_BARCODE', 'Mã SKU hoặc Barcode đã tồn tại', 409);
    }

    const product = await prisma.product.create({
      data: {
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        categoryId: BigInt(input.categoryId),
        unit: input.unit,
        unitPrice: input.unitPrice,
        costPrice: input.costPrice,
        weight: input.weight ?? null,
        dimensions: input.dimensions ?? null,
        storageCondition: input.storageCondition ?? null,
        minStock: input.minStock,
        maxStock: input.maxStock,
      },
      include: { category: { select: { id: true, code: true, name: true } } },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'PRODUCT',
      newData: { id: product.id.toString(), sku: product.sku, name: product.name },
      ipAddress,
    });

    return product;
  }

  async updateProduct(
    productId: bigint,
    input: UpdateProductInput,
    actorId: bigint,
    ipAddress: string | null
  ) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new ProductDomainError('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm', 404);
    }

    if (input.sku || input.barcode) {
      const dup = await prisma.product.findFirst({
        where: {
          NOT: { id: productId },
          OR: [
            ...(input.sku ? [{ sku: input.sku }] : []),
            ...(input.barcode ? [{ barcode: input.barcode }] : []),
          ],
        },
      });
      if (dup) {
        throw new ProductDomainError('DUPLICATE_SKU_BARCODE', 'Mã SKU hoặc Barcode đã tồn tại', 409);
      }
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.categoryId !== undefined ? { categoryId: BigInt(input.categoryId) } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
        ...(input.dimensions !== undefined ? { dimensions: input.dimensions } : {}),
        ...(input.storageCondition !== undefined
          ? { storageCondition: input.storageCondition }
          : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.maxStock !== undefined ? { maxStock: input.maxStock } : {}),
      },
    });

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.UPDATE,
      module: 'PRODUCT',
      oldData: { sku: existing.sku, name: existing.name },
      newData: { sku: updated.sku, name: updated.name },
      ipAddress,
    });

    return updated;
  }

  async importProducts(input: ImportProductsInput, actorId: bigint, ipAddress: string | null) {
    const categories = await prisma.category.findMany();
    const catByCode = new Map<string, bigint>(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const fallbackCatId = categories[0]?.id;

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of input.items) {
      let categoryId = catByCode.get(item.categoryCode.toUpperCase());
      if (!categoryId) {
        if (fallbackCatId) {
          categoryId = fallbackCatId;
        } else {
          const newCat = await prisma.category.create({
            data: { code: item.categoryCode.toUpperCase(), name: item.categoryCode },
          });
          categoryId = newCat.id;
          catByCode.set(newCat.code, newCat.id);
        }
      }

      const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            barcode: item.barcode,
            name: item.name,
            categoryId,
            unit: item.unit,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            minStock: item.minStock,
            maxStock: item.maxStock,
          },
        });
        updatedCount++;
      } else {
        await prisma.product.create({
          data: {
            sku: item.sku,
            barcode: item.barcode,
            name: item.name,
            categoryId,
            unit: item.unit,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            minStock: item.minStock,
            maxStock: item.maxStock,
          },
        });
        createdCount++;
      }
    }

    await recordAuditLog({
      userId: actorId,
      actionType: AuditActionType.CREATE,
      module: 'PRODUCT_IMPORT',
      newData: { total: input.items.length, createdCount, updatedCount },
      ipAddress,
    });

    return { total: input.items.length, createdCount, updatedCount };
  }
}

export const productsService = new ProductsService();
