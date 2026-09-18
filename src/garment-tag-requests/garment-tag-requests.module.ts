import { Module } from '@nestjs/common';
import { GarmentTagRequestsController } from './garment-tag-requests.controller';
import { GarmentTagRequestsService } from './garment-tag-requests.service';

@Module({
  controllers: [GarmentTagRequestsController],
  providers: [GarmentTagRequestsService],
})
export class GarmentTagRequestsModule {}
