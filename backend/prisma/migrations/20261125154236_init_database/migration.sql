-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BranchType" AS ENUM ('HUB', 'SATELLITE', 'STORE');

-- CreateEnum
CREATE TYPE "BinStatus" AS ENUM ('ACTIVE', 'FULL', 'MAINTENANCE', 'LOCKED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('IMPORT', 'EXPORT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'DISCREPANCY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCheckStatus" AS ENUM ('COUNTING', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'ALLOCATED', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'REVOKE_TOKEN', 'PERMISSION_CHANGE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'EXPIRING_SOON', 'SLA_BREACH', 'AI_TRANSFER_SUGGESTION', 'CAPACITY_WARNING');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "role" (
    "id" BIGSERIAL NOT NULL,
    "role_code" VARCHAR(50) NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "permission_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "module" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" BIGSERIAL NOT NULL,
    "role_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "branch_type" "BranchType" NOT NULL DEFAULT 'SATELLITE',
    "address" VARCHAR(500) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "capacity" DECIMAL(10,2) NOT NULL,
    "manager_phone" VARCHAR(20),
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "branch_id" BIGINT,
    "role_id" BIGINT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "permission_version" INTEGER NOT NULL DEFAULT 1,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin" (
    "id" BIGSERIAL NOT NULL,
    "zone_id" BIGINT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "max_capacity" DECIMAL(10,2) NOT NULL,
    "status" "BinStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" BIGSERIAL NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "barcode" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cost_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(10,2),
    "dimensions" VARCHAR(100),
    "storage_condition" VARCHAR(255),
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "max_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" BIGSERIAL NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "bin_id" BIGINT NOT NULL,
    "batch_no" VARCHAR(100) NOT NULL,
    "exp_date" DATE,
    "qty_on_hand" INTEGER NOT NULL DEFAULT 0,
    "qty_reserved" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ticket" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" "TicketType" NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" BIGINT NOT NULL,
    "approved_by" BIGINT,
    "supplier_name" VARCHAR(255),
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ticket_detail" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "bin_id" BIGINT NOT NULL,
    "batch_no" VARCHAR(100) NOT NULL DEFAULT 'DEFAULT',
    "exp_date" DATE,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "inventory_ticket_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_ticket" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "source_branch_id" BIGINT NOT NULL,
    "dest_branch_id" BIGINT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" BIGINT NOT NULL,
    "approved_by" BIGINT,
    "transport_method" VARCHAR(100),
    "driver_name" VARCHAR(150),
    "driver_phone" VARCHAR(20),
    "vehicle_plate" VARCHAR(30),
    "temperature_c" DECIMAL(5,2),
    "eta" TIMESTAMPTZ(6),
    "sla_deadline" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "current_lat" DECIMAL(10,8),
    "current_lng" DECIMAL(11,8),
    "ai_suggested" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_ticket_detail" (
    "id" BIGSERIAL NOT NULL,
    "transfer_ticket_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty_requested" INTEGER NOT NULL,
    "qty_received" INTEGER DEFAULT 0,
    "discrepancy_reason" VARCHAR(500),

    CONSTRAINT "transfer_ticket_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_tracking_log" (
    "id" BIGSERIAL NOT NULL,
    "transfer_ticket_id" BIGINT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "speed_kmh" DECIMAL(6,2),
    "note" VARCHAR(255),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_tracking_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_check" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "status" "StockCheckStatus" NOT NULL DEFAULT 'COUNTING',
    "created_by" BIGINT NOT NULL,
    "approved_by" BIGINT,
    "reject_reason" VARCHAR(500),
    "evidence_urls" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_check_detail" (
    "id" BIGSERIAL NOT NULL,
    "stock_check_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "bin_id" BIGINT NOT NULL,
    "qty_system" INTEGER NOT NULL,
    "qty_actual" INTEGER NOT NULL,
    "discrepancy_qty" INTEGER NOT NULL DEFAULT 0,
    "reason" VARCHAR(500),

    CONSTRAINT "stock_check_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(50) NOT NULL DEFAULT 'WEBSITE',
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_address" VARCHAR(500) NOT NULL,
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(11,8),
    "assigned_branch_id" BIGINT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "tracking_number" VARCHAR(100),
    "carrier_name" VARCHAR(100),
    "picking_progress" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sla_deadline" TIMESTAMPTZ(6),
    "packed_at" TIMESTAMPTZ(6),
    "handed_over_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_detail" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "customer_order_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action_type" "AuditActionType" NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_alert" (
    "id" BIGSERIAL NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "branch_id" BIGINT,
    "product_id" BIGINT,
    "transfer_ticket_id" BIGINT,
    "order_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" BIGINT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_role_code_key" ON "role"("role_code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE INDEX "permission_module_idx" ON "permission"("module");

-- CreateIndex
CREATE INDEX "role_permission_role_id_idx" ON "role_permission"("role_id");

-- CreateIndex
CREATE INDEX "role_permission_permission_id_idx" ON "role_permission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_role_user_id_idx" ON "user_role"("user_id");

-- CreateIndex
CREATE INDEX "user_role_role_id_idx" ON "user_role"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_user_id_role_id_key" ON "user_role"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_is_revoked_idx" ON "refresh_token"("user_id", "is_revoked");

-- CreateIndex
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "branch_code_key" ON "branch"("code");

-- CreateIndex
CREATE INDEX "branch_status_idx" ON "branch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_branch_id_status_idx" ON "user"("branch_id", "status");

-- CreateIndex
CREATE INDEX "user_role_id_idx" ON "user"("role_id");

-- CreateIndex
CREATE INDEX "zone_branch_id_idx" ON "zone"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_branch_id_code_key" ON "zone"("branch_id", "code");

-- CreateIndex
CREATE INDEX "bin_zone_id_idx" ON "bin"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_zone_id_code_key" ON "bin"("zone_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "category_code_key" ON "category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_key" ON "product"("barcode");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_name_idx" ON "product"("name");

-- CreateIndex
CREATE INDEX "stock_branch_id_product_id_idx" ON "stock"("branch_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_product_id_batch_no_idx" ON "stock"("product_id", "batch_no");

-- CreateIndex
CREATE INDEX "stock_exp_date_idx" ON "stock"("exp_date");

-- CreateIndex
CREATE INDEX "stock_bin_id_idx" ON "stock"("bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_branch_id_product_id_bin_id_batch_no_key" ON "stock"("branch_id", "product_id", "bin_id", "batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ticket_code_key" ON "inventory_ticket"("code");

-- CreateIndex
CREATE INDEX "inventory_ticket_branch_id_status_created_at_idx" ON "inventory_ticket"("branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "inventory_ticket_type_status_idx" ON "inventory_ticket"("type", "status");

-- CreateIndex
CREATE INDEX "inventory_ticket_detail_ticket_id_idx" ON "inventory_ticket_detail"("ticket_id");

-- CreateIndex
CREATE INDEX "inventory_ticket_detail_product_id_idx" ON "inventory_ticket_detail"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_ticket_code_key" ON "transfer_ticket"("code");

-- CreateIndex
CREATE INDEX "transfer_ticket_source_branch_id_status_idx" ON "transfer_ticket"("source_branch_id", "status");

-- CreateIndex
CREATE INDEX "transfer_ticket_dest_branch_id_status_idx" ON "transfer_ticket"("dest_branch_id", "status");

-- CreateIndex
CREATE INDEX "transfer_ticket_status_eta_idx" ON "transfer_ticket"("status", "eta");

-- CreateIndex
CREATE INDEX "transfer_ticket_status_sla_deadline_idx" ON "transfer_ticket"("status", "sla_deadline");

-- CreateIndex
CREATE INDEX "transfer_ticket_created_at_idx" ON "transfer_ticket"("created_at");

-- CreateIndex
CREATE INDEX "transfer_ticket_detail_transfer_ticket_id_idx" ON "transfer_ticket_detail"("transfer_ticket_id");

-- CreateIndex
CREATE INDEX "transfer_ticket_detail_product_id_idx" ON "transfer_ticket_detail"("product_id");

-- CreateIndex
CREATE INDEX "transfer_tracking_log_transfer_ticket_id_recorded_at_idx" ON "transfer_tracking_log"("transfer_ticket_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_check_code_key" ON "stock_check"("code");

-- CreateIndex
CREATE INDEX "stock_check_branch_id_status_created_at_idx" ON "stock_check"("branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "stock_check_detail_stock_check_id_idx" ON "stock_check_detail"("stock_check_id");

-- CreateIndex
CREATE INDEX "stock_check_detail_product_id_idx" ON "stock_check_detail"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_code_key" ON "customer_order"("code");

-- CreateIndex
CREATE INDEX "customer_order_assigned_branch_id_status_idx" ON "customer_order"("assigned_branch_id", "status");

-- CreateIndex
CREATE INDEX "customer_order_status_sla_deadline_created_at_idx" ON "customer_order"("status", "sla_deadline", "created_at");

-- CreateIndex
CREATE INDEX "customer_order_detail_order_id_idx" ON "customer_order_detail"("order_id");

-- CreateIndex
CREATE INDEX "customer_order_detail_product_id_idx" ON "customer_order_detail"("product_id");

-- CreateIndex
CREATE INDEX "system_audit_log_user_id_created_at_idx" ON "system_audit_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "system_audit_log_module_action_type_created_at_idx" ON "system_audit_log"("module", "action_type", "created_at");

-- CreateIndex
CREATE INDEX "ai_alert_is_resolved_severity_created_at_idx" ON "ai_alert"("is_resolved", "severity", "created_at");

-- CreateIndex
CREATE INDEX "ai_alert_branch_id_is_resolved_idx" ON "ai_alert"("branch_id", "is_resolved");

-- CreateIndex
CREATE INDEX "ai_alert_alert_type_is_resolved_idx" ON "ai_alert"("alert_type", "is_resolved");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin" ADD CONSTRAINT "bin_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket" ADD CONSTRAINT "inventory_ticket_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket" ADD CONSTRAINT "inventory_ticket_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket" ADD CONSTRAINT "inventory_ticket_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket_detail" ADD CONSTRAINT "inventory_ticket_detail_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "inventory_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket_detail" ADD CONSTRAINT "inventory_ticket_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ticket_detail" ADD CONSTRAINT "inventory_ticket_detail_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket" ADD CONSTRAINT "transfer_ticket_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket" ADD CONSTRAINT "transfer_ticket_dest_branch_id_fkey" FOREIGN KEY ("dest_branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket" ADD CONSTRAINT "transfer_ticket_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket" ADD CONSTRAINT "transfer_ticket_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket_detail" ADD CONSTRAINT "transfer_ticket_detail_transfer_ticket_id_fkey" FOREIGN KEY ("transfer_ticket_id") REFERENCES "transfer_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_ticket_detail" ADD CONSTRAINT "transfer_ticket_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_tracking_log" ADD CONSTRAINT "transfer_tracking_log_transfer_ticket_id_fkey" FOREIGN KEY ("transfer_ticket_id") REFERENCES "transfer_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check" ADD CONSTRAINT "stock_check_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check" ADD CONSTRAINT "stock_check_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check" ADD CONSTRAINT "stock_check_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check_detail" ADD CONSTRAINT "stock_check_detail_stock_check_id_fkey" FOREIGN KEY ("stock_check_id") REFERENCES "stock_check"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check_detail" ADD CONSTRAINT "stock_check_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_check_detail" ADD CONSTRAINT "stock_check_detail_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_assigned_branch_id_fkey" FOREIGN KEY ("assigned_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_detail" ADD CONSTRAINT "customer_order_detail_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_detail" ADD CONSTRAINT "customer_order_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_audit_log" ADD CONSTRAINT "system_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_alert" ADD CONSTRAINT "ai_alert_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_alert" ADD CONSTRAINT "ai_alert_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_alert" ADD CONSTRAINT "ai_alert_transfer_ticket_id_fkey" FOREIGN KEY ("transfer_ticket_id") REFERENCES "transfer_ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_alert" ADD CONSTRAINT "ai_alert_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_alert" ADD CONSTRAINT "ai_alert_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
