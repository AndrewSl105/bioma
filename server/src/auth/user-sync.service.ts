import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserSyncService {
  constructor(private prisma: PrismaService) {}

  async ensureUser(input: { id: string; email: string | null; name: string | null }) {
    await this.prisma.user.upsert({
      where: { id: input.id },
      create: { id: input.id, email: input.email, name: input.name },
      update: { email: input.email ?? undefined, name: input.name ?? undefined },
    });
  }
}
