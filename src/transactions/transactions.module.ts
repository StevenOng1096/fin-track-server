import { Module } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { WalletsModule } from '../wallets/wallets.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [WalletsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, BalanceService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
