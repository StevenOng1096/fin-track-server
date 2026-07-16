-- CreateEnum
CREATE TYPE "CategoryFlow" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flow" "CategoryFlow" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_subcategories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transaction_subcategories_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable — existing transactions keep working)
ALTER TABLE "transactions" ADD COLUMN "subcategoryId" TEXT;

-- CreateIndex
CREATE INDEX "transaction_categories_flow_sortOrder_idx" ON "transaction_categories"("flow", "sortOrder");
CREATE INDEX "transaction_subcategories_categoryId_sortOrder_idx" ON "transaction_subcategories"("categoryId", "sortOrder");
CREATE INDEX "transactions_subcategoryId_idx" ON "transactions"("subcategoryId");

-- AddForeignKey
ALTER TABLE "transaction_subcategories" ADD CONSTRAINT "transaction_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "transaction_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categories
INSERT INTO "transaction_categories" ("id", "name", "flow", "sortOrder") VALUES
  ('expense-food', 'Food', 'EXPENSE', 1),
  ('expense-transportation', 'Transportation', 'EXPENSE', 2),
  ('expense-housing', 'Housing', 'EXPENSE', 3),
  ('expense-shopping', 'Shopping', 'EXPENSE', 4),
  ('expense-entertainment', 'Entertainment', 'EXPENSE', 5),
  ('income-salary', 'Salary', 'INCOME', 1),
  ('income-investment', 'Investment', 'INCOME', 2);

-- Seed subcategories
INSERT INTO "transaction_subcategories" ("id", "categoryId", "name", "sortOrder") VALUES
  -- Food
  ('expense-food-coffee', 'expense-food', 'Coffee', 1),
  ('expense-food-restaurant', 'expense-food', 'Restaurant', 2),
  ('expense-food-fast-food', 'expense-food', 'Fast Food', 3),
  ('expense-food-groceries', 'expense-food', 'Groceries', 4),
  -- Transportation
  ('expense-transportation-fuel', 'expense-transportation', 'Fuel', 1),
  ('expense-transportation-parking', 'expense-transportation', 'Parking', 2),
  ('expense-transportation-taxi', 'expense-transportation', 'Taxi', 3),
  ('expense-transportation-bus', 'expense-transportation', 'Bus', 4),
  ('expense-transportation-train', 'expense-transportation', 'Train', 5),
  -- Housing, Shopping, Entertainment (single default sub each)
  ('expense-housing-general', 'expense-housing', 'Housing', 1),
  ('expense-shopping-general', 'expense-shopping', 'Shopping', 1),
  ('expense-entertainment-general', 'expense-entertainment', 'Entertainment', 1),
  -- Salary
  ('income-salary-monthly', 'income-salary', 'Monthly Salary', 1),
  ('income-salary-bonus', 'income-salary', 'Bonus', 2),
  ('income-salary-overtime', 'income-salary', 'Overtime', 3),
  -- Investment
  ('income-investment-general', 'income-investment', 'Investment', 1);
