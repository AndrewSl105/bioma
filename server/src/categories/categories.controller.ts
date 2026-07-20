import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { Locale } from '../i18n/locale.decorator';
import type { Locale as LocaleTag } from '../i18n/locale';
import {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  /**
   * Читання відкрите всім авторизованим: категорії потрібні і в діалозі
   * вибору показника. Адмін додатково бачить неактивні й переклади.
   */
  @Get()
  list(@CurrentUser() user: AuthUser, @Locale() locale: LocaleTag) {
    return this.service.list(locale, user.role === 'admin');
  }

  /**
   * reorder оголошений ДО ':id', інакше Nest зіставив би '/reorder' з
   * параметром і слав би сюди id зі значенням 'reorder'.
   */
  @Patch('reorder')
  @AdminOnly()
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.service.reorder(dto);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateCategoryDto, @Locale() locale: LocaleTag) {
    return this.service.create(dto, locale);
  }

  @Patch(':id')
  @AdminOnly()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Locale() locale: LocaleTag,
  ) {
    return this.service.update(id, dto, locale);
  }

  /** М'яке видалення, якщо на категорію є посилання. */
  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
