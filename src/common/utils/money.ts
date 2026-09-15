import { Prisma } from '@prisma/client';

export const IDR_DECIMALS = 2;
export const IDR_AMOUNT_REGEX = /^\d+(\.\d+)?$/;
export const IDR_POSITIVE_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
export const IDR_POSITIVE_AMOUNT_MESSAGE =
  'Enter an amount greater than 0 (up to 2 decimal places).';
export const IDR_NON_NEGATIVE_AMOUNT_MESSAGE =
  'Enter a valid amount (0 or more, up to 2 decimal places).';
export const CURRENCY_IDR = 'IDR';

export const ZERO_IDR = new Prisma.Decimal(0);

/** Normalize user/API decimal input (comma or dot) to a dot-decimal string. */
export function normalizeIdrDecimalInput(value: string): string {
  return value.trim().replace(',', '.');
}

/** Truncate extra decimal digits (495.042134 → 495.04). */
function truncateToTwoDecimals(normalized: string): string {
  const [wholePart = '0', fractionPart = ''] = normalized.split('.');
  const fraction = (fractionPart + '00').slice(0, IDR_DECIMALS);
  return fraction.length > 0 ? `${wholePart}.${fraction}` : wholePart;
}

function normalizeAmountDecimal(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(IDR_DECIMALS));
}

export function parseAmount(
  value: string | number | Prisma.Decimal,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    const normalized = normalizeAmountDecimal(value);
    if (normalized.lte(0)) {
      throw new Error('Amount must be positive');
    }
    return normalized;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(IDR_POSITIVE_AMOUNT_MESSAGE);
    }
    const normalized = normalizeAmountDecimal(new Prisma.Decimal(value));
    if (normalized.lte(0)) {
      throw new Error('Amount must be positive');
    }
    return normalized;
  }

  const normalized = normalizeIdrDecimalInput(value);
  if (!IDR_AMOUNT_REGEX.test(normalized)) {
    throw new Error(IDR_POSITIVE_AMOUNT_MESSAGE);
  }

  const truncated = truncateToTwoDecimals(normalized);
  const amount = new Prisma.Decimal(truncated);
  if (amount.lte(0)) {
    throw new Error('Amount must be positive');
  }

  return amount;
}

export function parseNonNegativeAmount(
  value: string | number | Prisma.Decimal,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    if (value.lt(0)) {
      throw new Error('Amount cannot be negative');
    }
    return normalizeAmountDecimal(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(IDR_NON_NEGATIVE_AMOUNT_MESSAGE);
    }
    return normalizeAmountDecimal(new Prisma.Decimal(value));
  }

  const normalized = normalizeIdrDecimalInput(value);
  if (!IDR_AMOUNT_REGEX.test(normalized)) {
    throw new Error(IDR_NON_NEGATIVE_AMOUNT_MESSAGE);
  }

  const truncated = truncateToTwoDecimals(normalized);
  const amount = new Prisma.Decimal(truncated);
  if (amount.lt(0)) {
    throw new Error('Amount cannot be negative');
  }

  return amount;
}

/** Format a stored IDR amount as a dot-decimal string with 2 fraction digits. */
export function formatAmount(
  value: Prisma.Decimal | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '0.00';
  }

  return value.toFixed(IDR_DECIMALS);
}

export function formatSignedAmount(value: Prisma.Decimal): string {
  if (value.eq(0)) {
    return formatAmount(value);
  }

  const prefix = value.gt(0) ? '+' : '-';
  return `${prefix}${formatAmount(value.abs())}`;
}

export function toIdrMoneyFields(value: Prisma.Decimal) {
  return {
    amount: formatAmount(value),
    currency: CURRENCY_IDR,
  };
}

export function transactionDelta(
  type: 'INCOME' | 'EXPENSE' | 'INITIAL_BALANCE' | 'ADJUSTMENT',
  amount: Prisma.Decimal,
): Prisma.Decimal {
  switch (type) {
    case 'INCOME':
    case 'INITIAL_BALANCE':
      return amount;
    case 'EXPENSE':
      return amount.neg();
    case 'ADJUSTMENT':
      return amount;
    default:
      return amount;
  }
}

export function isAdjustmentIncrease(amount: Prisma.Decimal): boolean {
  return amount.gt(0);
}

export function recurringToTransactionType(
  type: 'DEBT' | 'RECEIVABLE',
): 'INCOME' | 'EXPENSE' {
  return type === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE';
}
