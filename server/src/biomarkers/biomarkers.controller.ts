import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { BiomarkersService } from './biomarkers.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';
import { CreateBiomarkerDto, UpdateBiomarkerDto } from './dto/biomarker.dto';
import { BiomarkerContentDto } from './dto/biomarker-content.dto';
import { SetRetestDto } from './dto/biomarker.dto';

@Controller('biomarkers')
export class BiomarkersController {
  constructor(private service: BiomarkersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Locale() locale: LocaleTag) {
    return this.service.list(user.userId, locale);
  }

  /**
   * Оголошено ДО ':slug', інакше Nest зіставив би '/admin' з параметром і
   * шукав би показник зі slug 'admin'.
   */
  @Get('admin')
  @AdminOnly()
  adminList(@Locale() locale: LocaleTag) {
    return this.service.adminList(locale);
  }

  @Get(':slug')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.findBySlug(user.userId, slug, locale);
  }

  /** Особистий інтервал перездачі (днів). null — прибрати нагадування. */
  @Put(':slug/retest')
  setRetest(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: SetRetestDto,
  ) {
    return this.service.setRetestInterval(user.userId, slug, dto.retestIntervalDays ?? null);
  }

  /** Довідковий контент показника мовою запиту. */
  @Get(':slug/content')
  content(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.findContent(user.userId, slug, locale);
  }

  /** Усі локалі контенту — для форми редагування. */
  @Get(':slug/content/all')
  @AdminOnly()
  allContent(@Param('slug') slug: string) {
    return this.service.listContent(slug);
  }

  @Put(':slug/content/:locale')
  @AdminOnly()
  saveContent(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('locale') locale: string,
    @Body() dto: BiomarkerContentDto,
  ) {
    return this.service.upsertContent(slug, locale, dto, user.userId);
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
  create(
    @CurrentUser() user: AuthUser,
    @Locale() locale: LocaleTag,
    @Body() dto: CreateBiomarkerDto,
  ) {
    return this.service.createSystem(user.userId, locale, dto);
  }

  @Patch(':slug')
  @AdminOnly()
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdateBiomarkerDto,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.update(slug, dto, locale);
  }
}
