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

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Локальна розробка без реального логіну: AUTH_DEV_BYPASS=true пропускає
 * JWKS-перевірку і кладе фіксованого dev-користувача. Працює в парі з
 * VITE_AUTH_DEV_BYPASS=true на клієнті. НЕ вмикати у проді.
 */
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === 'true';
const DEV_USER = { userId: 'dev-user', email: 'dev@local.test', name: 'Dev User' };

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
 * і кладе { userId, email, name } у request.user.
 *
 * Свідомо НІЧОГО не пише в БД: гард не має залежати від наявності рядка
 * UserProfile. Профіль створюється явно при першому вході —
 * POST /api/profile/ensure.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  // У dev-bypass режимі JWKS не потрібен (і NEON_AUTH_JWKS_URL може бути відсутнім).
  private jwks = DEV_BYPASS ? null : createRemoteJWKSet(new URL(requireJwksUrl()));

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    if (DEV_BYPASS) {
      req.user = { ...DEV_USER };
      return true;
    }

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Немає токена доступу');

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

    req.user = { userId, email, name };
    return true;
  }

  private extractToken(req: any): string | undefined {
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
