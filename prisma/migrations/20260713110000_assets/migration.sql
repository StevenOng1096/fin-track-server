-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('GOLD', 'USD', 'STOCK');

-- CreateEnum
CREATE TYPE "AssetTransactionType" AS ENUM ('INITIAL', 'BUY', 'SELL', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "avgCostPerUnitIdr" DECIMAL(20,2),
    "pricePerUnitIdr" DECIMAL(20,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetTransactionType" NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "pricePerUnitIdr" DECIMAL(20,2) NOT NULL,
    "totalValueIdr" BIGINT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_userId_type_idx" ON "assets"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assets_userId_symbol_key" ON "assets"("userId", "symbol");

-- CreateIndex
CREATE INDEX "asset_transactions_userId_occurredAt_idx" ON "asset_transactions"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "asset_transactions_assetId_occurredAt_idx" ON "asset_transactions"("assetId", "occurredAt");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
