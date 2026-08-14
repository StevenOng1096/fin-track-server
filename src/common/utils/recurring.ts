import { RecurringIntervalUnit } from '@prisma/client';
import { addDays, addMonths, addWeeks } from './date';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Start of calendar day in local time. */
export function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Day of month to use for a recurring anchor.
 * If the month is shorter than anchorDay, clamp to 28 (Feb / short months).
 */
export function effectiveDayInMonth(
  year: number,
  monthIndex: number,
  anchorDay: number,
): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  if (anchorDay <= daysInMonth) {
    return anchorDay;
  }
  return Math.min(28, daysInMonth);
}

/** Build a due date at local midnight for the given month + anchor day. */
export function buildMonthlyDueDate(
  year: number,
  monthIndex: number,
  anchorDay: number,
): Date {
  const day = effectiveDayInMonth(year, monthIndex, anchorDay);
  return startOfLocalDay(new Date(year, monthIndex, day));
}

/**
 * First upcoming due date for a new recurring item.
 * If anchor day is still ahead this month (or is today), use this month.
 */
export function computeInitialNextDueAt(
  anchorDay: number,
  from: Date = new Date(),
): Date {
  const today = startOfLocalDay(from);
  const thisMonth = buildMonthlyDueDate(
    today.getFullYear(),
    today.getMonth(),
    anchorDay,
  );

  if (thisMonth.getTime() >= today.getTime()) {
    return thisMonth;
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return buildMonthlyDueDate(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    anchorDay,
  );
}

/**
 * Next due date after a payment for the current scheduled cycle.
 * Always advances one calendar month from the scheduled due, not the pay date.
 */
export function computeNextMonthlyDueAfter(
  scheduledDue: Date,
  anchorDay: number,
): Date {
  const base = startOfLocalDay(scheduledDue);
  const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return buildMonthlyDueDate(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    anchorDay,
  );
}

/** Whole days from today until due (negative if overdue). */
export function daysUntilDue(nextDueAt: Date, from: Date = new Date()): number {
  const today = startOfLocalDay(from);
  const due = startOfLocalDay(nextDueAt);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function formatDaysUntilDue(
  nextDueAt: Date,
  from: Date = new Date(),
): string {
  const days = daysUntilDue(nextDueAt, from);

  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return 'Due in 1 day';
  }
  if (days > 1) {
    return `Due in ${days} days`;
  }
  if (days === -1) {
    return 'Overdue by 1 day';
  }
  return `Overdue by ${Math.abs(days)} days`;
}

/** Earliest day before next due when manual pay/receive is allowed again after a payment. */
export const RECURRING_EARLY_PAY_WINDOW_DAYS = 28;

export function computeCanMarkPaid(
  recurring: { isActive: boolean; nextDueAt: Date },
  hasExecution: boolean,
  from: Date = new Date(),
): boolean {
  if (!recurring.isActive) {
    return false;
  }

  const days = daysUntilDue(recurring.nextDueAt, from);
  if (hasExecution && days > RECURRING_EARLY_PAY_WINDOW_DAYS) {
    return false;
  }

  return true;
}

/** @deprecated Used by legacy interval-based recurring paths. */
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
