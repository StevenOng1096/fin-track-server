import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurringType } from '@prisma/client';
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

  /** Day of month (1–31) when payment is due each month. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  anchorDay: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoryId?: string;
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
  @Max(31)
  anchorDay?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
