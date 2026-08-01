import { Prisma } from '@prisma/client';
import {
  IDR_AMOUNT_REGEX,
  IDR_NON_NEGATIVE_AMOUNT_MESSAGE,
  ZERO_IDR,
  normalizeIdrDecimalInput,
} from './money';

export function parseQuantity(value: string | number): Prisma.Decimal {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Quantity must be a non-negative number');
    }
    return new Prisma.Decimal(value);
  }

  const normalized = normalizeIdrDecimalInput(value);
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Quantity must be a non-negative decimal number');
  }

  return new Prisma.Decimal(normalized);
}

export function parsePriceIdr(
  value: string | number | Prisma.Decimal,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    if (value.lt(0)) {
      throw new Error('Price must be non-negative');
    }
    return normalizePriceDecimal(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Price must be a non-negative number');
    }
    return normalizePriceDecimal(new Prisma.Decimal(value));
  }

  const normalized = normalizeIdrDecimalInput(value);
  if (!IDR_AMOUNT_REGEX.test(normalized)) {
    throw new Error(IDR_NON_NEGATIVE_AMOUNT_MESSAGE);
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

export function computeTotalValueIdr(
  quantity: Prisma.Decimal,
  pricePerUnitIdr: Prisma.Decimal,
): Prisma.Decimal {
  return normalizePriceDecimal(quantity.mul(pricePerUnitIdr));
}

export function computeMarketValueIdr(
  quantity: Prisma.Decimal,
  pricePerUnitIdr: Prisma.Decimal | null,
): Prisma.Decimal {
  if (!pricePerUnitIdr) {
    return ZERO_IDR;
  }

  return computeTotalValueIdr(quantity, pricePerUnitIdr);
}

export function computeCostBasisIdr(
  quantity: Prisma.Decimal,
  avgCostPerUnitIdr: Prisma.Decimal | null,
): Prisma.Decimal {
  if (!avgCostPerUnitIdr) {
    return ZERO_IDR;
  }

  return computeTotalValueIdr(quantity, avgCostPerUnitIdr);
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

  const existingAvg = currentAvg ?? ZERO_IDR;
  const totalCost = currentQty.mul(existingAvg).add(addedQty.mul(addedPrice));
  const totalQty = currentQty.add(addedQty);

  return totalCost.div(totalQty);
}
