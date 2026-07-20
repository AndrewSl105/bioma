import { Controller, Get, Param, Query } from '@nestjs/common';
import { PanelsService } from './panels.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';

@Controller('panels')
export class PanelsController {
  constructor(private service: PanelsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  /**
   * ПОРЯДОК ВАЖЛИВИЙ: 'compare' оголошено вище за ':id'. Nest матчить маршрути
   * у порядку декларації, і нижче цей запит з'їв би обробник ':id', прийнявши
   * слово «compare» за ідентифікатор забору.
   */
  @Get('compare')
  compare(
    @CurrentUser() user: AuthUser,
    @Query('a') a: string,
    @Query('b') b: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.compare(user.userId, a, b, locale);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.detail(user.userId, id, locale);
  }
}
