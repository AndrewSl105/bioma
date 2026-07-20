import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IntakesService } from './intakes.service';
import { IntakeAiService } from './intake-ai.service';
import {
  ApplyIntakeOpsDto,
  CreateIntakeDto,
  ParseIntakeTextDto,
  UpdateIntakeDto,
} from './dto/intake.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { UploadedFileLike } from '../common/uploaded-file';

/** Лише власні записи — чужий id дає 403, а не чужі ліки. */
@Controller('intakes')
export class IntakesController {
  constructor(
    private service: IntakesService,
    private ai: IntakeAiService,
  ) {}

  /**
   * Голос → транскрипт → пропоновані операції. НІЧОГО НЕ ЗБЕРІГАЄ.
   *
   * Оголошено вище за ':id', інакше Nest прийняв би «ai» за ідентифікатор.
   */
  @Post('ai/voice')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async parseVoice(@CurrentUser() user: AuthUser, @UploadedFile() audio: UploadedFileLike) {
    const text = await this.ai.transcribe(audio);
    return this.ai.parse(user.userId, text);
  }

  /** Текст → пропоновані операції. НІЧОГО НЕ ЗБЕРІГАЄ. */
  @Post('ai/parse')
  parseText(@CurrentUser() user: AuthUser, @Body() dto: ParseIntakeTextDto) {
    return this.ai.parse(user.userId, dto.text);
  }

  /** Підтверджені операції → одна транзакція. Тільки тут відбувається запис. */
  @Post('ai/apply')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyIntakeOpsDto) {
    return this.service.applyOps(user.userId, dto.ops);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntakeDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
