import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AssetType } from '@prisma/client';
import {
  IDR_AMOUNT_REGEX,
  IDR_NON_NEGATIVE_AMOUNT_MESSAGE,
} from '../../common/utils/money';

export class CreateAssetDto {
  @IsEnum(AssetType, { message: 'Please select an asset type.' })
  type: AssetType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ValidateIf((dto) => dto.type === AssetType.STOCK)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9._-]+$/, {
    message:
      'Stock symbol must use uppercase letters, numbers, dots, dashes, or underscores',
  })
  symbol?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Enter a valid quantity (0 or more).',
  })
  initialQuantity?: string;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  initialPricePerUnitIdr?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  pricePerUnitIdr?: string;
}
