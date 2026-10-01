import { BadRequestException } from '@nestjs/common';

/** End of the current calendar day in the server local timezone. */
export function getEndOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

export function parseOccurredAtInput(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Please enter a valid date.');
  }
  return date;
}

export function assertTransactionOccurredAtNotInFuture(occurredAt: Date): void {
  if (occurredAt.getTime() > getEndOfToday().getTime()) {
    throw new BadRequestException(
      'Transaction date cannot be after today.',
    );
  }
}

export function resolveTransactionOccurredAt(value?: string): Date {
  const occurredAt = value ? parseOccurredAtInput(value) : new Date();
  assertTransactionOccurredAtNotInFuture(occurredAt);
  return occurredAt;
}
