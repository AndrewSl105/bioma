import { Module } from '@nestjs/common';
import { BodyService } from './body.service';
import { BodyController } from './body.controller';

@Module({
  controllers: [BodyController],
  providers: [BodyService],
  exports: [BodyService],
})
export class BodyModule {}
