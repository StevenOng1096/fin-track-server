-- AlterTable
ALTER TABLE "wallets" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill sort order from creation date per user
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "wallets"
)
UPDATE "wallets" AS w
SET "sortOrder" = ranked.rn
FROM ranked
WHERE w.id = ranked.id;

-- CreateIndex
CREATE INDEX "wallets_userId_sortOrder_idx" ON "wallets"("userId", "sortOrder");
