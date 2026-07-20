import { Module } from '@nestjs/common';
import { CycleService } from './cycle.service';
import { CycleController } from './cycle.controller';

@Module({
  controllers: [CycleController],
  providers: [CycleService],
  exports: [CycleService],
})
export class CycleModule {}
