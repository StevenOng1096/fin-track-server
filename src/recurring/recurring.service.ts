import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RecurringTransaction,
  RecurringType,
} from '@prisma/client';
import { computeNextDueAt } from '../common/utils/recurring';
import {
  formatAmount,
  parseAmount,
  recurringToTransactionType,
} from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';

@Injectable()
export class RecurringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: string, dto: CreateRecurringDto) {
    await this.walletsService.ensureWallet(userId, dto.walletId);
    const amount = parseAmount(dto.amount);

    const recurring = await this.prisma.recurringTransaction.create({
      data: {
        userId,
        walletId: dto.walletId,
        type: dto.type,
        amount,
        description: dto.description?.trim() || null,
        intervalValue: dto.intervalValue,
        intervalUnit: dto.intervalUnit,
        nextDueAt: new Date(dto.nextDueAt),
      },
    });

    return this.toResponse(recurring);
  }

  async findAll(userId: string) {
    const items = await this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { nextDueAt: 'asc' },
    });

    return items.map((item) => this.toResponse(item));
  }

  async findDue(userId: string) {
    const items = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextDueAt: { lte: new Date() },
      },
      orderBy: { nextDueAt: 'asc' },
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
        intervalValue: dto.intervalValue,
        intervalUnit: dto.intervalUnit,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        isActive: dto.isActive,
      },
    });

    return this.toResponse(recurring);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.recurringTransaction.delete({ where: { id } });
    return { message: 'Recurring transaction deleted successfully' };
  }

  async execute(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT id FROM recurring_transactions
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;

      const recurring = await tx.recurringTransaction.findFirst({
        where: { id, userId },
      });

      if (!recurring) {
        throw new NotFoundException('Recurring transaction not found');
      }

      if (!recurring.isActive) {
        throw new BadRequestException('Recurring transaction is inactive');
      }

      if (recurring.nextDueAt > new Date()) {
        throw new BadRequestException('Recurring transaction is not due yet');
      }

      const transaction = await this.transactionsService.createFromRecurring(
        tx,
        {
          userId,
          walletId: recurring.walletId,
          type: recurringToTransactionType(recurring.type),
          amount: recurring.amount,
          description: recurring.description,
          occurredAt: new Date(),
        },
      );

      const nextDueAt = computeNextDueAt(
        recurring.nextDueAt,
        recurring.intervalValue,
        recurring.intervalUnit,
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
      });

      return {
        recurring: this.toResponse(updated),
        transaction: {
          id: transaction.id,
          walletId: transaction.walletId,
          type: transaction.type,
          amount: formatAmount(transaction.amount),
          currency: 'IDR',
          description: transaction.description,
          occurredAt: transaction.occurredAt,
        },
      };
    });
  }

  private async getOwned(userId: string, id: string) {
    const recurring = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });

    if (!recurring) {
      throw new NotFoundException('Recurring transaction not found');
    }

    return recurring;
  }

  private toResponse(recurring: RecurringTransaction) {
    return {
      id: recurring.id,
      walletId: recurring.walletId,
      type: recurring.type,
      amount: formatAmount(recurring.amount),
      currency: 'IDR',
      description: recurring.description,
      intervalValue: recurring.intervalValue,
      intervalUnit: recurring.intervalUnit,
      nextDueAt: recurring.nextDueAt,
      isActive: recurring.isActive,
      createdAt: recurring.createdAt,
      updatedAt: recurring.updatedAt,
    };
  }
}
