import { Module } from '@nestjs/common';
import { RecurringModule } from '../recurring/recurring.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [WalletsModule, TransactionsModule, RecurringModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
