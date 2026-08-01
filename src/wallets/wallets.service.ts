import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { BalanceService } from '../balance/balance.service';
import {
  formatAmount,
  parseNonNegativeAmount,
  transactionDelta,
  CURRENCY_IDR,
  ZERO_IDR,
} from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto, ReorderWalletsDto, UpdateWalletDto } from './dto/wallet.dto';
import {
  DEFAULT_WALLET_COLOR,
  isWalletColor,
  type WalletColorKey,
} from './wallet-colors';

const ACTIVITY_WINDOW_DAYS = 30;

type WalletActivityTotals = {
  income30d: Prisma.Decimal;
  expense30d: Prisma.Decimal;
};

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  async create(userId: string, dto: CreateWalletDto) {
    const color = this.resolveColor(dto.color);
    let initialBalance = ZERO_IDR;

    if (dto.initialBalance) {
      try {
        initialBalance = parseNonNegativeAmount(dto.initialBalance);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid initial balance',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const sortAggregate = await tx.wallet.aggregate({
        where: { userId },
        _max: { sortOrder: true },
      });
      const sortOrder = (sortAggregate._max.sortOrder ?? -1) + 1;

      const wallet = await tx.wallet.create({
        data: {
          userId,
          name: dto.name.trim(),
          color,
          sortOrder,
        },
      });

      await this.balanceService.initializeWallet(tx, wallet.id);

      if (initialBalance.gt(0)) {
        const transaction = await tx.transaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: TransactionType.INITIAL_BALANCE,
            amount: initialBalance,
            description: 'Initial balance',
          },
        });

        await this.balanceService.applyDelta(
          tx,
          wallet.id,
          transactionDelta(TransactionType.INITIAL_BALANCE, initialBalance),
        );
      }

      return this.toResponse(
        wallet.id,
        wallet.name,
        wallet.color,
        wallet.sortOrder,
        wallet.createdAt,
        wallet.updatedAt,
        initialBalance,
        { income30d: ZERO_IDR, expense30d: ZERO_IDR },
      );
    });
  }

  async findAll(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      include: { balance: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const activityTotals = await this.loadActivityTotals(
      userId,
      wallets.map((wallet) => wallet.id),
    );

    return wallets.map((wallet) =>
      this.toResponse(
        wallet.id,
        wallet.name,
        wallet.color,
        wallet.sortOrder,
        wallet.createdAt,
        wallet.updatedAt,
        wallet.balance?.balance ?? ZERO_IDR,
        activityTotals.get(wallet.id) ?? {
          income30d: ZERO_IDR,
          expense30d: ZERO_IDR,
        },
      ),
    );
  }

  async findOne(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
      include: { balance: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const activityTotals = await this.loadActivityTotals(userId, [walletId]);

    return this.toResponse(
      wallet.id,
      wallet.name,
      wallet.color,
      wallet.sortOrder,
      wallet.createdAt,
      wallet.updatedAt,
      wallet.balance?.balance ?? ZERO_IDR,
      activityTotals.get(walletId) ?? {
        income30d: ZERO_IDR,
        expense30d: ZERO_IDR,
      },
    );
  }

  async update(userId: string, walletId: string, dto: UpdateWalletDto) {
    await this.ensureWallet(userId, walletId);

    if (dto.name === undefined && dto.color === undefined) {
      throw new BadRequestException('Provide a name or color to update.');
    }

    const wallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: this.resolveColor(dto.color) } : {}),
      },
      include: { balance: true },
    });

    return this.toResponse(
      wallet.id,
      wallet.name,
      wallet.color,
      wallet.sortOrder,
      wallet.createdAt,
      wallet.updatedAt,
      wallet.balance?.balance ?? ZERO_IDR,
      (await this.loadActivityTotals(userId, [walletId])).get(walletId) ?? {
        income30d: ZERO_IDR,
        expense30d: ZERO_IDR,
      },
    );
  }

  async reorder(userId: string, walletIds: string[]) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const existingIds = wallets.map((wallet) => wallet.id);

    if (walletIds.length !== existingIds.length) {
      throw new BadRequestException(
        'walletIds must include every wallet for this user',
      );
    }

    const existingSet = new Set(existingIds);
    for (const walletId of walletIds) {
      if (!existingSet.has(walletId)) {
        throw new BadRequestException('walletIds contains an unknown wallet');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, walletId] of walletIds.entries()) {
        await tx.wallet.update({
          where: { id: walletId },
          data: { sortOrder: index },
        });
      }
    });

    return this.findAll(userId);
  }

  async remove(userId: string, walletId: string) {
    await this.ensureWallet(userId, walletId);

    const transactionCount = await this.prisma.transaction.count({
      where: { walletId },
    });

    if (transactionCount > 0) {
      throw new ConflictException(
        'Wallet has transactions. Move or delete them before removing the wallet.',
      );
    }

    const recurringCount = await this.prisma.recurringTransaction.count({
      where: { walletId },
    });

    if (recurringCount > 0) {
      throw new ConflictException(
        'Wallet has recurring items. Delete them before removing the wallet.',
      );
    }

    await this.prisma.wallet.delete({ where: { id: walletId } });

    return { message: 'Wallet deleted successfully' };
  }

  async ensureWallet(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  private resolveColor(color?: string): WalletColorKey {
    if (!color) {
      return DEFAULT_WALLET_COLOR;
    }

    if (!isWalletColor(color)) {
      throw new BadRequestException('Invalid wallet color.');
    }

    return color;
  }

  private activitySinceDate(): Date {
    const since = new Date();
    since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
    since.setHours(0, 0, 0, 0);
    return since;
  }

  private async loadActivityTotals(userId: string, walletIds: string[]) {
    const totals = new Map<string, WalletActivityTotals>();

    for (const walletId of walletIds) {
      totals.set(walletId, { income30d: ZERO_IDR, expense30d: ZERO_IDR });
    }

    if (walletIds.length === 0) {
      return totals;
    }

    const rows = await this.prisma.transaction.groupBy({
      by: ['walletId', 'type'],
      where: {
        userId,
        walletId: { in: walletIds },
        occurredAt: { gte: this.activitySinceDate() },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
      _sum: { amount: true },
    });

    for (const row of rows) {
      const entry = totals.get(row.walletId);
      if (!entry) {
        continue;
      }

      const sum = row._sum.amount ?? ZERO_IDR;
      if (row.type === TransactionType.INCOME) {
        entry.income30d = sum;
      } else if (row.type === TransactionType.EXPENSE) {
        entry.expense30d = sum;
      }
    }

    return totals;
  }

  private toResponse(
    id: string,
    name: string,
    color: string,
    sortOrder: number,
    createdAt: Date,
    updatedAt: Date,
    balance: Prisma.Decimal,
    activity: WalletActivityTotals,
  ) {
    return {
      id,
      name,
      color: isWalletColor(color) ? color : DEFAULT_WALLET_COLOR,
      sortOrder,
      balance: formatAmount(balance),
      income30d: formatAmount(activity.income30d),
      expense30d: formatAmount(activity.expense30d),
      currency: CURRENCY_IDR,
      createdAt,
      updatedAt,
    };
  }
}
