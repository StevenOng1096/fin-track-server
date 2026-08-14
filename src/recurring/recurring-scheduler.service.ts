import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RecurringService } from './recurring.service';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

@Injectable()
export class RecurringSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurringSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly recurringService: RecurringService) {}

  onModuleInit() {
    void this.processDueItems();
    this.timer = setInterval(() => {
      void this.processDueItems();
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processDueItems(): Promise<number> {
    const count = await this.recurringService.processAutoDueItems();
    if (count > 0) {
      this.logger.log(`Auto-processed ${count} due recurring item(s)`);
    }
    return count;
  }
}
