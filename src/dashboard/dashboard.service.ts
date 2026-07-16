import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly recurringService: RecurringService,
    private readonly prisma: PrismaService,
  ) {}

  async getOverview(userId: string) {
    const [wallets, recentTransactions, monthlySummary, categoryBreakdown, dueRecurring, activeRecurringCount] =
      await Promise.all([
        this.walletsService.findAll(userId),
        this.transactionsService.findAll(userId, { page: 1, limit: 20 }),
        this.transactionsService.getMonthlySummary(userId, 3),
        this.transactionsService.getCategoryBreakdown(userId, 3),
        this.recurringService.findDue(userId),
        this.prisma.recurringTransaction.count({
          where: { userId, isActive: true },
        }),
      ]);

    return {
      wallets,
      recentTransactions,
      monthlySummary,
      categoryBreakdown,
      dueRecurring,
      activeRecurringCount,
    };
  }
}
