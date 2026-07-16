import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetPricesService } from './asset-prices.service';
import { AssetsService } from './assets.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AssetPricesService],
  exports: [AssetsService],
})
export class AssetsModule {}
