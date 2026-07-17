import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetPricesService } from './asset-prices.service';
import { AssetsService } from './assets.service';
import { GoogleSheetService } from './google-sheet.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AssetPricesService, GoogleSheetService],
  exports: [AssetsService],
})
export class AssetsModule {}
