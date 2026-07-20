import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ResultSource, Sex } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import { computeZone, parseBands } from '../biomarkers/bands';
import { computeRetest } from './retest';
import { normalizeUnit } from '../biomarkers/unit-conversions';
import { CreateResultDto } from './dto/create-result.dto';
import type { CategoryDto } from '../r2/r2.url';
import type { Locale } from '../i18n/locale';
import { CATEGORY_INCLUDE, localizeBiomarkerName, localizeCategory } from '../i18n/localize';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  /** Історія одного показника + серія для графіка + активний референс. */
  async history(userId: string, biomarkerSlug: string, locale: Locale) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug: biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
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

    // Смуги розбираємо один раз на весь ряд: computeZone викликається на кожну
    // точку, і парсити Json усередині map означало б робити це N разів.
    const bands = parseBands(biomarker.bands);

    const series = results.map((r) => ({
      id: r.id,
      value: r.value,
      unit: r.unit,
      measuredAt: r.measuredAt,
      flag: r.flag,
      // Зона на кожній точці, а не лише на останній: історія й графік
      // підписують нею попередні виміри так само, як картка — поточний.
      zone: computeZone(r.value, bands),
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
        // Раніше тут віддавався англійський канон — сторінка показника
        // ігнорувала переклади, хоча каталог їх застосовував.
        ...localizeBiomarkerName(biomarker, locale),
        unit: biomarker.unit,
        category: localizeCategory(biomarker.category, locale),
        precision: biomarker.precision,
      },
      // Повний масив смуг потрібен графіку, щоб намалювати кольорові зони;
      // самої зони останнього значення для цього не досить.
      bands,
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
  async overview(userId: string, locale: Locale) {
    // Профілю може ще не бути (перший вхід не завершився) — тоді стать/вік
    // невідомі, і референси добираються best-effort, без падіння.
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ageYears = profile?.birthDate
      ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
      : null;

    const selected = await this.prisma.userBiomarker.findMany({
      where: { userId },
      include: {
        biomarker: {
          include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
        },
      },
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

    const cards = selected.map(({ biomarker, biomarkerId, retestIntervalDays }) => {
      const latest = latestByBiomarker.get(biomarkerId) ?? null;
      const range = pickRange(biomarker.referenceRanges, {
        sex: profile?.sex ?? undefined,
        ageYears,
      });
      const bands = parseBands(biomarker.bands);
      return {
        biomarker: {
          slug: biomarker.slug,
          // Дашборд теж віддавав англійський канон — локалізація до нього
          // просто не доходила.
          ...localizeBiomarkerName(biomarker, locale),
          category: localizeCategory(biomarker.category, locale) as CategoryDto | null,
          unit: biomarker.unit,
          precision: biomarker.precision,
        },
        latest: latest
          ? {
              value: latest.value,
              unit: latest.unit,
              measuredAt: latest.measuredAt,
              flag: latest.flag,
              // Бейдж картки підписується зоною («достатній»), а не лише
              // «в нормі / поза нормою» — заради цього напрям і робиться.
              zone: computeZone(latest.value, bands),
            }
          : null,
        // Дашборд віддавав самі low/high, тож оптимум до картки не доходив,
        // хоча в ReferenceRange він уже лежав.
        reference: range
          ? {
              low: range.low,
              high: range.high,
              optimalLow: range.optimalLow,
              optimalHigh: range.optimalHigh,
            }
          : null,
        // Самі смуги дашборду не потрібні — графіка тут немає, а картці досить
        // обчисленої зони. Возити їх на кожну картку означало б роздувати і
        // відповідь, і persist-кеш заради даних, які ніхто не читає.
        retest: computeRetest(
          latest?.measuredAt ?? null,
          retestIntervalDays,
          biomarker.defaultRetestDays,
        ),
        count: countByBiomarker.get(biomarkerId) ?? 0,
      };
    });

    // Порядок категорій із БД (sortOrder адміна) зберігаємо, а всередині
    // категорії впорядковуємо за локалізованою назвою — інакше україномовний
    // дашборд відсортований за англійським каноном, тобто на вигляд ніяк.
    const collator = new Intl.Collator(locale);
    const groups = new Map<string, typeof cards>();
    for (const card of cards) {
      const key = card.biomarker.category?.slug ?? '';
      const group = groups.get(key);
      if (group) group.push(card);
      else groups.set(key, [card]);
    }
    return [...groups.values()].flatMap((group) =>
      group.sort((a, b) => collator.compare(a.biomarker.name, b.biomarker.name)),
    );
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

    // Приводимо до канонічної одиниці ПЕРЕД прапорцем: референси задані в
    // каноні, і порівнювати з ними мг/дл означало б рахувати прапорець у
    // чужій системі числення — тихо і завжди неправильно.
    const norm = normalizeUnit(biomarker.slug, dto.value, dto.unit, biomarker.unit);
    const flag = computeFlag(norm.value, range ?? undefined);

    const [result] = await this.prisma.$transaction([
      this.prisma.labResult.create({
        data: {
          userId,
          biomarkerId: biomarker.id,
          value: norm.value,
          unit: norm.unit,
          enteredValue: norm.enteredValue,
          enteredUnit: norm.enteredUnit,
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
