import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { UploadedFileLike } from '../common/uploaded-file';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';

@Controller('ai')
export class AiController {
  constructor(private service: AiService) {}

  /** multipart/form-data з полем `file` (фото документа). */
  @Post('extract')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  extract(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileLike,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.extract(user.userId, file, locale);
  }

  @Post('commit')
  commit(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.service.commit(user.userId, body);
  }
}
