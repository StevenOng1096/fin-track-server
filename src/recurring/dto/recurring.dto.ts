import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  RecurringIntervalUnit,
  RecurringType,
} from '@prisma/client';
import {
  IDR_AMOUNT_REGEX,
  IDR_POSITIVE_AMOUNT_MESSAGE,
} from '../../common/utils/money';

export class CreateRecurringDto {
  @IsUUID()
  walletId: string;

  @IsEnum(RecurringType)
  type: RecurringType;

  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalValue: number;

  @IsEnum(RecurringIntervalUnit)
  intervalUnit: RecurringIntervalUnit;

  @IsDateString()
  nextDueAt: string;
}

export class UpdateRecurringDto {
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsEnum(RecurringType)
  type?: RecurringType;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalValue?: number;

  @IsOptional()
  @IsEnum(RecurringIntervalUnit)
  intervalUnit?: RecurringIntervalUnit;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
