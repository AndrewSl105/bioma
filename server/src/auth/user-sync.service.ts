import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserSyncService {
  constructor(private prisma: PrismaService) {}

  /**
   * Id користувачів, для яких рядок у User вже гарантовано існує.
   * Дає рівно один upsert на користувача за життя процесу — а не на кожен
   * запит. Ціна: зміна email/name у Neon Auth підтягнеться лише після
   * рестарту сервера (sex/birthDate це не стосується — їх upsert не чіпає).
   */
  private readonly synced = new Set<string>();
  private static readonly SYNCED_CACHE_LIMIT = 10_000;

  async ensureUser(input: { id: string; email: string | null; name: string | null }) {
    if (this.synced.has(input.id)) return;

    await this.prisma.user.upsert({
      where: { id: input.id },
      create: { id: input.id, email: input.email, name: input.name },
      update: { email: input.email ?? undefined, name: input.name ?? undefined },
    });

    // Запобіжник від безмежного росту; після скидання просто буде
    // ще один upsert на користувача — це безпечно.
    if (this.synced.size >= UserSyncService.SYNCED_CACHE_LIMIT) this.synced.clear();
    this.synced.add(input.id);
  }
}
