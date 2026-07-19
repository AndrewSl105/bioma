import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { UserSyncService } from './user-sync.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

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
 * Перевіряє JWT, виданий Neon Auth (Stack Auth), проти JWKS проєкту.
 * У success-кейсі кладе { userId, email, name } у request.user
 * і синхронізує дзеркало користувача в БД.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwks = createRemoteJWKSet(new URL(requireJwksUrl()));

  constructor(
    private reflector: Reflector,
    private userSync: UserSyncService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Немає токена доступу');

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks));
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

    // Дзеркало користувача в нашій БД. Свідомо НЕ ковтаємо помилку:
    // раніше вона маскувалась під «недійсний токен» і робила проблему
    // невідстежуваною. Збій запису — це 500 на нашому боці, а не 401.
    try {
      await this.userSync.ensureUser({ id: userId, email, name });
    } catch (e) {
      this.logger.error(`Не вдалося синхронізувати користувача ${userId}: ${(e as Error).message}`);
      throw new InternalServerErrorException('Помилка синхронізації користувача');
    }

    req.user = { userId, email, name };
    return true;
  }

  private extractToken(req: any): string | undefined {
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
