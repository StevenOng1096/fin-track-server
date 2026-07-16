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
import { AssetsService } from './assets.service';
import {
  CreateAssetTransactionDto,
  ListAssetTransactionsQueryDto,
} from './dto/asset-transaction.dto';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  create(@Session() session: UserSession, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(session.user.id, dto);
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.assetsService.findAll(session.user.id);
  }

  @Post('refresh-prices')
  refreshPrices(@Session() session: UserSession) {
    return this.assetsService.refreshMarketPrices(session.user.id);
  }

  @Get(':id')
  findOne(@Session() session: UserSession, @Param('id') id: string) {
    return this.assetsService.findOne(session.user.id, id);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.assetsService.remove(session.user.id, id);
  }

  @Post(':id/transactions')
  createTransaction(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: CreateAssetTransactionDto,
  ) {
    return this.assetsService.createTransaction(session.user.id, id, dto);
  }

  @Get(':id/transactions')
  findTransactions(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query() query: ListAssetTransactionsQueryDto,
  ) {
    return this.assetsService.findTransactions(session.user.id, id, query);
  }
}
