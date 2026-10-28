import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { Public } from './auth.guard';
import { DEMO_MODE, DEMO_PASSWORD, DEMO_USER, checkDemoCredentials, signDemoToken } from './demo';

class DemoLoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

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

  /**
   * Демо-облікові дані для сторінки входу. Вони публічні за задумом —
   * так сторінка завжди показує саме те, що прийме сервер.
   * Поза демо-режимом маршруту ніби й немає.
   */
  @Public()
  @Get('demo')
  demo() {
    if (!DEMO_MODE) throw new NotFoundException();
    return { email: DEMO_USER.email, password: DEMO_PASSWORD };
  }

  @Public()
  @Post('demo/login')
  @HttpCode(200)
  async demoLogin(@Body() body: DemoLoginDto) {
    if (!DEMO_MODE) throw new NotFoundException();
    if (!checkDemoCredentials(body.email, body.password)) {
      throw new UnauthorizedException('Невірний email або пароль');
    }
    return {
      token: await signDemoToken(),
      user: { id: DEMO_USER.userId, email: DEMO_USER.email, name: DEMO_USER.name },
    };
  }
}
