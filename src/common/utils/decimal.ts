import { Prisma } from '../../generated/prisma/client';

export function parseQuantity(value: string | number): Prisma.Decimal {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Quantity must be a non-negative number');
    }
    return new Prisma.Decimal(value);
  }

  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Quantity must be a non-negative decimal number');
  }

  return new Prisma.Decimal(normalized);
}

export function parsePriceIdr(value: string | number | bigint): Prisma.Decimal {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new Error('Price must be non-negative');
    }
    return new Prisma.Decimal(value.toString());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Price must be a non-negative number');
    }
    return normalizePriceDecimal(new Prisma.Decimal(value));
  }

  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Price must be a non-negative IDR amount with up to 2 decimals');
  }

  return normalizePriceDecimal(new Prisma.Decimal(normalized));
}

export function formatDecimal(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.toFixed();
}

export function formatPriceIdr(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.toFixed(2);
}

function normalizePriceDecimal(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

export function decimalToBigIntIdr(
  quantity: Prisma.Decimal,
  pricePerUnitIdr: Prisma.Decimal,
): bigint {
  const total = quantity.mul(pricePerUnitIdr);
  return BigInt(total.toFixed(0));
}

export function computeMarketValueIdr(
  quantity: Prisma.Decimal,
  pricePerUnitIdr: Prisma.Decimal | null,
): bigint {
  if (!pricePerUnitIdr) {
    return 0n;
  }

  return decimalToBigIntIdr(quantity, pricePerUnitIdr);
}

export function computeCostBasisIdr(
  quantity: Prisma.Decimal,
  avgCostPerUnitIdr: Prisma.Decimal | null,
): bigint {
  if (!avgCostPerUnitIdr) {
    return 0n;
  }

  return decimalToBigIntIdr(quantity, avgCostPerUnitIdr);
}

export function nextAverageCost(
  currentQty: Prisma.Decimal,
  currentAvg: Prisma.Decimal | null,
  addedQty: Prisma.Decimal,
  addedPrice: Prisma.Decimal,
): Prisma.Decimal {
  if (currentQty.lte(0)) {
    return addedPrice;
  }

  const existingAvg = currentAvg ?? new Prisma.Decimal(0);
  const totalCost = currentQty.mul(existingAvg).add(addedQty.mul(addedPrice));
  const totalQty = currentQty.add(addedQty);

  return totalCost.div(totalQty);
}
