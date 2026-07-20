import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { CreateResultDto } from './dto/create-result.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';

@Controller()
export class ResultsController {
  constructor(private service: ResultsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Locale() locale: LocaleTag) {
    return this.service.overview(user.userId, locale);
  }

  @Get('results')
  history(
    @CurrentUser() user: AuthUser,
    @Query('biomarker') slug: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.history(user.userId, slug, locale);
  }

  @Post('results')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateResultDto) {
    return this.service.create(user.userId, dto);
  }

  @Delete('results/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
