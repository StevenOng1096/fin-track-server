import { addDays, addMonths, addWeeks } from './date';
import { RecurringIntervalUnit } from '@prisma/client';

export function computeNextDueAt(
  from: Date,
  intervalValue: number,
  intervalUnit: RecurringIntervalUnit,
): Date {
  switch (intervalUnit) {
    case 'DAY':
      return addDays(from, intervalValue);
    case 'WEEK':
      return addWeeks(from, intervalValue);
    case 'MONTH':
      return addMonths(from, intervalValue);
    default:
      return addDays(from, intervalValue);
  }
}
