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
  @IsString({ message: 'Wallet name must be text.' })
  @IsNotEmpty({ message: 'Wallet name is required.' })
  @MaxLength(100, { message: 'Wallet name must be 100 characters or less.' })
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(WALLET_COLOR_KEYS, { message: 'Please choose a valid wallet color.' })
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(IDR_AMOUNT_REGEX, { message: IDR_NON_NEGATIVE_AMOUNT_MESSAGE })
  initialBalance?: string;
}

export class UpdateWalletDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Wallet name is required.' })
  @MaxLength(100, { message: 'Wallet name must be 100 characters or less.' })
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(WALLET_COLOR_KEYS, { message: 'Please choose a valid wallet color.' })
  color?: string;
}

export class ReorderWalletsDto {
  @IsArray({ message: 'Wallet list is required.' })
  @ArrayMinSize(1, { message: 'Select at least one wallet to reorder.' })
  @IsUUID('4', { each: true, message: 'One or more wallet selections are invalid.' })
  walletIds: string[];
}

export { DEFAULT_WALLET_COLOR, WALLET_COLOR_KEYS };
