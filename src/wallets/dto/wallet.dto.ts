import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  DEFAULT_WALLET_COLOR,
  WALLET_COLOR_KEYS,
} from '../wallet-colors';
import {
  IDR_AMOUNT_REGEX,
  IDR_NON_NEGATIVE_AMOUNT_MESSAGE,
} from '../../common/utils/money';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(WALLET_COLOR_KEYS)
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  initialBalance?: string;
}

export class UpdateWalletDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(WALLET_COLOR_KEYS)
  color?: string;
}

export class ReorderWalletsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  walletIds: string[];
}

export { DEFAULT_WALLET_COLOR, WALLET_COLOR_KEYS };
