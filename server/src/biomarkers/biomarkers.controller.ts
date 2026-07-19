import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BiomarkersService } from './biomarkers.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

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

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.service.createCustom(user.userId, body);
  }
}
