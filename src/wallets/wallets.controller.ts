import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CreateWalletDto, ReorderWalletsDto, UpdateWalletDto } from './dto/wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  create(@Session() session: UserSession, @Body() dto: CreateWalletDto) {
    return this.walletsService.create(session.user.id, dto);
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.walletsService.findAll(session.user.id);
  }

  @Patch('reorder')
  reorder(@Session() session: UserSession, @Body() dto: ReorderWalletsDto) {
    return this.walletsService.reorder(session.user.id, dto.walletIds);
  }

  @Get(':id')
  findOne(@Session() session: UserSession, @Param('id') id: string) {
    return this.walletsService.findOne(session.user.id, id);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.walletsService.remove(session.user.id, id);
  }
}
