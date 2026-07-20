import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BodyService } from './body.service';
import { CreateBloodPressureDto, CreateBodyMetricDto, SetHeightDto } from './dto/body.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import type { BodyMetricKind } from '../generated/prisma/enums';

@Controller('body')
export class BodyController {
  constructor(private service: BodyService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user.userId);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query('kind') kind: BodyMetricKind) {
    return this.service.history(user.userId, kind);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBodyMetricDto) {
    return this.service.create(user.userId, dto);
  }

  /** Тиск — окремий маршрут: один вимір, два числа, одна дата. */
  @Post('blood-pressure')
  createBloodPressure(@CurrentUser() user: AuthUser, @Body() dto: CreateBloodPressureDto) {
    return this.service.createBloodPressure(user.userId, dto);
  }

  @Put('height')
  setHeight(@CurrentUser() user: AuthUser, @Body() dto: SetHeightDto) {
    return this.service.setHeight(user.userId, dto.heightCm ?? null);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
