import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { WellbeingService } from './wellbeing.service';
import { UpsertWellbeingDto } from './dto/wellbeing.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

/** Лише власні записи — самопочуття нікому, крім автора, не показуємо. */
@Controller('wellbeing')
export class WellbeingController {
  constructor(private service: WellbeingService) {}

  /** ПОРЯДОК: 'range' вище за кореневий GET не потрібен (різні шляхи), але
   *  тримаємо його першим для читабельності. */
  @Get('range')
  range(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.service.range(user.userId, from, to);
  }

  @Get()
  get(@CurrentUser() user: AuthUser, @Query('date') date: string) {
    return this.service.get(user.userId, date);
  }

  @Put()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertWellbeingDto) {
    return this.service.upsert(user.userId, dto);
  }
}
