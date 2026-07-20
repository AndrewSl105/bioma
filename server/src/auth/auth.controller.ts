import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  /**
   * Нормалізований поточний користувач разом із роллю.
   *
   * Frontend вирішує за цим, чи показувати адмінський UI, але це суто
   * питання відображення: кожен /api/admin/* маршрут однаково перевіряє
   * роль сам, через RolesGuard.
   */
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
