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
import { AssetTransactionType } from '@prisma/client';
import {
  IDR_AMOUNT_REGEX,
  IDR_NON_NEGATIVE_AMOUNT_MESSAGE,
} from '../../common/utils/money';

export class CreateAssetTransactionDto {
  @IsEnum(AssetTransactionType, {
    message: 'Please select buy, sell, or adjust.',
  })
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
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  pricePerUnitIdr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Description must be 255 characters or less.' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Please enter a valid date.' })
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
