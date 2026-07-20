import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { BiomarkersService } from './biomarkers.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';

@Controller('biomarkers')
export class BiomarkersController {
  constructor(private service: BiomarkersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Locale() locale: LocaleTag) {
    return this.service.list(user.userId, locale);
  }

  @Get(':slug')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.findBySlug(user.userId, slug, locale);
  }

  /** Додати показник із каталогу на свій дашборд. */
  @Post(':slug/select')
  select(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.service.select(user.userId, slug);
  }

  /** Прибрати показник із дашборда. Історія результатів лишається. */
  @Delete(':slug/select')
  deselect(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.service.deselect(user.userId, slug);
  }

  /**
   * Заведення нового показника в каталог. Лише адміністратор: звичайний
   * користувач власні маркери не створює, а обирає зі спільного списку.
   */
  @Post()
  @AdminOnly()
  create(@CurrentUser() user: AuthUser, @Locale() locale: LocaleTag, @Body() body: any) {
    return this.service.createSystem(user.userId, locale, body);
  }
}
