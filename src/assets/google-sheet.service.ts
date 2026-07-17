import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as path from 'node:path';

export type SheetQuote = {
  priceIdr: number;
  updatedAt: Date | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class GoogleSheetService {
  private readonly logger = new Logger(GoogleSheetService.name);
  private cachedQuotes: Map<string, SheetQuote> | null = null;
  private cacheFetchedAt = 0;

  constructor(private readonly config: ConfigService) {}

  async getQuoteMap(force = false): Promise<Map<string, SheetQuote>> {
    if (
      !force &&
      this.cachedQuotes &&
      Date.now() - this.cacheFetchedAt < CACHE_TTL_MS
    ) {
      return this.cachedQuotes;
    }

    const spreadsheetId = this.config.get<string>('GOOGLE_SHEET_ID');
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not configured');
    }

    const keyFile = this.resolveKeyFilePath();
    const range =
      this.config.get<string>('GOOGLE_SHEET_RANGE') ?? 'AssetPrices!A:D';

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = result.data.values ?? [];
    const quotes = this.parseRows(rows);

    this.cachedQuotes = quotes;
    this.cacheFetchedAt = Date.now();

    this.logger.log(`Loaded ${quotes.size} quotes from Google Sheet`);

    return quotes;
  }

  private resolveKeyFilePath(): string {
    const configured = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    if (configured) {
      return path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), configured);
    }

    return path.resolve(
      process.cwd(),
      'portofolio-tracker-service-acc-key.json',
    );
  }

  private parseRows(rows: string[][]): Map<string, SheetQuote> {
    const quotes = new Map<string, SheetQuote>();

    for (const row of rows.slice(1)) {
      const symbol = row[0]?.trim();
      const priceRaw = row[2]?.trim();
      const updatedRaw = row[3]?.trim();

      if (!symbol || !priceRaw) {
        continue;
      }

      const priceIdr = parseSheetPriceIdr(priceRaw);
      if (priceIdr === null) {
        this.logger.warn(`Skipping ${symbol}: invalid price "${priceRaw}"`);
        continue;
      }

      quotes.set(symbol, {
        priceIdr,
        updatedAt: parseSheetUpdatedAt(updatedRaw),
      });
    }

    return quotes;
  }
}

export function parseSheetPriceIdr(value: string): number | null {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/^Rp\.?/i, '')
    .replace(/,/g, '');

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseSheetUpdatedAt(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getSheetSymbolForAsset(
  type: string,
  symbol: string,
): string | null {
  switch (type) {
    case 'STOCK':
      return `${symbol.toUpperCase()}.JK`;
    case 'USD':
      return 'IDR=X';
    case 'MYR':
      return 'MYRIDR=X';
    case 'GOLD':
      return 'GC=F';
    default:
      return null;
  }
}
