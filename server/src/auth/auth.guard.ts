import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UserSyncService } from './user-sync.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Перевіряє JWT, виданий Neon Auth (Stack Auth), проти JWKS проєкту.
 * У success-кейсі кладе { userId, email, name } у request.user
 * і синхронізує дзеркало користувача в БД.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private jwks = createRemoteJWKSet(
    new URL(process.env.NEON_AUTH_JWKS_URL as string),
  );

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

    try {
      const { payload } = await jwtVerify(token, this.jwks);
      const userId = String(payload.sub);
      const email = (payload.email as string) ?? null;
      const name = (payload.name as string) ?? null;

      // upsert дзеркала користувача (не блокує запит помилками)
      await this.userSync.ensureUser({ id: userId, email, name });

      req.user = { userId, email, name };
      return true;
    } catch {
      throw new UnauthorizedException('Недійсний або протермінований токен');
    }
  }

  private extractToken(req: any): string | undefined {
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
