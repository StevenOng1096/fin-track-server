export function parseAmount(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    if (value <= 0n) {
      throw new Error('Amount must be positive');
    }
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('Amount must be a positive integer');
    }
    return BigInt(value);
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Amount must be a positive integer in IDR');
  }

  return BigInt(normalized);
}

export function parseNonNegativeAmount(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new Error('Amount cannot be negative');
    }
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Amount must be a non-negative integer');
    }
    return BigInt(value);
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Amount must be a non-negative integer in IDR');
  }

  return BigInt(normalized);
}

export function formatAmount(amount: bigint): string {
  return amount < 0n ? (-amount).toString() : amount.toString();
}

export function formatSignedAmount(amount: bigint): string {
  return amount.toString();
}

export function transactionDelta(
  type: 'INCOME' | 'EXPENSE' | 'INITIAL_BALANCE' | 'ADJUSTMENT',
  amount: bigint,
): bigint {
  switch (type) {
    case 'INCOME':
    case 'INITIAL_BALANCE':
      return amount;
    case 'EXPENSE':
      return -amount;
    case 'ADJUSTMENT':
      return amount;
    default:
      return amount;
  }
}

export function isAdjustmentIncrease(amount: bigint): boolean {
  return amount > 0n;
}

export function recurringToTransactionType(
  type: 'DEBT' | 'RECEIVABLE',
): 'INCOME' | 'EXPENSE' {
  return type === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE';
}
