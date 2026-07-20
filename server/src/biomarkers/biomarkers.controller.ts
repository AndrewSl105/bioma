import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { BiomarkersService } from './biomarkers.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AdminOnly } from '../auth/roles.decorator';

@Controller('biomarkers')
export class BiomarkersController {
  constructor(private service: BiomarkersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  @Get(':slug')
  findOne(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.service.findBySlug(user.userId, slug);
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
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.service.createSystem(user.userId, body);
  }
}
