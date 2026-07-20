import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IntakesService } from './intakes.service';
import { CreateIntakeDto, UpdateIntakeDto } from './dto/intake.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

/** Лише власні записи — чужий id дає 403, а не чужі ліки. */
@Controller('intakes')
export class IntakesController {
  constructor(private service: IntakesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntakeDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
