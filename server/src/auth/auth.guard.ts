import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { RoleService, normalizeRole, type UserRole } from './role.service';
import { DEMO_MODE, DEMO_USER, verifyDemoToken } from './demo';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Локальна розробка без реального логіну: AUTH_DEV_BYPASS=true пропускає
 * JWKS-перевірку і кладе фіксованого dev-користувача. Працює в парі з
 * VITE_AUTH_DEV_BYPASS=true на клієнті. НЕ вмикати у проді.
 */
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === 'true';
const DEV_USER = { userId: 'dev-user', email: 'dev@local.test', name: 'Dev User' };

/**
 * Роль dev-користувача. За замовчуванням 'user': dev-обхід не має мовчки
 * робити адміністратора — щоб адмінські шляхи перевірялись свідомо
 * (AUTH_DEV_ROLE=admin), а не «випадково працювали» в розробці.
 */
const DEV_ROLE: UserRole = normalizeRole(process.env.AUTH_DEV_ROLE);

/**
 * Обхід — суто інструмент розробки. У проді він означав би вхід без пароля,
 * тож падаємо на старті, а не пускаємо запити повз автентифікацію.
 */
if (DEV_BYPASS && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AUTH_DEV_BYPASS=true у production. Це повністю вимикає автентифікацію — приберіть змінну.',
  );
}

/** Без JWKS-URL гард нічого не перевірить — падаємо одразу і зрозуміло. */
function requireJwksUrl(): string {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) {
    throw new Error(
      'NEON_AUTH_JWKS_URL не задано. Вигляд: ' +
        'https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth/.well-known/jwks.json',
    );
  }
  return url;
}

/**
 * Перевіряє JWT, виданий Neon Auth (Stack Auth), проти JWKS проєкту,
 * і кладе { userId, email, name, role } у request.user.
 *
 * У БД свідомо нічого не ПИШЕ: гард не має залежати від наявності рядка
 * UserProfile. Профіль створюється явно — POST /api/profile/ensure.
 *
 * Роль — єдине читання з БД, і воно навмисне: тримати AuthUser.role
 * заповненим завжди безпечніше, ніж лишати поле напівпорожнім і сподіватись,
 * що кожен контролер згадає про RolesGuard. Читання закешоване (60 с) і
 * fail-closed, тож ані «курки з яйцем», ані 500 через нього не буває.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  // У dev-bypass і демо-режимі JWKS не потрібен (NEON_AUTH_JWKS_URL може бути відсутнім).
  private jwks = DEV_BYPASS || DEMO_MODE ? null : createRemoteJWKSet(new URL(requireJwksUrl()));

  constructor(
    private reflector: Reflector,
    private roles: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    if (DEV_BYPASS) {
      req.user = { ...DEV_USER, role: DEV_ROLE };
      return true;
    }

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Немає токена доступу');

    if (DEMO_MODE) {
      try {
        await verifyDemoToken(token);
      } catch (e) {
        this.logger.warn(`Демо-JWT не пройшов перевірку: ${(e as Error).message}`);
        throw new UnauthorizedException('Недійсний або протермінований токен');
      }
      // Роль не читаємо: таблиці neon_auth у демо-базі немає, а демо-
      // користувач однаково ніколи не адмін.
      req.user = { ...DEMO_USER, role: 'user' };
      return true;
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks!));
    } catch (e) {
      // Тільки збій перевірки підпису/строку — це справді 401.
      this.logger.warn(`JWT не пройшов перевірку: ${(e as Error).message}`);
      throw new UnauthorizedException('Недійсний або протермінований токен');
    }

    if (!payload.sub) {
      this.logger.error(`JWT без claim "sub"; claims: ${Object.keys(payload).join(', ')}`);
      throw new UnauthorizedException('У токені немає ідентифікатора користувача');
    }

    const userId = payload.sub;
    const email = (payload.email as string) ?? null;
    const name = (payload.name as string) ?? null;

    // Роль беремо з Neon Auth, а НЕ з claim'а: payload.role тут — це
    // "authenticated", тобто роль Postgres для RLS, однакова в усіх.
    const role = await this.roles.getRole(userId);

    req.user = { userId, email, name, role };
    return true;
  }

  private extractToken(req: any): string | undefined {
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
