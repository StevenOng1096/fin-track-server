import { Injectable, Logger } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getSheetSymbolForAsset,
  GoogleSheetService,
} from './google-sheet.service';

const STALE_AFTER_MS = 60 * 60 * 1000;

@Injectable()
export class AssetPricesService {
  private readonly logger = new Logger(AssetPricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleSheetService: GoogleSheetService,
  ) {}

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
        return asset.priceSource !== 'manual';
      }

      if (asset.priceSource === 'manual') {
        return false;
      }

      return this.isStale(asset);
    });

    if (targets.length === 0) {
      return 0;
    }

    let quoteMap: Map<
      string,
      { priceIdr: number; updatedAt: Date | null }
    >;

    try {
      quoteMap = await this.googleSheetService.getQuoteMap(force);
    } catch (error) {
      this.logger.warn(
        `Failed to load Google Sheet prices: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return 0;
    }

    let updated = 0;

    for (const asset of targets) {
      try {
        const quote = this.lookupQuoteForAsset(asset, quoteMap);
        if (!quote) {
          continue;
        }

        await this.prisma.asset.update({
          where: { id: asset.id },
          data: {
            pricePerUnitIdr: new Prisma.Decimal(quote.priceIdr.toFixed(2)),
            priceSource: 'google_sheets',
            marketPriceUpdatedAt: quote.updatedAt ?? new Date(),
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

  private lookupQuoteForAsset(
    asset: Asset,
    quoteMap: Map<string, { priceIdr: number; updatedAt: Date | null }>,
  ): { priceIdr: number; updatedAt: Date | null } | null {
    const sheetSymbol = getSheetSymbolForAsset(asset.type, asset.symbol);
    if (!sheetSymbol) {
      return null;
    }

    const quote = quoteMap.get(sheetSymbol);
    if (!quote) {
      this.logger.warn(
        `No sheet row for ${asset.symbol} (expected symbol ${sheetSymbol})`,
      );
      return null;
    }

    return quote;
  }

  private isStale(asset: Asset): boolean {
    if (!asset.marketPriceUpdatedAt) {
      return true;
    }

    return Date.now() - asset.marketPriceUpdatedAt.getTime() > STALE_AFTER_MS;
  }
}
