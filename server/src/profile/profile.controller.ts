import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('profile')
export class ProfileController {
  constructor(private service: ProfileService) {}

  /**
   * Викликається клієнтом одразу після успішного логіну/реєстрації —
   * саме тут UserProfile з'являється в нашій БД. Явний крок замість
   * побічного ефекту гарда: жоден інший запит не залежить від нього.
   */
  @Post('ensure')
  ensure(@CurrentUser() user: AuthUser) {
    return this.service.ensure(user.userId);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.service.update(user.userId, dto);
  }
}
