import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCategorySchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().optional().nullable(),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(2).max(100),
  barcode: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(255),
  categoryId: z.string().min(1),
  unit: z.string().trim().min(1).max(50),
  unitPrice: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().min(0).default(0),
  weight: z.coerce.number().min(0).optional().nullable(),
  dimensions: z.string().trim().max(100).optional().nullable(),
  storageCondition: z.string().trim().max(255).optional().nullable(),
  minStock: z.coerce.number().int().min(0).default(0),
  maxStock: z.coerce.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const importProductsSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string().trim().min(2).max(100),
      barcode: z.string().trim().min(2).max(100),
      name: z.string().trim().min(2).max(255),
      categoryCode: z.string().trim().min(1),
      unit: z.string().trim().min(1).max(50),
      unitPrice: z.coerce.number().min(0).default(0),
      costPrice: z.coerce.number().min(0).default(0),
      minStock: z.coerce.number().int().min(0).default(0),
      maxStock: z.coerce.number().int().min(0).default(0),
    })
  ).min(1),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ImportProductsInput = z.infer<typeof importProductsSchema>;
