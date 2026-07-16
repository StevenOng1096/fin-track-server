import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AssetType } from '../../generated/prisma/client';

export class CreateAssetDto {
  @IsEnum(AssetType)
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
    message: 'Initial quantity must be a non-negative decimal',
  })
  initialQuantity?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'Buy price per unit must be a non-negative IDR amount with up to 2 decimals',
  })
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
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'Price per unit must be a non-negative IDR amount with up to 2 decimals',
  })
  pricePerUnitIdr?: string;
}
