import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from './role.service';

export interface AuthUser {
  userId: string;
  email: string | null;
  name: string | null;
  /** Прикладна роль із Neon Auth. Ніколи не приходить із запиту клієнта. */
  role: UserRole;
}

/** Дістає авторизованого користувача з request (кладе AuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
