-- Monthly recurring: anchor day + optional category

ALTER TABLE "recurring_transactions"
  ADD COLUMN IF NOT EXISTS "subcategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "anchorDay" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "recurring_transactions"
  ADD CONSTRAINT "recurring_transactions_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "transaction_subcategories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill anchor day from existing next due date
UPDATE "recurring_transactions"
SET "anchorDay" = EXTRACT(DAY FROM "nextDueAt")::INTEGER;

-- Default existing items to monthly
UPDATE "recurring_transactions"
SET "intervalValue" = 1,
    "intervalUnit" = 'MONTH'
WHERE "intervalUnit" != 'MONTH' OR "intervalValue" != 1;

ALTER TABLE "recurring_transactions"
  ALTER COLUMN "intervalValue" SET DEFAULT 1,
  ALTER COLUMN "intervalUnit" SET DEFAULT 'MONTH';
