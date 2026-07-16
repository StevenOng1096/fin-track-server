import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  PeriodSummaryQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Session() session: UserSession, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(session.user.id, dto);
  }

  @Get()
  findAll(
    @Session() session: UserSession,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(session.user.id, query);
  }

  @Get('analytics/monthly')
  getMonthlySummary(
    @Session() session: UserSession,
    @Query('months') months?: string,
  ) {
    const parsedMonths = months ? Number(months) : 6;
    return this.transactionsService.getMonthlySummary(
      session.user.id,
      Number.isNaN(parsedMonths) ? 6 : parsedMonths,
    );
  }

  @Get('analytics/category-breakdown')
  getCategoryBreakdown(
    @Session() session: UserSession,
    @Query('months') months?: string,
  ) {
    const parsedMonths = months ? Number(months) : 3;
    return this.transactionsService.getCategoryBreakdown(
      session.user.id,
      Number.isNaN(parsedMonths) ? 3 : parsedMonths,
    );
  }

  @Get('analytics/period-summary')
  getPeriodSummary(
    @Session() session: UserSession,
    @Query() query: PeriodSummaryQueryDto,
  ) {
    return this.transactionsService.getPeriodSummary(session.user.id, query);
  }

  @Get(':id')
  findOne(@Session() session: UserSession, @Param('id') id: string) {
    return this.transactionsService.findOne(session.user.id, id);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.transactionsService.remove(session.user.id, id);
  }
}
