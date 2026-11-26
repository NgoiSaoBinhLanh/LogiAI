import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import {
  createCategorySchema,
  createProductSchema,
  importProductsSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from './products.schema';
import { ProductDomainError, productsService } from './products.service';

export class ProductsController {
  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await productsService.listCategories();
      sendSuccess(res, { categories });
    } catch (err: unknown) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCategorySchema.parse(req.body);
      const category = await productsService.createCategory(
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { category }, 'Tạo danh mục sản phẩm thành công', 201);
    } catch (err: unknown) {
      if (err instanceof ProductDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listProductsQuerySchema.parse(req.query);
      const data = await productsService.listProducts(query);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createProductSchema.parse(req.body);
      const product = await productsService.createProduct(input, req.user!.id, req.ip || null);
      sendSuccess(res, { product }, 'Tạo sản phẩm mới thành công', 201);
    } catch (err: unknown) {
      if (err instanceof ProductDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = BigInt(req.params.id);
      const input = updateProductSchema.parse(req.body);
      const product = await productsService.updateProduct(
        productId,
        input,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(res, { product }, 'Cập nhật sản phẩm thành công');
    } catch (err: unknown) {
      if (err instanceof ProductDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }

  async importProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = importProductsSchema.parse(req.body);
      const result = await productsService.importProducts(input, req.user!.id, req.ip || null);
      sendSuccess(res, result, 'Import danh sách sản phẩm thành công');
    } catch (err: unknown) {
      if (err instanceof ProductDomainError) {
        sendError(res, err.code, err.message, err.status);
        return;
      }
      next(err);
    }
  }
}

export const productsController = new ProductsController();
