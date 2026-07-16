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
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post()
  create(@Session() session: UserSession, @Body() dto: CreateRecurringDto) {
    return this.recurringService.create(session.user.id, dto);
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.recurringService.findAll(session.user.id);
  }

  @Get('due')
  findDue(@Session() session: UserSession) {
    return this.recurringService.findDue(session.user.id);
  }

  @Get(':id')
  findOne(@Session() session: UserSession, @Param('id') id: string) {
    return this.recurringService.findOne(session.user.id, id);
  }

  @Patch(':id')
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurringService.update(session.user.id, id, dto);
  }

  @Post(':id/execute')
  execute(@Session() session: UserSession, @Param('id') id: string) {
    return this.recurringService.execute(session.user.id, id);
  }

  @Delete(':id')
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.recurringService.remove(session.user.id, id);
  }
}
