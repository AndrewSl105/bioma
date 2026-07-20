import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { CycleService } from './cycle.service';
import { UpdateCycleSettingsDto, UpsertCycleDayDto } from './dto/cycle.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

/** Найчутливіші дані застосунку — лише власник, лише за згодою. */
@Controller('cycle')
export class CycleController {
  constructor(private service: CycleService) {}

  @Get('settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.service.settings(user.userId);
  }

  @Put('settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateCycleSettingsDto) {
    return this.service.updateSettings(user.userId, dto);
  }

  @Get()
  overview(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.overview(user.userId, from, to);
  }

  @Post('day')
  upsertDay(@CurrentUser() user: AuthUser, @Body() dto: UpsertCycleDayDto) {
    return this.service.upsertDay(user.userId, dto);
  }

  /** Видалення всіх даних циклу окремо від акаунта. */
  @Delete()
  deleteAll(@CurrentUser() user: AuthUser) {
    return this.service.deleteAll(user.userId);
  }
}
