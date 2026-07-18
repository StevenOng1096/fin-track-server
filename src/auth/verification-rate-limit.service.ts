import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const DAILY_EMAIL_LIMIT = 4;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const RESET_PASSWORD_PREFIX = 'reset-password:';
const VERIFY_RATE_PREFIX = 'email-verification-rate:';

@Injectable()
export class VerificationRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanSendAuthEmail(userId: string): Promise<void> {
    const count = await this.countRecentAuthEmails(userId);
    if (count >= DAILY_EMAIL_LIMIT) {
      throw new HttpException(
        'Too many verification or reset emails sent today. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordVerificationEmailSent(userId: string): Promise<void> {
    await this.prisma.verification.create({
      data: {
        id: randomBytes(16).toString('hex'),
        identifier: `${VERIFY_RATE_PREFIX}${userId}`,
        value: userId,
        expiresAt: new Date(Date.now() + WINDOW_MS),
      },
    });
  }

  private async countRecentAuthEmails(userId: string): Promise<number> {
    const since = new Date(Date.now() - WINDOW_MS);

    const [resetCount, verifyCount] = await Promise.all([
      this.prisma.verification.count({
        where: {
          value: userId,
          identifier: { startsWith: RESET_PASSWORD_PREFIX },
          createdAt: { gte: since },
        },
      }),
      this.prisma.verification.count({
        where: {
          value: userId,
          identifier: { startsWith: VERIFY_RATE_PREFIX },
          createdAt: { gte: since },
        },
      }),
    ]);

    return resetCount + verifyCount;
  }
}
