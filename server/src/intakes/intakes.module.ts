import { Module } from '@nestjs/common';
import { IntakesService } from './intakes.service';
import { IntakeAiService } from './intake-ai.service';
import { IntakesController } from './intakes.controller';

@Module({
  controllers: [IntakesController],
  providers: [IntakesService, IntakeAiService],
  exports: [IntakesService, IntakeAiService],
})
export class IntakesModule {}
