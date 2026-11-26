import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermissions,
} from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { productsController } from './products.controller';
import {
  createCategorySchema,
  createProductSchema,
  importProductsSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from './products.schema';

const router = Router();

router.get(
  '/categories',
  authenticate,
  requireAnyPermission('PRODUCT_READ', 'PRODUCT_WRITE', 'STOCK_READ', 'TICKET_CREATE'),
  (req, res, next) => productsController.listCategories(req, res, next)
);

router.post(
  '/categories',
  authenticate,
  requirePermissions('PRODUCT_WRITE'),
  validateRequest({ body: createCategorySchema }),
  (req, res, next) => productsController.createCategory(req, res, next)
);

router.get(
  '/products',
  authenticate,
  requireAnyPermission(
    'PRODUCT_READ',
    'PRODUCT_WRITE',
    'STOCK_READ',
    'TICKET_CREATE',
    'ORDER_ALLOCATE'
  ),
  validateRequest({ query: listProductsQuerySchema }),
  (req, res, next) => productsController.listProducts(req, res, next)
);

router.post(
  '/products',
  authenticate,
  requirePermissions('PRODUCT_WRITE'),
  validateRequest({ body: createProductSchema }),
  (req, res, next) => productsController.createProduct(req, res, next)
);

router.post(
  '/products/import',
  authenticate,
  requirePermissions('PRODUCT_WRITE'),
  validateRequest({ body: importProductsSchema }),
  (req, res, next) => productsController.importProducts(req, res, next)
);

router.patch(
  '/products/:id',
  authenticate,
  requirePermissions('PRODUCT_WRITE'),
  validateRequest({ body: updateProductSchema }),
  (req, res, next) => productsController.updateProduct(req, res, next)
);

export const productsRouter = router;
