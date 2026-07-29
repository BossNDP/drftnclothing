-- Migration: add units_sold to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "units_sold" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "products_units_sold_idx" ON "products" ("units_sold");
