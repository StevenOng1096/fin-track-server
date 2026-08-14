import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
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
  @IsUUID('4', { message: 'Please select a wallet' })
  walletId: string;

  @IsEnum(RecurringType, { message: 'Please select expense or income' })
  type: RecurringType;

  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Description must be 255 characters or less' })
  description?: string;

  @Type(() => Number)
  @IsInt({ message: 'Due day must be a whole number' })
  @Min(1, { message: 'Due day must be between 1 and 31' })
  @Max(31, { message: 'Due day must be between 1 and 31' })
  anchorDay: number;

  @IsUUID('4', { message: 'Please select a subcategory' })
  subcategoryId: string;
}

export class UpdateRecurringDto {
  @IsOptional()
  @IsUUID('4', { message: 'Please select a wallet' })
  walletId?: string;

  @IsOptional()
  @IsEnum(RecurringType, { message: 'Please select expense or income' })
  type?: RecurringType;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_POSITIVE_AMOUNT_MESSAGE })
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Description must be 255 characters or less' })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Due day must be a whole number' })
  @Min(1, { message: 'Due day must be between 1 and 31' })
  @Max(31, { message: 'Due day must be between 1 and 31' })
  anchorDay?: number;

  @IsOptional()
  @IsUUID('4', { message: 'Please select a valid subcategory' })
  subcategoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
