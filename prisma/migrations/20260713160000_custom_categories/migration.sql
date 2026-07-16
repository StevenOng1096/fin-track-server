-- Custom categories/subcategories are scoped per user (userId set).
-- Seeded defaults keep userId NULL so existing data is unchanged.

ALTER TABLE "transaction_categories" ADD COLUMN "userId" TEXT;
ALTER TABLE "transaction_categories" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transaction_categories" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "transaction_subcategories" ADD COLUMN "userId" TEXT;
ALTER TABLE "transaction_subcategories" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transaction_subcategories" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "transaction_categories_userId_flow_sortOrder_idx"
  ON "transaction_categories"("userId", "flow", "sortOrder");
CREATE INDEX "transaction_subcategories_userId_categoryId_idx"
  ON "transaction_subcategories"("userId", "categoryId");

ALTER TABLE "transaction_categories"
  ADD CONSTRAINT "transaction_categories_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_subcategories"
  ADD CONSTRAINT "transaction_subcategories_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow deleting custom categories (system rows stay userId NULL).
ALTER TABLE "transaction_subcategories"
  DROP CONSTRAINT "transaction_subcategories_categoryId_fkey";

ALTER TABLE "transaction_subcategories"
  ADD CONSTRAINT "transaction_subcategories_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
