import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UserRole = 'user' | 'admin';

/**
 * Роль користувача. Джерело істини — Neon Auth, але НЕ claim у JWT.
 *
 * Neon Auth підставляє в токен `role: "authenticated"` — це роль Postgres
 * для RLS, однакова геть у всіх. Якби ми нормалізували її, адміном не став
 * би ніхто. Прикладна роль ('user' | 'admin') живе в колонці
 * neon_auth."user".role — її й читаємо за перевіреним sub.
 *
 * Читаємо через $queryRaw і свідомо НЕ заводимо Prisma-модель на neon_auth:
 * це керована Neon схема, і прив'язувати до неї згенерований клієнт не варто.
 */
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  /** Невеликий TTL: зміна ролі в Neon підхоплюється за хвилину, а не з рестартом. */
  private static readonly TTL_MS = 60_000;
  private static readonly CACHE_LIMIT = 10_000;
  private readonly cache = new Map<string, { role: UserRole; expires: number }>();

  constructor(private prisma: PrismaService) {}

  async getRole(userId: string): Promise<UserRole> {
    const hit = this.cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.role;

    const role = await this.readRole(userId);

    if (this.cache.size >= RoleService.CACHE_LIMIT) this.cache.clear();
    this.cache.set(userId, { role, expires: Date.now() + RoleService.TTL_MS });
    return role;
  }

  /** Скидає кеш (напр. після зміни ролі адміном). */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  private async readRole(userId: string): Promise<UserRole> {
    try {
      const rows = await this.prisma.$queryRaw<{ role: string | null }[]>`
        SELECT role FROM neon_auth."user" WHERE id::text = ${userId} LIMIT 1
      `;
      return normalizeRole(rows[0]?.role);
    } catch (e) {
      // Fail closed. Збій читання ніколи не має підвищувати права —
      // максимум користувач тимчасово не побачить адмінку.
      this.logger.error(`Не вдалося прочитати роль ${userId}: ${(e as Error).message}`);
      return 'user';
    }
  }
}

/**
 * Усе, що не є точним 'admin', — звичайний користувач.
 * Зокрема й "authenticated" з JWT, якщо колись сюди потрапить.
 */
export function normalizeRole(raw: unknown): UserRole {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}
