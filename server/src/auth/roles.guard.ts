import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from './role.service';
import type { AuthUser } from './current-user.decorator';

/**
 * Перевіряє роль ПІСЛЯ AuthGuard (порядок реєстрації в AppModule).
 *
 * Роль сюди приходить із req.user, куди її поклав AuthGuard, прочитавши з
 * Neon Auth. Frontend на це не впливає ніяк: у запиті немає нічого, чим би
 * клієнт міг підняти собі права — лише підписаний JWT, з якого беремо sub.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Маршрут без @Roles() ролі не обмежує.
    if (!required?.length) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    // Без користувача сюди можна потрапити лише на @Public()-маршруті,
    // позначеному ще й @Roles() — це помилка конфігурації, не 403 «за фактом».
    if (!user) throw new ForbiddenException('Недостатньо прав');

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Ця дія доступна лише адміністратору');
    }
    return true;
  }
}
