import { Module } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  imports: [WalletsModule, TransactionsModule],
  controllers: [RecurringController],
  providers: [RecurringService, BalanceService],
  exports: [RecurringService],
})
export class RecurringModule {}
