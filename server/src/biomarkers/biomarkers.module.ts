import { Module } from '@nestjs/common';
import { BiomarkersService } from './biomarkers.service';
import { BiomarkersController } from './biomarkers.controller';

@Module({
  controllers: [BiomarkersController],
  providers: [BiomarkersService],
  exports: [BiomarkersService],
})
export class BiomarkersModule {}
