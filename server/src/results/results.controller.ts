import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { CreateResultDto } from './dto/create-result.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller()
export class ResultsController {
  constructor(private service: ResultsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user.userId);
  }

  @Get('results')
  history(@CurrentUser() user: AuthUser, @Query('biomarker') slug: string) {
    return this.service.history(user.userId, slug);
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
