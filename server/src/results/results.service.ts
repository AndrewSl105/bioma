import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ResultSource, Sex } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import { CreateResultDto } from './dto/create-result.dto';
import { toCategoryDto, type CategoryDto } from '../r2/r2.url';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  /** Історія одного показника + серія для графіка + активний референс. */
  async history(userId: string, biomarkerSlug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug: biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, category: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    // Профілю може ще не бути (перший вхід не завершився) — тоді стать/вік
    // невідомі, і референси добираються best-effort, без падіння.
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ageYears = profile?.birthDate
      ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
      : null;

    const range = pickRange(biomarker.referenceRanges, {
      sex: profile?.sex ?? undefined,
      ageYears,
    });

    const results = await this.prisma.labResult.findMany({
      where: { userId, biomarkerId: biomarker.id },
      orderBy: { measuredAt: 'asc' },
    });

    const series = results.map((r) => ({
      id: r.id,
      value: r.value,
      unit: r.unit,
      measuredAt: r.measuredAt,
      flag: r.flag,
      source: r.source,
      note: r.note,
    }));

    const latest = series.at(-1) ?? null;
    const previous = series.at(-2) ?? null;
    const trend =
      latest && previous ? +(latest.value - previous.value).toFixed(biomarker.precision) : null;

    return {
      biomarker: {
        slug: biomarker.slug,
        name: biomarker.canonicalName,
        shortName: biomarker.canonicalShort,
        unit: biomarker.unit,
        category: toCategoryDto(biomarker.category),
        precision: biomarker.precision,
      },
      reference: range
        ? {
            low: range.low,
            high: range.high,
            optimalLow: range.optimalLow,
            optimalHigh: range.optimalHigh,
            unit: range.unit,
            source: range.source,
          }
        : null,
      latest,
      trend,
      series,
    };
  }

  /**
   * Дашборд — показники, які користувач обрав відстежувати.
   *
   * Джерело карток саме вибір, а не результати: обраний показник видно одразу,
   * ще до першого аналізу (latest === null), тож людина бачить, що саме вона
   * веде. Новий користувач нічого не обрав — дашборд порожній, поки він не
   * додасть щось зі списку.
   */
  async overview(userId: string) {
    // Профілю може ще не бути (перший вхід не завершився) — тоді стать/вік
    // невідомі, і референси добираються best-effort, без падіння.
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ageYears = profile?.birthDate
      ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
      : null;

    const selected = await this.prisma.userBiomarker.findMany({
      where: { userId },
      include: { biomarker: { include: { referenceRanges: true, category: true } } },
      // Порядок від категорії, а не від дати виміру: показники без результатів
      // дати не мають, і сортувати весь дашборд за нею більше не можна.
      orderBy: [
        { biomarker: { category: { sortOrder: 'asc' } } },
        { biomarker: { category: { name: 'asc' } } },
        { biomarker: { canonicalName: 'asc' } },
      ],
    });
    if (!selected.length) return [];

    // Усі результати обраних показників одним запитом: по одному запиту на
    // картку дашборд перетворився б на N+1.
    const results = await this.prisma.labResult.findMany({
      where: { userId, biomarkerId: { in: selected.map((s) => s.biomarkerId) } },
      orderBy: { measuredAt: 'desc' },
    });

    const latestByBiomarker = new Map<string, (typeof results)[number]>();
    const countByBiomarker = new Map<string, number>();
    for (const r of results) {
      // results відсортовані за спаданням дати, тож перший побачений — останній.
      if (!latestByBiomarker.has(r.biomarkerId)) latestByBiomarker.set(r.biomarkerId, r);
      countByBiomarker.set(r.biomarkerId, (countByBiomarker.get(r.biomarkerId) ?? 0) + 1);
    }

    return selected.map(({ biomarker, biomarkerId }) => {
      const latest = latestByBiomarker.get(biomarkerId) ?? null;
      const range = pickRange(biomarker.referenceRanges, {
        sex: profile?.sex ?? undefined,
        ageYears,
      });
      return {
        biomarker: {
          slug: biomarker.slug,
          name: biomarker.canonicalName,
          shortName: biomarker.canonicalShort,
          category: toCategoryDto(biomarker.category) as CategoryDto | null,
          unit: biomarker.unit,
          precision: biomarker.precision,
        },
        latest: latest
          ? { value: latest.value, unit: latest.unit, measuredAt: latest.measuredAt, flag: latest.flag }
          : null,
        reference: range ? { low: range.low, high: range.high } : null,
        count: countByBiomarker.get(biomarkerId) ?? 0,
      };
    });
  }

  async create(userId: string, dto: CreateResultDto, source: ResultSource = ResultSource.MANUAL) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug: dto.biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    // Профілю може ще не бути (перший вхід не завершився) — тоді стать/вік
    // невідомі, і референси добираються best-effort, без падіння.
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ageYears = profile?.birthDate
      ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
      : null;
    const range = pickRange(biomarker.referenceRanges, {
      sex: profile?.sex ?? undefined,
      ageYears,
    });
    const flag = computeFlag(dto.value, range ?? undefined);

    const [result] = await this.prisma.$transaction([
      this.prisma.labResult.create({
        data: {
          userId,
          biomarkerId: biomarker.id,
          value: dto.value,
          unit: dto.unit ?? biomarker.unit,
          measuredAt: new Date(dto.measuredAt),
          note: dto.note,
          flag,
          source,
        },
      }),
      // Дашборд показує обрані показники, тож внесене значення по необраному
      // маркеру просто не було б видно. Записав результат — показник обрано.
      this.prisma.userBiomarker.upsert({
        where: { userId_biomarkerId: { userId, biomarkerId: biomarker.id } },
        update: {},
        create: { userId, biomarkerId: biomarker.id },
      }),
    ]);
    return result;
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.labResult.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('Результат не знайдено');
    if (result.userId !== userId) throw new ForbiddenException();
    await this.prisma.labResult.delete({ where: { id } });
    return { ok: true };
  }
}
