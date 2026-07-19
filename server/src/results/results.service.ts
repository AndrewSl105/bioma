import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ResultSource, Sex } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import { CreateResultDto } from './dto/create-result.dto';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  /** Історія одного показника + серія для графіка + активний референс. */
  async history(userId: string, biomarkerSlug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug: biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ageYears = user?.birthDate
      ? Math.floor((Date.now() - user.birthDate.getTime()) / 31557600000)
      : null;

    const range = pickRange(biomarker.referenceRanges, {
      sex: user?.sex ?? undefined,
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
        name: biomarker.name,
        shortName: biomarker.shortName,
        unit: biomarker.unit,
        category: biomarker.category,
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

  /** Останнє значення по кожному показнику (для дашборда). */
  async overview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ageYears = user?.birthDate
      ? Math.floor((Date.now() - user.birthDate.getTime()) / 31557600000)
      : null;

    const results = await this.prisma.labResult.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      include: { biomarker: { include: { referenceRanges: true } } },
    });

    const seen = new Set<string>();
    const cards: Array<{
      biomarker: {
        slug: string;
        name: string;
        shortName: string | null;
        category: string | null;
        unit: string;
        precision: number;
      };
      latest: { value: number; unit: string; measuredAt: Date; flag: string };
      reference: { low: number | null; high: number | null } | null;
      count: number;
    }> = [];
    for (const r of results) {
      if (seen.has(r.biomarkerId)) continue;
      seen.add(r.biomarkerId);
      const range = pickRange(r.biomarker.referenceRanges, {
        sex: user?.sex ?? undefined,
        ageYears,
      });
      cards.push({
        biomarker: {
          slug: r.biomarker.slug,
          name: r.biomarker.name,
          shortName: r.biomarker.shortName,
          category: r.biomarker.category,
          unit: r.biomarker.unit,
          precision: r.biomarker.precision,
        },
        latest: { value: r.value, unit: r.unit, measuredAt: r.measuredAt, flag: r.flag },
        reference: range ? { low: range.low, high: range.high } : null,
        count: results.filter((x) => x.biomarkerId === r.biomarkerId).length,
      });
    }
    return cards;
  }

  async create(userId: string, dto: CreateResultDto, source: ResultSource = ResultSource.MANUAL) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug: dto.biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ageYears = user?.birthDate
      ? Math.floor((Date.now() - user.birthDate.getTime()) / 31557600000)
      : null;
    const range = pickRange(biomarker.referenceRanges, {
      sex: user?.sex ?? undefined,
      ageYears,
    });
    const flag = computeFlag(dto.value, range ?? undefined);

    return this.prisma.labResult.create({
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
    });
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.labResult.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('Результат не знайдено');
    if (result.userId !== userId) throw new ForbiddenException();
    await this.prisma.labResult.delete({ where: { id } });
    return { ok: true };
  }
}
