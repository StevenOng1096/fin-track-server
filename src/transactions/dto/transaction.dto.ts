import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from '@prisma/client';
import {
  IDR_AMOUNT_REGEX,
  IDR_NON_NEGATIVE_AMOUNT_MESSAGE,
  IDR_POSITIVE_AMOUNT_MESSAGE,
} from '../../common/utils/money';

export class CreateTransactionDto {
  @IsUUID()
  walletId: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @ValidateIf((dto) => dto.type !== TransactionType.ADJUSTMENT)
  @IsString()
  @IsNotEmpty()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount?: string;

  @ValidateIf((dto) => dto.type === TransactionType.ADJUSTMENT)
  @IsString()
  @IsNotEmpty()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  targetBalance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoryId?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoryId?: string | null;
}

export class PeriodSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
