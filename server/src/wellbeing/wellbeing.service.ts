import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertWellbeingDto } from './dto/wellbeing.dto';

/**
 * Щоденний чек-ін самопочуття.
 *
 * Чутливі дані — лише власник. Тон нейтральний: ми фіксуємо те, що людина
 * сама відзначила, і показуємо це назад у часі. Жодних клінічних висновків,
 * жодних причинних тверджень («X спричиняє Y») і жодної кризової логіки —
 * для валідованих шкал у застосунку є PROM.
 */
@Injectable()
export class WellbeingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Дата без часу.
   *
   * Рядок 'YYYY-MM-DD' парсимо вручну, а не через new Date(iso): той читає
   * його як UTC, і на від'ємних зсувах чек-ін «сьогодні» лягав би вчорашнім
   * днем. Колонка @db.Date, тож час однаково відкидається — важливо лише,
   * щоб день був той самий, який людина бачить у себе.
   */
  private day(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /** Чек-ін за конкретний день; null — того дня нічого не відзначали. */
  async get(userId: string, date: string) {
    return this.prisma.wellbeingLog.findUnique({
      where: { userId_date: { userId, date: this.day(date) } },
    });
  }

  /**
   * Запис або перезапис дня.
   *
   * Саме upsert: людина може відзначити зранку сон, а ввечері — настрій, і
   * другий чек-ін має доповнити той самий день, а не завести другий рядок.
   */
  async upsert(userId: string, dto: UpsertWellbeingDto) {
    const date = this.day(dto.date);
    const data = {
      energy: dto.energy ?? null,
      sleepQuality: dto.sleepQuality ?? null,
      sleepHours: dto.sleepHours ?? null,
      mood: dto.mood ?? null,
      digestion: dto.digestion ?? null,
      note: dto.note ?? null,
    };
    return this.prisma.wellbeingLog.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: { userId, date, ...data },
    });
  }

  /** Діапазон днів — для трендів по кожній шкалі. */
  async range(userId: string, from: string, to: string) {
    return this.prisma.wellbeingLog.findMany({
      where: { userId, date: { gte: this.day(from), lte: this.day(to) } },
      orderBy: { date: 'asc' },
    });
  }
}
