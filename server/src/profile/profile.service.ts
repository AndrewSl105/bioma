import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  /**
   * Створює UserProfile при першому вході. Ідемпотентно: повторний виклик
   * лише повертає наявний профіль і НЕ чіпає sex/birthDate — інакше
   * кожен вхід затирав би те, що користувач сам виставив.
   */
  async ensure(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async get(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Профіль не створено');
    return profile;
  }

  /** Оновлює наші поля. Профілю може ще не бути — створюємо на льоту. */
  async update(userId: string, dto: UpdateProfileDto) {
    const data = {
      ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
      ...(dto.birthDate !== undefined
        ? { birthDate: dto.birthDate === null ? null : new Date(dto.birthDate) }
        : {}),
    };
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
