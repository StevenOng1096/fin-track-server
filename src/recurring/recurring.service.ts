import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  RecurringTransaction,
  RecurringType,
  TransactionType,
} from '@prisma/client';
import {
  computeCanMarkPaid,
  computeInitialNextDueAt,
  computeNextMonthlyDueAfter,
  daysUntilDue,
  formatDaysUntilDue,
  RECURRING_EARLY_PAY_WINDOW_DAYS,
  startOfLocalDay,
} from '../common/utils/recurring';
import {
  parseAmount,
  recurringToTransactionType,
  toIdrMoneyFields,
} from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';

type RecurringWithLatestExecution = RecurringTransaction & {
  executions?: { scheduledAt: Date; executedAt: Date | null }[];
  subcategory?: {
    id: string;
    name: string;
    categoryId: string;
    category: { id: string; name: string };
  } | null;
};

const recurringListInclude = {
  executions: {
    orderBy: { executedAt: 'desc' as const },
    take: 1,
  },
  subcategory: {
    include: {
      category: true,
    },
  },
};

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: string, dto: CreateRecurringDto) {
    await this.walletsService.ensureWallet(userId, dto.walletId);
    const amount = parseAmount(dto.amount);
    const subcategoryId = await this.resolveSubcategory(
      userId,
      dto.type,
      dto.subcategoryId,
    );
    const nextDueAt = computeInitialNextDueAt(dto.anchorDay);

    const recurring = await this.prisma.recurringTransaction.create({
      data: {
        userId,
        walletId: dto.walletId,
        type: dto.type,
        amount,
        description: dto.description?.trim() || null,
        subcategoryId,
        anchorDay: dto.anchorDay,
        intervalValue: 1,
        intervalUnit: 'MONTH',
        nextDueAt,
      },
      include: recurringListInclude,
    });

    return this.toResponse(recurring);
  }

  async findAll(userId: string) {
    const items = await this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { nextDueAt: 'asc' },
      include: recurringListInclude,
    });

    return items.map((item) => this.toResponse(item));
  }

  async findDue(userId: string) {
    const items = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextDueAt: { lte: startOfLocalDay(new Date()) },
      },
      orderBy: { nextDueAt: 'asc' },
      include: recurringListInclude,
    });

    return items.map((item) => this.toResponse(item));
  }

  async findOne(userId: string, id: string) {
    const recurring = await this.getOwned(userId, id);
    return this.toResponse(recurring);
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto) {
    const existing = await this.getOwned(userId, id);

    if (dto.walletId) {
      await this.walletsService.ensureWallet(userId, dto.walletId);
    }

    const nextType = dto.type ?? existing.type;
    let subcategoryId = existing.subcategoryId;

    if (dto.subcategoryId !== undefined) {
      subcategoryId = dto.subcategoryId
        ? await this.resolveSubcategory(userId, nextType, dto.subcategoryId)
        : null;
    } else if (dto.type && dto.type !== existing.type && existing.subcategoryId) {
      subcategoryId = await this.resolveSubcategory(
        userId,
        nextType,
        existing.subcategoryId,
      ).catch(() => null);
    }

    const anchorDay = dto.anchorDay ?? existing.anchorDay;
    const nextDueAt =
      dto.anchorDay !== undefined
        ? computeInitialNextDueAt(anchorDay)
        : undefined;

    const recurring = await this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        walletId: dto.walletId,
        type: dto.type,
        amount: dto.amount ? parseAmount(dto.amount) : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        subcategoryId,
        anchorDay: dto.anchorDay,
        nextDueAt,
        isActive: dto.isActive,
      },
      include: recurringListInclude,
    });

    return this.toResponse(recurring);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.recurringTransaction.delete({ where: { id } });
    return { message: 'Recurring transaction deleted successfully' };
  }

  async execute(userId: string, id: string) {
    return this.processPayment(userId, id);
  }

  async processAutoDueItems(): Promise<number> {
    const dueItems = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextDueAt: { lte: startOfLocalDay(new Date()) },
      },
      select: { id: true, userId: true },
    });

    let processed = 0;

    for (const item of dueItems) {
      try {
        await this.processPayment(item.userId, item.id);
        processed += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to auto-process recurring ${item.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return processed;
  }

  private async processPayment(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const recurring = await tx.recurringTransaction.findFirst({
        where: { id, userId },
      });

      if (!recurring) {
        throw new NotFoundException('Recurring transaction not found');
      }

      if (!recurring.isActive) {
        throw new BadRequestException('Recurring transaction is inactive');
      }

      const priorExecution = await tx.recurringExecution.findFirst({
        where: { recurringTransactionId: recurring.id },
      });

      const dueDays = daysUntilDue(recurring.nextDueAt);
      if (priorExecution && dueDays > RECURRING_EARLY_PAY_WINDOW_DAYS) {
        throw new BadRequestException(
          `Cannot mark paid yet — next due is more than ${RECURRING_EARLY_PAY_WINDOW_DAYS} days away`,
        );
      }

      const alreadyPaid = await tx.recurringExecution.findFirst({
        where: {
          recurringTransactionId: recurring.id,
          scheduledAt: recurring.nextDueAt,
        },
      });

      if (alreadyPaid) {
        throw new BadRequestException('This period has already been paid');
      }

      const scheduledDue = startOfLocalDay(recurring.nextDueAt);
      const today = startOfLocalDay(new Date());
      const paidEarly = today.getTime() < scheduledDue.getTime();
      const occurredAt = paidEarly ? new Date() : scheduledDue;

      const transaction = await this.transactionsService.createFromRecurring(
        tx,
        {
          userId,
          walletId: recurring.walletId,
          type: recurringToTransactionType(recurring.type),
          amount: recurring.amount,
          subcategoryId: recurring.subcategoryId,
          description: recurring.description,
          occurredAt,
        },
      );

      const nextDueAt = computeNextMonthlyDueAfter(
        recurring.nextDueAt,
        recurring.anchorDay,
      );

      await tx.recurringExecution.create({
        data: {
          recurringTransactionId: recurring.id,
          transactionId: transaction.id,
          scheduledAt: recurring.nextDueAt,
          executedAt: new Date(),
        },
      });

      const updated = await tx.recurringTransaction.update({
        where: { id: recurring.id },
        data: { nextDueAt },
        include: recurringListInclude,
      });

      return {
        recurring: this.toResponse(updated),
        transaction: {
          id: transaction.id,
          walletId: transaction.walletId,
          type: transaction.type,
          ...toIdrMoneyFields(transaction.amount),
          description: transaction.description,
          occurredAt: transaction.occurredAt,
        },
      };
    });
  }

  private async resolveSubcategory(
    userId: string,
    type: RecurringType,
    subcategoryId?: string,
  ): Promise<string | null> {
    if (!subcategoryId) {
      return null;
    }

    const txType = recurringToTransactionType(type);
    const subcategory = await this.prisma.transactionSubcategory.findFirst({
      where: {
        id: subcategoryId,
        OR: [{ userId }, { userId: null }],
      },
      include: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundException('Subcategory not found');
    }

    const expectedFlow =
      txType === TransactionType.INCOME ? 'INCOME' : 'EXPENSE';

    if (subcategory.category.flow !== expectedFlow) {
      throw new BadRequestException(
        'Subcategory does not match the recurring type',
      );
    }

    return subcategoryId;
  }

  private async getOwned(userId: string, id: string) {
    const recurring = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
      include: recurringListInclude,
    });

    if (!recurring) {
      throw new NotFoundException('Recurring transaction not found');
    }

    return recurring;
  }

  private toResponse(recurring: RecurringWithLatestExecution) {
    const dueDays = daysUntilDue(recurring.nextDueAt);
    const hasExecution = (recurring.executions?.length ?? 0) > 0;

    return {
      id: recurring.id,
      walletId: recurring.walletId,
      type: recurring.type,
      ...toIdrMoneyFields(recurring.amount),
      description: recurring.description,
      subcategoryId: recurring.subcategoryId,
      category: recurring.subcategory
        ? {
            id: recurring.subcategory.category.id,
            name: recurring.subcategory.category.name,
          }
        : null,
      subcategory: recurring.subcategory
        ? {
            id: recurring.subcategory.id,
            name: recurring.subcategory.name,
            categoryId: recurring.subcategory.categoryId,
          }
        : null,
      anchorDay: recurring.anchorDay,
      intervalValue: recurring.intervalValue,
      intervalUnit: recurring.intervalUnit,
      nextDueAt: recurring.nextDueAt,
      daysUntilDue: dueDays,
      dueLabel: formatDaysUntilDue(recurring.nextDueAt),
      canMarkPaid: computeCanMarkPaid(recurring, hasExecution),
      isActive: recurring.isActive,
      createdAt: recurring.createdAt,
      updatedAt: recurring.updatedAt,
    };
  }
}
