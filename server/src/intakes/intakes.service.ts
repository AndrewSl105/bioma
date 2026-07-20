import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateIntakeDto, UpdateIntakeDto } from './dto/intake.dto';

/**
 * Ліки й добавки користувача.
 *
 * Усі методи працюють ЛИШЕ з власними записами: це чутливі персональні дані,
 * і жоден маршрут тут не приймає чужий userId. В адмінці їх немає свідомо —
 * адміністратор веде каталог показників, а не призначення конкретної людини.
 *
 * Ми нічого не інтерпретуємо: доза зберігається вільним текстом і повертається
 * як є. Застосунок не радить починати чи припиняти прийом.
 */
@Injectable()
export class IntakesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.userIntake.findMany({
      where: { userId },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => ({ ...r, active: isActive(r) }));
  }

  async create(userId: string, dto: CreateIntakeDto) {
    return this.prisma.userIntake.create({
      data: {
        userId,
        type: dto.type,
        name: dto.name,
        drugClassKey: dto.drugClassKey ?? null,
        dosageText: dto.dosageText ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        note: dto.note ?? null,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateIntakeDto) {
    await this.assertOwner(userId, id);
    return this.prisma.userIntake.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.drugClassKey !== undefined ? { drugClassKey: dto.drugClassKey } : {}),
        ...(dto.dosageText !== undefined ? { dosageText: dto.dosageText } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        // endDate окремо: саме null тут означає «приймає зараз», тож відрізняти
        // «поле не надіслали» від «надіслали null» тут принципово.
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.userIntake.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Активні класи препаратів користувача — те, за чим сторінка показника
   * вирішує, чи показувати освітню плашку.
   */
  async activeClassKeys(userId: string): Promise<string[]> {
    const rows = await this.prisma.userIntake.findMany({
      where: { userId, drugClassKey: { not: null } },
      select: { drugClassKey: true, startDate: true, endDate: true },
    });
    return [...new Set(rows.filter(isActive).map((r) => r.drugClassKey!))];
  }

  private async assertOwner(userId: string, id: string) {
    const row = await this.prisma.userIntake.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Запис не знайдено');
    if (row.userId !== userId) throw new ForbiddenException();
  }
}

/**
 * Активний = вже почався і ще не закінчився.
 *
 * endDate === null означає «приймає зараз» — це основний випадок. Майбутню
 * startDate теж вважаємо неактивною: людина могла записати призначення
 * наперед, і підсвічувати вплив до початку прийому було б неправдою.
 */
export function isIntakeActive(r: { startDate: Date | null; endDate: Date | null }): boolean {
  return isActive(r);
}

function isActive(r: { startDate: Date | null; endDate: Date | null }): boolean {
  const now = new Date();
  if (r.startDate && r.startDate > now) return false;
  if (r.endDate && r.endDate < now) return false;
  return true;
}
