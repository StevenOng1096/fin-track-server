import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryFlow,
  Prisma,
  PrismaClient,
  Transaction,
  TransactionType,
} from '@prisma/client';
import { BalanceService } from '../balance/balance.service';
import {
  formatAmount,
  parseAmount,
  parseNonNegativeAmount,
  transactionDelta,
  toIdrMoneyFields,
  ZERO_IDR,
} from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  PeriodSummaryQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

/** Max inclusive days for transaction list queries (supports full calendar months). */
const MAX_DATE_RANGE_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const transactionInclude = {
  subcategory: {
    include: { category: true },
  },
} satisfies Prisma.TransactionInclude;

type TransactionWithSubcategory = Prisma.TransactionGetPayload<{
  include: typeof transactionInclude;
}>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly walletsService: WalletsService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    await this.walletsService.ensureWallet(userId, dto.walletId);
    const { amount, delta } = await this.resolveCreateAmountAndDelta(
      dto.walletId,
      dto.type,
      dto.amount,
      dto.targetBalance,
    );
    const subcategoryId = await this.resolveSubcategory(
      dto.type,
      dto.subcategoryId,
    );

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: dto.walletId,
          type: dto.type,
          amount,
          subcategoryId,
          description: dto.description?.trim() || null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        },
        include: transactionInclude,
      });

      await this.balanceService.applyDelta(tx, dto.walletId, delta);

      return this.toResponse(transaction);
    });
  }

  async findAll(userId: string, query: ListTransactionsQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 100);
    const skip = (page - 1) * limit;
    const occurredAt = this.buildOccurredAtFilter(query.fromDate, query.toDate);

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.walletId ? { walletId: query.walletId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
        include: transactionInclude,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPeriodSummary(userId: string, query: PeriodSummaryQueryDto) {
    const occurredAt = this.buildOccurredAtFilter(query.fromDate, query.toDate);
    if (!occurredAt) {
      throw new BadRequestException('Please select both a start date and an end date.');
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
      type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      ...(query.walletId ? { walletId: query.walletId } : {}),
      occurredAt,
    };

    const [grouped, transactionCount] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    let income = ZERO_IDR;
    let expense = ZERO_IDR;

    for (const row of grouped) {
      const total = this.rawSumToDecimal(row._sum.amount);
      if (row.type === TransactionType.INCOME) {
        income = total;
      } else if (row.type === TransactionType.EXPENSE) {
        expense = total;
      }
    }

    return {
      income: formatAmount(income),
      expense: formatAmount(expense),
      net: formatAmount(income.sub(expense)),
      transactionCount,
    };
  }

  async getMonthlySummary(userId: string, months = 6) {
    const safeMonths = Math.min(Math.max(months, 1), 12);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (safeMonths - 1), 1);

    const rows = await this.prisma.$queryRaw<
      Array<{ month_key: string; type: string; total: Prisma.Decimal }>
    >`
      SELECT
        to_char(date_trunc('month', "occurredAt"), 'YYYY-MM') AS month_key,
        type::text AS type,
        SUM(amount) AS total
      FROM transactions
      WHERE "userId" = ${userId} AND "occurredAt" >= ${start}
      GROUP BY date_trunc('month', "occurredAt"), type
      ORDER BY month_key ASC
    `;

    const buckets = new Map<
      string,
      { income: Prisma.Decimal; expense: Prisma.Decimal; label: string }
    >();

    for (let index = 0; index < safeMonths; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - (safeMonths - 1 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, {
        income: ZERO_IDR,
        expense: ZERO_IDR,
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }

    for (const row of rows) {
      const bucket = buckets.get(row.month_key);
      if (!bucket) continue;

      const total = this.rawSumToDecimal(row.total);

      if (row.type === TransactionType.INCOME) {
        bucket.income = bucket.income.add(total);
      } else if (row.type === TransactionType.EXPENSE) {
        bucket.expense = bucket.expense.add(total);
      }
    }

    return {
      months: [...buckets.entries()].map(([month, values]) => ({
        month,
        label: values.label,
        income: formatAmount(values.income),
        expense: formatAmount(values.expense),
        net: formatAmount(values.income.sub(values.expense)),
      })),
    };
  }

  async getCategoryBreakdown(userId: string, months = 3) {
    const safeMonths = Math.min(Math.max(months, 1), 12);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (safeMonths - 1), 1);

    const rows = await this.prisma.$queryRaw<
      Array<{
        month_key: string;
        type: string;
        category_id: string | null;
        category_name: string | null;
        total: Prisma.Decimal;
      }>
    >`
      SELECT
        to_char(date_trunc('month', t."occurredAt"), 'YYYY-MM') AS month_key,
        t.type::text AS type,
        tc.id AS category_id,
        tc.name AS category_name,
        SUM(t.amount) AS total
      FROM transactions t
      LEFT JOIN transaction_subcategories ts ON t."subcategoryId" = ts.id
      LEFT JOIN transaction_categories tc ON ts."categoryId" = tc.id
      WHERE t."userId" = ${userId}
        AND t.type IN ('INCOME', 'EXPENSE')
        AND t."occurredAt" >= ${start}
      GROUP BY month_key, t.type, tc.id, tc.name
      ORDER BY month_key ASC, total DESC
    `;

    type CategoryBucket = Map<
      string,
      { categoryId: string; name: string; amount: Prisma.Decimal }
    >;

    const monthBuckets = new Map<
      string,
      { label: string; income: CategoryBucket; expense: CategoryBucket }
    >();

    for (let index = 0; index < safeMonths; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - (safeMonths - 1 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, {
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        income: new Map(),
        expense: new Map(),
      });
    }

    for (const row of rows) {
      const bucket = monthBuckets.get(row.month_key);
      if (!bucket) continue;

      const target =
        row.type === TransactionType.INCOME ? bucket.income : bucket.expense;
      const categoryId = row.category_id ?? 'uncategorized';
      const categoryName = row.category_name ?? 'Uncategorized';
      const amount = this.rawSumToDecimal(row.total);
      const existing = target.get(categoryId);

      if (existing) {
        existing.amount = existing.amount.add(amount);
      } else {
        target.set(categoryId, { categoryId, name: categoryName, amount });
      }
    }

    const toCategoryList = (map: CategoryBucket) =>
      [...map.values()]
        .sort((a, b) => b.amount.comparedTo(a.amount))
        .map((item) => ({
          categoryId: item.categoryId,
          name: item.name,
          amount: formatAmount(item.amount),
        }));

    return {
      months: [...monthBuckets.entries()].map(([month, values]) => ({
        month,
        label: values.label,
        income: toCategoryList(values.income),
        expense: toCategoryList(values.expense),
      })),
    };
  }

  async findOne(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundException("We couldn't find that transaction.");
    }

    return this.toResponse(transaction);
  }

  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!existing) {
        throw new NotFoundException("We couldn't find that transaction.");
      }

      if (
        existing.type === TransactionType.ADJUSTMENT ||
        existing.type === TransactionType.INITIAL_BALANCE
      ) {
        throw new BadRequestException(
          'Balance setup transactions cannot be edited. Delete and create a new adjustment instead.',
        );
      }

      if (
        dto.type === TransactionType.ADJUSTMENT ||
        dto.type === TransactionType.INITIAL_BALANCE
      ) {
        throw new BadRequestException(
          'Use the adjustment flow to change wallet balances',
        );
      }

      const nextWalletId = dto.walletId ?? existing.walletId;
      const nextType = dto.type ?? existing.type;
      const nextAmount = dto.amount ? parseAmount(dto.amount) : existing.amount;
      const nextSubcategoryId = await this.resolveSubcategoryForUpdate(
        nextType,
        existing.subcategoryId,
        dto.subcategoryId,
      );

      if (dto.walletId && dto.walletId !== existing.walletId) {
        await this.walletsService.ensureWallet(userId, dto.walletId);
      }

      const oldDelta = transactionDelta(existing.type, existing.amount);
      const newDelta = transactionDelta(nextType, nextAmount);
      const walletChanged = nextWalletId !== existing.walletId;
      const financialChanged =
        walletChanged ||
        nextType !== existing.type ||
        !nextAmount.eq(existing.amount);

      if (financialChanged) {
        if (walletChanged) {
          await this.balanceService.applyDelta(tx, existing.walletId, oldDelta.neg());
          await this.balanceService.applyDelta(tx, nextWalletId, newDelta);
        } else {
          await this.balanceService.applyDelta(
            tx,
            existing.walletId,
            newDelta.sub(oldDelta),
          );
        }
      }

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          walletId: nextWalletId,
          type: nextType,
          amount: nextAmount,
          subcategoryId: nextSubcategoryId,
          description:
            dto.description !== undefined
              ? dto.description.trim() || null
              : existing.description,
          occurredAt: dto.occurredAt
            ? new Date(dto.occurredAt)
            : existing.occurredAt,
        },
        include: transactionInclude,
      });

      return this.toResponse(updated);
    });
  }

  async remove(userId: string, transactionId: string) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!existing) {
        throw new NotFoundException("We couldn't find that transaction.");
      }

      const delta = transactionDelta(existing.type, existing.amount);
      await this.balanceService.applyDelta(tx, existing.walletId, delta.neg());
      await tx.transaction.delete({ where: { id: transactionId } });
    });

    return { message: 'Transaction deleted successfully' };
  }

  async createFromRecurring(
    tx: PrismaClient,
    input: {
      userId: string;
      walletId: string;
      type: TransactionType;
      amount: Prisma.Decimal;
      subcategoryId?: string | null;
      description?: string | null;
      occurredAt?: Date;
    },
  ) {
    const delta = transactionDelta(input.type, input.amount);

    const transaction = await tx.transaction.create({
      data: {
        userId: input.userId,
        walletId: input.walletId,
        type: input.type,
        amount: input.amount,
        subcategoryId: input.subcategoryId ?? null,
        description: input.description ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await this.balanceService.applyDelta(tx, input.walletId, delta);

    return transaction;
  }

  private buildOccurredAtFilter(fromDate?: string, toDate?: string) {
    if (!fromDate && !toDate) {
      return undefined;
    }

    if (!fromDate || !toDate) {
      throw new BadRequestException('Please select both a start date and an end date.');
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (from > to) {
      throw new BadRequestException('Start date must be on or before the end date.');
    }

    const rangeDays = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
    if (rangeDays > MAX_DATE_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
      );
    }

    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    return {
      gte: from,
      lte: end,
    };
  }

  private rawSumToDecimal(value: unknown): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) {
      return value;
    }
    if (value === null || value === undefined) {
      return ZERO_IDR;
    }
    return new Prisma.Decimal(String(value));
  }

  private async resolveCreateAmountAndDelta(
    walletId: string,
    type: TransactionType,
    amountInput?: string,
    targetBalanceInput?: string,
  ): Promise<{ amount: Prisma.Decimal; delta: Prisma.Decimal }> {
    if (type === TransactionType.ADJUSTMENT) {
      if (!targetBalanceInput) {
        throw new BadRequestException('Enter the balance you want this wallet to have.');
      }

      const targetBalance = parseNonNegativeAmount(targetBalanceInput);
      const currentBalance = await this.balanceService.getBalance(
        this.prisma,
        walletId,
      );
      const signedDelta = targetBalance.sub(currentBalance);

      if (signedDelta.eq(0)) {
        throw new BadRequestException(
          'Target balance matches the current wallet balance',
        );
      }

      return {
        amount: signedDelta,
        delta: signedDelta,
      };
    }

    if (type === TransactionType.INITIAL_BALANCE) {
      throw new BadRequestException(
        'Initial balance is set when creating a wallet',
      );
    }

    if (!amountInput) {
      throw new BadRequestException('Enter an amount.');
    }

    const amount = parseAmount(amountInput);

    return {
      amount,
      delta: transactionDelta(type, amount),
    };
  }

  private async resolveSubcategoryForUpdate(
    type: TransactionType,
    existingSubcategoryId: string | null,
    subcategoryInput?: string | null,
  ): Promise<string | null> {
    if (type !== TransactionType.INCOME && type !== TransactionType.EXPENSE) {
      return null;
    }

    if (subcategoryInput !== undefined) {
      if (!subcategoryInput) {
        return null;
      }
      return this.resolveSubcategory(type, subcategoryInput);
    }

    if (!existingSubcategoryId) {
      return null;
    }

    try {
      return await this.resolveSubcategory(type, existingSubcategoryId);
    } catch {
      return null;
    }
  }

  private async resolveSubcategory(
    type: TransactionType,
    subcategoryId?: string,
  ): Promise<string | null> {
    if (!subcategoryId) {
      return null;
    }

    if (type !== TransactionType.INCOME && type !== TransactionType.EXPENSE) {
      throw new BadRequestException(
        'Category applies only to income and expense transactions',
      );
    }

    const subcategory = await this.prisma.transactionSubcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundException("We couldn't find that category.");
    }

    const expectedFlow =
      type === TransactionType.INCOME ? CategoryFlow.INCOME : CategoryFlow.EXPENSE;

    if (subcategory.category.flow !== expectedFlow) {
      throw new BadRequestException(
        'Subcategory does not match the transaction type',
      );
    }

    return subcategoryId;
  }

  private toResponse(transaction: TransactionWithSubcategory) {
    const isAdjustment = transaction.type === TransactionType.ADJUSTMENT;
    const adjustmentDirection = isAdjustment
      ? transaction.amount.gt(0)
        ? 'INCREASE'
        : 'DECREASE'
      : null;

    return {
      id: transaction.id,
      walletId: transaction.walletId,
      type: transaction.type,
      ...toIdrMoneyFields(transaction.amount),
      adjustmentDirection,
      description: transaction.description,
      category: transaction.subcategory
        ? {
            id: transaction.subcategory.category.id,
            name: transaction.subcategory.category.name,
          }
        : null,
      subcategory: transaction.subcategory
        ? {
            id: transaction.subcategory.id,
            name: transaction.subcategory.name,
            categoryId: transaction.subcategory.categoryId,
          }
        : null,
      occurredAt: transaction.occurredAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
