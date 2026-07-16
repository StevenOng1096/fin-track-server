import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AssetTransactionType } from '../../generated/prisma/client';

export class CreateAssetTransactionDto {
  @IsEnum(AssetTransactionType)
  type: AssetTransactionType;

  @ValidateIf((dto) => dto.type !== AssetTransactionType.ADJUSTMENT)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Quantity must be a positive decimal number' })
  quantity?: string;

  @ValidateIf((dto) => dto.type === AssetTransactionType.ADJUSTMENT)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Target quantity must be a non-negative decimal' })
  targetQuantity?: string;

  @ValidateIf((dto) => dto.type !== AssetTransactionType.ADJUSTMENT)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Price per unit must be a non-negative IDR amount with up to 2 decimals',
  })
  pricePerUnitIdr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class ListAssetTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
