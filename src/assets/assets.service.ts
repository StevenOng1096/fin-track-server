import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Asset,
  AssetTransaction,
  AssetTransactionType,
  AssetType,
  Prisma,
} from '@prisma/client';
import { formatAmount, formatSignedAmount } from '../common/utils/money';
import {
  computeCostBasisIdr,
  computeMarketValueIdr,
  computeTotalValueIdr,
  formatDecimal,
  formatPriceIdr,
  nextAverageCost,
  parsePriceIdr,
  parseQuantity,
} from '../common/utils/decimal';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssetTransactionDto,
  ListAssetTransactionsQueryDto,
} from './dto/asset-transaction.dto';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { AssetPricesService } from './asset-prices.service';

type AssetMeta = {
  name: string;
  symbol: string;
  unit: string;
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetPricesService: AssetPricesService,
  ) {}

  async create(userId: string, dto: CreateAssetDto) {
    const meta = this.resolveAssetMeta(dto.type, dto.name, dto.symbol);
    const initialQuantity = dto.initialQuantity
      ? parseQuantity(dto.initialQuantity)
      : new Prisma.Decimal(0);
    const initialPricePerUnitIdr = dto.initialPricePerUnitIdr
      ? parsePriceIdr(dto.initialPricePerUnitIdr)
      : null;

    if (initialQuantity.gt(0) && !initialPricePerUnitIdr) {
      throw new BadRequestException(
        'Buy price per unit is required when setting an initial quantity',
      );
    }

    try {
      const response = await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            userId,
            type: dto.type,
            name: meta.name,
            symbol: meta.symbol,
            unit: meta.unit,
            quantity: initialQuantity,
            avgCostPerUnitIdr: initialQuantity.gt(0) ? initialPricePerUnitIdr : null,
            pricePerUnitIdr: null,
            priceSource: null,
            marketPriceUpdatedAt: null,
          },
        });

        if (initialQuantity.gt(0) && initialPricePerUnitIdr) {
          await tx.assetTransaction.create({
            data: {
              userId,
              assetId: asset.id,
              type: AssetTransactionType.INITIAL,
              quantity: initialQuantity,
              pricePerUnitIdr: initialPricePerUnitIdr,
              totalValueIdr: computeTotalValueIdr(
                initialQuantity,
                initialPricePerUnitIdr,
              ),
              description: 'Initial holding',
            },
          });
        }

        return this.toAssetResponse(asset);
      });

      this.assetPricesService.scheduleStaleRefresh(userId);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `You already track an asset with symbol ${meta.symbol}`,
        );
      }

      throw error;
    }
  }

  async findAll(userId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    this.assetPricesService.scheduleStaleRefresh(userId);

    return assets.map((asset) => this.toAssetResponse(asset));
  }

  async findOne(userId: string, assetId: string) {
    const asset = await this.ensureAsset(userId, assetId);
    this.assetPricesService.scheduleStaleRefresh(userId);
    return this.toAssetResponse(asset);
  }

  async refreshMarketPrices(userId: string) {
    const updated = await this.assetPricesService.refreshStalePrices(userId, true);
    const assets = await this.findAllWithoutBackgroundRefresh(userId);

    return {
      updated,
      assets,
    };
  }

  private async findAllWithoutBackgroundRefresh(userId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return assets.map((asset) => this.toAssetResponse(asset));
  }

  async update(userId: string, assetId: string, dto: UpdateAssetDto) {
    await this.ensureAsset(userId, assetId);

    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.pricePerUnitIdr !== undefined
          ? {
              pricePerUnitIdr: parsePriceIdr(dto.pricePerUnitIdr),
              priceSource: 'manual',
              marketPriceUpdatedAt: new Date(),
            }
          : {}),
      },
    });

    return this.toAssetResponse(asset);
  }

  async remove(userId: string, assetId: string) {
    await this.ensureAsset(userId, assetId);

    await this.prisma.asset.delete({ where: { id: assetId } });

    return { message: 'Asset deleted successfully' };
  }

  async createTransaction(
    userId: string,
    assetId: string,
    dto: CreateAssetTransactionDto,
  ) {
    if (dto.type === AssetTransactionType.INITIAL) {
      throw new BadRequestException(
        'Initial holdings are set when creating an asset',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id: assetId, userId },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      const result = this.resolveTransactionChanges(asset, dto);

      const transaction = await tx.assetTransaction.create({
        data: {
          userId,
          assetId,
          type: dto.type,
          quantity: result.recordedQuantity,
          pricePerUnitIdr: result.pricePerUnitIdr,
          totalValueIdr: result.totalValueIdr,
          description: dto.description?.trim() || null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        },
      });

      await tx.asset.update({
        where: { id: assetId },
        data: {
          quantity: result.nextQuantity,
          avgCostPerUnitIdr: result.nextAvgCost,
        },
      });

      return this.toTransactionResponse(transaction);
    });
  }

  async findTransactions(
    userId: string,
    assetId: string,
    query: ListAssetTransactionsQueryDto,
  ) {
    await this.ensureAsset(userId, assetId);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = { userId, assetId };

    const [items, total] = await Promise.all([
      this.prisma.assetTransaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.assetTransaction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTransactionResponse(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async ensureAsset(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  private resolveAssetMeta(
    type: AssetType,
    name?: string,
    symbol?: string,
  ): AssetMeta {
    switch (type) {
      case AssetType.GOLD:
        return {
          name: name?.trim() || 'Gold',
          symbol: 'XAU',
          unit: 'gram',
        };
      case AssetType.USD:
        return {
          name: name?.trim() || 'US Dollar',
          symbol: 'USD',
          unit: 'usd',
        };
      case AssetType.MYR:
        return {
          name: name?.trim() || 'Malaysian Ringgit',
          symbol: 'MYR',
          unit: 'myr',
        };
      case AssetType.STOCK:
        if (!symbol?.trim()) {
          throw new BadRequestException('Stock symbol is required');
        }
        return {
          name: name?.trim() || symbol.trim().toUpperCase(),
          symbol: symbol.trim().toUpperCase(),
          unit: 'share',
        };
      default:
        throw new BadRequestException('Unsupported asset type');
    }
  }

  private resolveTransactionChanges(
    asset: Asset,
    dto: CreateAssetTransactionDto,
  ) {
    if (dto.type === AssetTransactionType.ADJUSTMENT) {
      if (!dto.targetQuantity) {
        throw new BadRequestException('Target quantity is required for adjustments');
      }

      const targetQuantity = parseQuantity(dto.targetQuantity);
      const signedDelta = targetQuantity.sub(asset.quantity);

      if (signedDelta.eq(0)) {
        throw new BadRequestException(
          'Target quantity matches the current holding quantity',
        );
      }

      const pricePerUnitIdr =
        asset.pricePerUnitIdr ??
        asset.avgCostPerUnitIdr ??
        new Prisma.Decimal(0);

      return {
        recordedQuantity: signedDelta.abs(),
        pricePerUnitIdr,
        totalValueIdr: computeTotalValueIdr(signedDelta.abs(), pricePerUnitIdr),
        nextQuantity: targetQuantity,
        nextAvgCost: asset.avgCostPerUnitIdr,
      };
    }

    if (!dto.quantity || !dto.pricePerUnitIdr) {
      throw new BadRequestException('Quantity and price per unit are required');
    }

    const quantity = parseQuantity(dto.quantity);
    if (quantity.lte(0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const pricePerUnitIdr = parsePriceIdr(dto.pricePerUnitIdr);
    const totalValueIdr = computeTotalValueIdr(quantity, pricePerUnitIdr);

    if (dto.type === AssetTransactionType.BUY) {
      return {
        recordedQuantity: quantity,
        pricePerUnitIdr,
        totalValueIdr,
        nextQuantity: asset.quantity.add(quantity),
        nextAvgCost: nextAverageCost(
          asset.quantity,
          asset.avgCostPerUnitIdr,
          quantity,
          pricePerUnitIdr,
        ),
      };
    }

    if (dto.type === AssetTransactionType.SELL) {
      if (asset.quantity.lt(quantity)) {
        throw new BadRequestException('Cannot sell more than the current quantity');
      }

      return {
        recordedQuantity: quantity,
        pricePerUnitIdr,
        totalValueIdr,
        nextQuantity: asset.quantity.sub(quantity),
        nextAvgCost: asset.avgCostPerUnitIdr,
      };
    }

    throw new BadRequestException('Unsupported transaction type');
  }

  private toAssetResponse(asset: Asset) {
    const marketValueIdr = computeMarketValueIdr(
      asset.quantity,
      asset.pricePerUnitIdr,
    );
    const costBasisIdr = computeCostBasisIdr(
      asset.quantity,
      asset.avgCostPerUnitIdr,
    );
    const priceVsBuyPercent = this.computePriceVsBuyPercent(
      asset.avgCostPerUnitIdr,
      asset.pricePerUnitIdr,
    );

    return {
      id: asset.id,
      type: asset.type,
      name: asset.name,
      symbol: asset.symbol,
      unit: asset.unit,
      quantity: formatDecimal(asset.quantity) ?? '0',
      buyPricePerUnitIdr: formatPriceIdr(asset.avgCostPerUnitIdr),
      avgCostPerUnitIdr: formatPriceIdr(asset.avgCostPerUnitIdr),
      pricePerUnitIdr: formatPriceIdr(asset.pricePerUnitIdr),
      priceSource: asset.priceSource,
      marketPriceUpdatedAt: asset.marketPriceUpdatedAt,
      priceVsBuyPercent,
      marketValueIdr: formatAmount(marketValueIdr),
      costBasisIdr: formatAmount(costBasisIdr),
      unrealizedPnlIdr: formatSignedAmount(
        marketValueIdr.sub(costBasisIdr),
      ),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private computePriceVsBuyPercent(
    buyPrice: Prisma.Decimal | null,
    marketPrice: Prisma.Decimal | null,
  ): string | null {
    if (!buyPrice || !marketPrice || buyPrice.lte(0)) {
      return null;
    }

    const delta = marketPrice.sub(buyPrice).div(buyPrice).mul(100);
    return delta.toFixed(2);
  }

  private toTransactionResponse(transaction: AssetTransaction) {
    return {
      id: transaction.id,
      assetId: transaction.assetId,
      type: transaction.type,
      quantity: formatDecimal(transaction.quantity) ?? '0',
      pricePerUnitIdr: formatPriceIdr(transaction.pricePerUnitIdr) ?? '0',
      totalValueIdr: formatAmount(transaction.totalValueIdr),
      description: transaction.description,
      occurredAt: transaction.occurredAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
