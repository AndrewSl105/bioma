import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeStats, estimateFertileWindow, phaseOn, predictNextPeriod,
} from './cycle.math';
import type { UpsertCycleDayDto, UpdateCycleSettingsDto } from './dto/cycle.dto';

/**
 * Трекінг циклу.
 *
 * Три рівні захисту, і кожен свідомий:
 *  1) розділ існує лише для профілів із sex = FEMALE;
 *  2) дані збираються ЛИШЕ після явної згоди (settings.enabled);
 *  3) усе читання й запис — тільки власне.
 *
 * Похідні величини (фаза, прогнози) — оцінка з історії, не медичний факт.
 * Назви полів лишають це явним (estimated*), а застереження показує клієнт.
 */
@Injectable()
export class CycleService {
  constructor(private prisma: PrismaService) {}

  /** Розділ доступний лише жіночим профілям — інакше 403, а не порожній екран. */
  private async assertEligible(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (profile?.sex !== 'FEMALE') {
      throw new ForbiddenException('Розділ доступний для профілів із жіночою статтю');
    }
  }

  async settings(userId: string) {
    await this.assertEligible(userId);
    const s = await this.prisma.cycleSettings.findUnique({ where: { userId } });
    // Рядка може не бути — це не помилка, а «згоди ще не давали».
    return s ?? { userId, enabled: false, avgCycleLength: null, avgPeriodLength: null, trackingGoal: null };
  }

  async updateSettings(userId: string, dto: UpdateCycleSettingsDto) {
    await this.assertEligible(userId);
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.avgCycleLength !== undefined ? { avgCycleLength: dto.avgCycleLength } : {}),
      ...(dto.avgPeriodLength !== undefined ? { avgPeriodLength: dto.avgPeriodLength } : {}),
      ...(dto.trackingGoal !== undefined ? { trackingGoal: dto.trackingGoal } : {}),
    };
    return this.prisma.cycleSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /** Дата без часу; рядок парсимо вручну — new Date(iso) читає його як UTC. */
  private day(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  async upsertDay(userId: string, dto: UpsertCycleDayDto) {
    await this.assertEligible(userId);
    const date = this.day(dto.date);
    const data = {
      isPeriod: dto.isPeriod ?? false,
      flow: dto.flow ?? null,
      symptoms: dto.symptoms ?? [],
      mood: dto.mood ?? null,
      note: dto.note ?? null,
    };
    return this.prisma.menstrualDay.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: { userId, date, ...data },
    });
  }

  /**
   * Огляд: відмітки, середні з історії, поточна фаза й прогнози.
   *
   * Прогнози віддаємо разом із ознакою usingDefaults — доки історії немає,
   * вони спираються на типові 28/5, і подавати їх як «ваш цикл» було б
   * неправдою.
   */
  async overview(userId: string, from?: string, to?: string) {
    await this.assertEligible(userId);

    const days = await this.prisma.menstrualDay.findMany({
      where: {
        userId,
        ...(from && to ? { date: { gte: this.day(from), lte: this.day(to) } } : {}),
      },
      orderBy: { date: 'asc' },
    });

    // Статистику рахуємо з УСІЄЇ історії, навіть коли календар показує місяць:
    // середні по одному місяцю не мають сенсу.
    const all = from || to ? await this.prisma.menstrualDay.findMany({ where: { userId } }) : days;
    const settings = await this.prisma.cycleSettings.findUnique({ where: { userId } });
    const stats = computeStats(all, settings ?? undefined);

    const today = new Date();
    const current = phaseOn(today, stats);

    return {
      days,
      stats: {
        estimatedCycleLength: stats.estimatedCycleLength,
        estimatedPeriodLength: stats.estimatedPeriodLength,
        cycleLengths: stats.cycleLengths,
        usingDefaults: stats.usingDefaults,
      },
      current,
      estimatedNextPeriod: predictNextPeriod(stats),
      estimatedFertileWindow: estimateFertileWindow(stats),
    };
  }

  /** Фаза на дату забору — контекст для гормональних показників. */
  async phaseOnDate(userId: string, date: Date) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (profile?.sex !== 'FEMALE') return null;
    const settings = await this.prisma.cycleSettings.findUnique({ where: { userId } });
    if (!settings?.enabled) return null;

    const all = await this.prisma.menstrualDay.findMany({ where: { userId } });
    if (!all.length) return null;
    return phaseOn(date, computeStats(all, settings));
  }

  /**
   * Видалення ВСІХ даних циклу окремою дією.
   *
   * Не чекає видалення акаунта: передумати щодо найчутливішого розділу треба
   * мати змогу, не втрачаючи решту історії. Налаштування теж скидаємо —
   * інакше лишився б увімкнений трекінг без даних.
   */
  async deleteAll(userId: string) {
    await this.assertEligible(userId);
    const [{ count }] = await this.prisma.$transaction([
      this.prisma.menstrualDay.deleteMany({ where: { userId } }),
      this.prisma.cycleSettings.updateMany({
        where: { userId },
        data: { enabled: false, avgCycleLength: null, avgPeriodLength: null },
      }),
    ]);
    return { deleted: count };
  }
}
