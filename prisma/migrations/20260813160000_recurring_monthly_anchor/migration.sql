-- Monthly recurring: anchor day + optional category

ALTER TABLE "recurring_transactions"
  ADD COLUMN IF NOT EXISTS "subcategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "anchorDay" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "recurring_transactions"
  DROP CONSTRAINT IF EXISTS "recurring_transactions_subcategoryId_fkey";

ALTER TABLE "recurring_transactions"
  ADD CONSTRAINT "recurring_transactions_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "transaction_subcategories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "recurring_transactions"
SET "anchorDay" = EXTRACT(DAY FROM "nextDueAt")::INTEGER
WHERE "anchorDay" = 1;

UPDATE "recurring_transactions"
SET "intervalValue" = 1,
    "intervalUnit" = 'MONTH'
WHERE "intervalUnit" != 'MONTH' OR "intervalValue" != 1;

ALTER TABLE "recurring_transactions"
  ALTER COLUMN "intervalValue" SET DEFAULT 1,
  ALTER COLUMN "intervalUnit" SET DEFAULT 'MONTH';
