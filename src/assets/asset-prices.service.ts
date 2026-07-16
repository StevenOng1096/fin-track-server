import { Injectable, Logger } from '@nestjs/common';
import { Asset, AssetType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TROY_OUNCE_TO_GRAMS = 31.1034768;
const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const STALE_AFTER_MS = 60 * 60 * 1000;

type CachedQuote = {
  price: number;
  fetchedAt: number;
};

@Injectable()
export class AssetPricesService {
  private readonly logger = new Logger(AssetPricesService.name);
  private readonly quoteCache = new Map<string, CachedQuote>();

  constructor(private readonly prisma: PrismaService) {}

  scheduleStaleRefresh(userId: string): void {
    void this.refreshStalePrices(userId).catch((error) => {
      this.logger.warn(
        `Background price refresh failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }

  async refreshStalePrices(userId: string, force = false): Promise<number> {
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const targets = assets.filter((asset) => {
      if (force) {
        return true;
      }

      if (asset.priceSource === 'manual') {
        return false;
      }

      return this.isStale(asset);
    });

    let updated = 0;

    for (const asset of targets) {
      try {
        const price = await this.fetchMarketPriceForAsset(asset);
        if (!price) {
          continue;
        }

        await this.prisma.asset.update({
          where: { id: asset.id },
          data: {
            pricePerUnitIdr: price,
            priceSource: 'yahoo_finance',
            marketPriceUpdatedAt: new Date(),
          },
        });
        updated += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to refresh ${asset.symbol}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    return updated;
  }

  private isStale(asset: Asset): boolean {
    if (!asset.marketPriceUpdatedAt) {
      return true;
    }

    return Date.now() - asset.marketPriceUpdatedAt.getTime() > STALE_AFTER_MS;
  }

  private async fetchMarketPriceForAsset(
    asset: Asset,
  ): Promise<Prisma.Decimal | null> {
    switch (asset.type) {
      case AssetType.STOCK:
        return new Prisma.Decimal(
          (await this.fetchYahooQuote(`${asset.symbol}.JK`)).toFixed(2),
        );
      case AssetType.USD:
        return new Prisma.Decimal(
          (await this.fetchYahooQuote('USDIDR=X')).toFixed(2),
        );
      case AssetType.MYR:
        return new Prisma.Decimal(
          (await this.fetchYahooQuote('MYRIDR=X')).toFixed(2),
        );
      case AssetType.GOLD: {
        const [goldUsdPerOz, usdIdr] = await Promise.all([
          this.fetchYahooQuote('GC=F'),
          this.fetchYahooQuote('USDIDR=X'),
        ]);
        const idrPerGram = (goldUsdPerOz / TROY_OUNCE_TO_GRAMS) * usdIdr;
        return new Prisma.Decimal(idrPerGram.toFixed(2));
      }
      default:
        return null;
    }
  }

  private async fetchYahooQuote(symbol: string): Promise<number> {
    const cached = this.quoteCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.price;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; FinanceTracker/1.0; +https://localhost)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        chart?: {
          result?: Array<{
            meta?: {
              regularMarketPrice?: number;
            };
          }>;
        };
      };

      const price = payload.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        throw new Error(`No market price returned for ${symbol}`);
      }

      this.quoteCache.set(symbol, { price, fetchedAt: Date.now() });
      return price;
    } finally {
      clearTimeout(timeout);
    }
  }
}
