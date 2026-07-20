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

  /**
   * Застосовує підтверджені операції ОДНІЄЮ транзакцією.
   *
   * Транзакція тут не формальність: людина підтвердила набір змін як ціле
   * («почав D, припинив магній»), і половина застосованих змін гірша за
   * жодної — список ліків виглядав би відредагованим, хоча ним не є.
   *
   * STOP/UPDATE без targetId відхиляємо: без явного посилання на запис
   * можна зупинити не те, а це саме та помилка, яку diff мав відсіяти.
   */
  async applyOps(
    userId: string,
    ops: {
      op: 'ADD' | 'STOP' | 'UPDATE';
      type?: 'MEDICATION' | 'SUPPLEMENT';
      name: string;
      drugClassKey?: string | null;
      dosageText?: string | null;
      note?: string | null;
      targetId?: string | null;
    }[],
  ) {
    if (!ops.length) return { added: 0, stopped: 0, updated: 0 };

    // Усі цілі мають належати цьому користувачу — перевіряємо ДО транзакції,
    // щоб не почати застосовувати частину змін і впасти посередині.
    const targetIds = ops.filter((o) => o.op !== 'ADD').map((o) => o.targetId).filter(Boolean) as string[];
    if (targetIds.length) {
      const owned = await this.prisma.userIntake.count({
        where: { id: { in: targetIds }, userId },
      });
      if (owned !== new Set(targetIds).size) throw new ForbiddenException();
    }
    if (ops.some((o) => o.op !== 'ADD' && !o.targetId)) {
      throw new NotFoundException('Не вказано, який саме запис змінити');
    }

    const now = new Date();
    const writes = ops.map((o) => {
      if (o.op === 'ADD') {
        return this.prisma.userIntake.create({
          data: {
            userId,
            type: o.type ?? 'SUPPLEMENT',
            name: o.name,
            drugClassKey: o.drugClassKey ?? null,
            // Дозування зберігаємо як текст, дослівно. Ми його не
            // інтерпретуємо й нічого з нього не рахуємо.
            dosageText: o.dosageText ?? null,
            note: o.note ?? null,
            startDate: now,
          },
        });
      }
      if (o.op === 'STOP') {
        // «Припинив» — це endDate, а не видалення: історія прийому лишається
        // контекстом до старих аналізів.
        return this.prisma.userIntake.update({
          where: { id: o.targetId! },
          data: { endDate: now },
        });
      }
      return this.prisma.userIntake.update({
        where: { id: o.targetId! },
        data: {
          ...(o.name ? { name: o.name } : {}),
          ...(o.type ? { type: o.type } : {}),
          ...(o.drugClassKey !== undefined ? { drugClassKey: o.drugClassKey } : {}),
          ...(o.dosageText !== undefined ? { dosageText: o.dosageText } : {}),
          ...(o.note !== undefined ? { note: o.note } : {}),
        },
      });
    });

    await this.prisma.$transaction(writes);
    return {
      added: ops.filter((o) => o.op === 'ADD').length,
      stopped: ops.filter((o) => o.op === 'STOP').length,
      updated: ops.filter((o) => o.op === 'UPDATE').length,
    };
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
