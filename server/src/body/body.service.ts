import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeZone, type Band, type Zone } from '../biomarkers/bands';
import type { BodyMetricKind, Sex } from '../generated/prisma/enums';
import { BMI_BANDS, BMI_DEF, BODY_METRICS, BP_KINDS } from './body.catalog';
import type { CreateBodyMetricDto, CreateBloodPressureDto } from './dto/body.dto';

/**
 * Тілесні метрики: вага, талія, пульс у спокої, тиск. Плюс похідний ІМТ.
 *
 * Усе читання й запис — лише для власника: це персональні дані, і жоден
 * маршрут тут не приймає чужий userId.
 */
@Injectable()
export class BodyService {
  constructor(private prisma: PrismaService) {}

  /** Смуги під стать користувача (талія залежить від неї). */
  private bandsFor(kind: BodyMetricKind, sex: Sex | null | undefined): Band[] {
    return BODY_METRICS[kind].bands?.(sex) ?? [];
  }

  /**
   * Зведення: останнє значення кожної метрики, тиск однією карткою, ІМТ
   * похідним. Саме те, що показує екран «Тіло».
   */
  async overview(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const sex = profile?.sex ?? null;

    // Останні значення всіх видів одним запитом: по запиту на метрику це був
    // би N+1 заради п'яти чисел.
    const rows = await this.prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
    });

    const latest = new Map<BodyMetricKind, (typeof rows)[number]>();
    const counts = new Map<BodyMetricKind, number>();
    for (const r of rows) {
      if (!latest.has(r.kind)) latest.set(r.kind, r);
      counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    }

    const metric = (kind: BodyMetricKind) => {
      const def = BODY_METRICS[kind];
      const last = latest.get(kind);
      return {
        kind,
        key: def.key,
        unit: def.unit,
        precision: def.precision,
        bands: this.bandsFor(kind, sex),
        latest: last
          ? {
              id: last.id,
              value: last.value,
              measuredAt: last.measuredAt,
              zone: computeZone(last.value, this.bandsFor(kind, sex)),
            }
          : null,
        count: counts.get(kind) ?? 0,
      };
    };

    const systolic = latest.get('BP_SYSTOLIC');
    const diastolic = latest.get('BP_DIASTOLIC');

    return {
      heightCm: profile?.heightCm ?? null,
      // Прості метрики — вага, талія, пульс. Тиск і ІМТ подаються окремо:
      // перший склеюється з двох рядків, другий не зберігається взагалі.
      metrics: (['WEIGHT', 'WAIST', 'RESTING_HR'] as BodyMetricKind[]).map(metric),
      bloodPressure: this.pairBloodPressure(systolic, diastolic, sex),
      bmi: this.deriveBmi(profile?.heightCm ?? null, latest.get('WEIGHT') ?? null),
    };
  }

  /**
   * Тиск як одна картка «120/80».
   *
   * Категорія пари — за правилом ESC/ESH: якщо систола й діастола потрапляють
   * у різні категорії, береться ВИЩА. Показати окремо дві зони означало б
   * лишити людину вирішувати, яка з них головна.
   */
  private pairBloodPressure(
    systolic: { value: number; measuredAt: Date } | undefined,
    diastolic: { value: number; measuredAt: Date } | undefined,
    sex: Sex | null,
  ) {
    if (!systolic || !diastolic) return null;

    const sysBands = this.bandsFor('BP_SYSTOLIC', sex);
    const diaBands = this.bandsFor('BP_DIASTOLIC', sex);
    const sysIdx = sysBands.findIndex((b) => this.inBand(systolic.value, b));
    const diaIdx = diaBands.findIndex((b) => this.inBand(diastolic.value, b));

    // Смуги систоли й діастоли — паралельні шкали однакової довжини, тож
    // «вища категорія» = більший індекс. Порівнювати самі числа не можна:
    // 130 і 85 — та сама категорія на різних шкалах.
    const worst = Math.max(sysIdx, diaIdx);
    const zone: Zone | null =
      worst >= 0
        ? { level: sysBands[worst].level, label: sysBands[worst].label }
        : null;

    return {
      systolic: systolic.value,
      diastolic: diastolic.value,
      // Дата пари — систоли: вони пишуться одним measuredAt, і розбіжність
      // тут означала б, що запис зроблено не композитним віджетом.
      measuredAt: systolic.measuredAt,
      zone,
      unit: BODY_METRICS.BP_SYSTOLIC.unit,
      systolicBands: sysBands,
      diastolicBands: diaBands,
    };
  }

  private inBand(value: number, b: Band) {
    return (b.min === undefined || value >= b.min) && (b.max === undefined || value < b.max);
  }

  /**
   * ІМТ = вага / зріст². Похідний і НЕ зберігається: інакше вага, зріст і ІМТ
   * розходилися б між собою при кожній правці ваги.
   */
  private deriveBmi(heightCm: number | null, weight: { value: number; measuredAt: Date } | null) {
    if (!heightCm || !weight) return null;
    const m = heightCm / 100;
    const value = +(weight.value / (m * m)).toFixed(BMI_DEF.precision);
    return {
      key: BMI_DEF.key,
      unit: BMI_DEF.unit,
      precision: BMI_DEF.precision,
      value,
      // Дата — саме зважування: ІМТ не «виміряний сьогодні», він настільки ж
      // свіжий, наскільки свіжа вага, з якої порахований.
      measuredAt: weight.measuredAt,
      bands: BMI_BANDS,
      zone: computeZone(value, BMI_BANDS),
      /** UI ховає ручне введення для похідних метрик. */
      derived: true as const,
    };
  }

  /** Історія однієї метрики — для графіка. */
  async history(userId: string, kind: BodyMetricKind) {
    const def = BODY_METRICS[kind];
    if (!def) throw new BadRequestException('Невідома метрика');

    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const bands = this.bandsFor(kind, profile?.sex ?? null);

    const rows = await this.prisma.bodyMetric.findMany({
      where: { userId, kind },
      orderBy: { measuredAt: 'asc' },
    });

    return {
      kind,
      key: def.key,
      unit: def.unit,
      precision: def.precision,
      bands,
      series: rows.map((r) => ({
        id: r.id,
        value: r.value,
        measuredAt: r.measuredAt,
        note: r.note,
        zone: computeZone(r.value, bands),
      })),
    };
  }

  private assertRange(kind: BodyMetricKind, value: number) {
    const def = BODY_METRICS[kind];
    if (!Number.isFinite(value) || value < def.min || value > def.max) {
      throw new BadRequestException(
        `Значення поза допустимими межами (${def.min}–${def.max} ${def.unit})`,
      );
    }
  }

  async create(userId: string, dto: CreateBodyMetricDto) {
    if (!(dto.kind in BODY_METRICS)) throw new BadRequestException('Невідома метрика');
    // Тиск через цей маршрут не пишемо: одна половина пари без другої зробила
    // б картку «120/—», яку нічим не показати.
    if (BP_KINDS.includes(dto.kind)) {
      throw new BadRequestException('Тиск додається через POST /body/blood-pressure');
    }
    this.assertRange(dto.kind, dto.value);
    return this.prisma.bodyMetric.create({
      data: {
        userId,
        kind: dto.kind,
        value: dto.value,
        measuredAt: new Date(dto.measuredAt),
        note: dto.note,
      },
    });
  }

  /**
   * Тиск — два рядки з ОДНИМ measuredAt, в одній транзакції.
   *
   * Транзакція тут не формальність: наполовину записана пара (є систола,
   * немає діастоли) не збирається назад у картку, і полагодити її з UI нічим.
   */
  async createBloodPressure(userId: string, dto: CreateBloodPressureDto) {
    this.assertRange('BP_SYSTOLIC', dto.systolic);
    this.assertRange('BP_DIASTOLIC', dto.diastolic);
    if (dto.diastolic >= dto.systolic) {
      throw new BadRequestException('Систолічний тиск має бути вищим за діастолічний');
    }
    const measuredAt = new Date(dto.measuredAt);
    const [systolic, diastolic] = await this.prisma.$transaction([
      this.prisma.bodyMetric.create({
        data: { userId, kind: 'BP_SYSTOLIC', value: dto.systolic, measuredAt, note: dto.note },
      }),
      this.prisma.bodyMetric.create({
        data: { userId, kind: 'BP_DIASTOLIC', value: dto.diastolic, measuredAt, note: dto.note },
      }),
    ]);
    return { systolic, diastolic };
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.bodyMetric.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Запис не знайдено');
    if (row.userId !== userId) throw new ForbiddenException();

    // Видаляючи половину тиску, прибираємо й пару: «120/—» не існує як вимір.
    if (BP_KINDS.includes(row.kind)) {
      const pairKind: BodyMetricKind =
        row.kind === 'BP_SYSTOLIC' ? 'BP_DIASTOLIC' : 'BP_SYSTOLIC';
      await this.prisma.bodyMetric.deleteMany({
        where: { userId, measuredAt: row.measuredAt, kind: { in: [row.kind, pairKind] } },
      });
      return { ok: true };
    }

    await this.prisma.bodyMetric.delete({ where: { id } });
    return { ok: true };
  }

  /** Зріст живе на профілі — окремим методом, бо це не часовий ряд. */
  async setHeight(userId: string, heightCm: number | null) {
    if (heightCm != null && (heightCm < 50 || heightCm > 260)) {
      throw new BadRequestException('Зріст поза допустимими межами (50–260 см)');
    }
    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: { heightCm },
    });
    return { heightCm: profile.heightCm };
  }
}
