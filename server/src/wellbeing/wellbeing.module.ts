import { Module } from '@nestjs/common';
import { WellbeingService } from './wellbeing.service';
import { WellbeingController } from './wellbeing.controller';

@Module({
  controllers: [WellbeingController],
  providers: [WellbeingService],
  exports: [WellbeingService],
})
export class WellbeingModule {}
