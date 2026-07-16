import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = PrismaService | PrismaClient;

@Injectable()
export class BalanceService {
  async applyDelta(
    db: DbClient,
    walletId: string,
    delta: bigint,
  ): Promise<void> {
    const current = await this.getBalance(db, walletId);
    const next = current + delta;

    if (next < 0n) {
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

  async getBalance(db: DbClient, walletId: string): Promise<bigint> {
    const record = await db.walletBalance.findUnique({
      where: { walletId },
    });

    return record?.balance ?? 0n;
  }

  async initializeWallet(db: DbClient, walletId: string): Promise<void> {
    await db.walletBalance.upsert({
      where: { walletId },
      create: { walletId, balance: 0n },
      update: {},
    });
  }
}
