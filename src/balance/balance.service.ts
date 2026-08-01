import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ZERO_IDR } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = PrismaService | PrismaClient;

@Injectable()
export class BalanceService {
  async applyDelta(
    db: DbClient,
    walletId: string,
    delta: Prisma.Decimal,
  ): Promise<void> {
    const current = await this.getBalance(db, walletId);
    const next = current.add(delta);

    if (next.lt(0)) {
      throw new BadRequestException(
        'Insufficient wallet balance. This change would make the balance negative.',
      );
    }

    await db.walletBalance.upsert({
      where: { walletId },
      create: {
        walletId,
        balance: delta,
      },
      update: {
        balance: { increment: delta },
      },
    });
  }

  async getBalance(db: DbClient, walletId: string): Promise<Prisma.Decimal> {
    const record = await db.walletBalance.findUnique({
      where: { walletId },
    });

    return record?.balance ?? ZERO_IDR;
  }

  async initializeWallet(db: DbClient, walletId: string): Promise<void> {
    await db.walletBalance.upsert({
      where: { walletId },
      create: { walletId, balance: ZERO_IDR },
      update: {},
    });
  }
}
