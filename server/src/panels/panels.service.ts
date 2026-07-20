import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pickRange } from '../biomarkers/reference.util';
import { computeZone, parseBands, type Zone } from '../biomarkers/bands';
import type { Locale } from '../i18n/locale';
import { CATEGORY_INCLUDE, localizeBiomarkerName, localizeCategory } from '../i18n/localize';
import type { ResultFlag } from '../generated/prisma/enums';

/**
 * Забори (LabPanel) — бланк цілком і порівняння двох дат.
 *
 * Модель уже існувала й наповнювалась (сід і AI-імпорт групують результати
 * одного бланка), але прочитати забір як єдине ціле було нічим: усе читання
 * йшло через окремі показники. Тут саме подача, нових обчислень мінімум —
 * прапорці, референси й зони беруться тим самим кодом, що й на дашборді.
 */
@Injectable()
export class PanelsService {
  constructor(private prisma: PrismaService) {}

  /** Стать/вік для добору референсів. Профілю може ще не бути — це не помилка. */
  private async ctx(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    return {
      sex: profile?.sex ?? undefined,
      ageYears: profile?.birthDate
        ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
        : null,
    };
  }

  /** Список заборів — дата, лабораторія, к-сть результатів. */
  async list(userId: string) {
    const panels = await this.prisma.labPanel.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      include: { _count: { select: { results: true } } },
    });
    return panels.map((p) => ({
      id: p.id,
      name: p.name,
      labName: p.labName,
      takenAt: p.takenAt,
      resultCount: p._count.results,
    }));
  }

  /** Один забір: усі результати, згруповані за категоріями. */
  async detail(userId: string, id: string, locale: Locale) {
    const panel = await this.prisma.labPanel.findUnique({
      where: { id },
      include: {
        results: {
          include: {
            biomarker: {
              include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
            },
          },
        },
      },
    });
    if (!panel) throw new NotFoundException('Забір не знайдено');
    // Забір — особисті дані, тож чужий id має давати 403, а не чужий бланк.
    if (panel.userId !== userId) throw new ForbiddenException();

    const ctx = await this.ctx(userId);
    const rows = panel.results.map((r) => this.row(r, ctx, locale));

    // Групуємо за категорією, зберігаючи порядок sortOrder з БД: бланк
    // читається зверху вниз так само, як на дашборді.
    const groups = new Map<string, { category: ReturnType<typeof localizeCategory>; items: typeof rows }>();
    for (const row of rows) {
      const key = row.biomarker.category?.slug ?? '';
      const g = groups.get(key);
      if (g) g.items.push(row);
      else groups.set(key, { category: row.biomarker.category, items: [row] });
    }

    const collator = new Intl.Collator(locale);
    return {
      panel: { id: panel.id, name: panel.name, labName: panel.labName, takenAt: panel.takenAt },
      groups: [...groups.values()].map((g) => ({
        category: g.category,
        items: g.items.sort((a, b) => collator.compare(a.biomarker.name, b.biomarker.name)),
      })),
    };
  }

  /**
   * Порівняння двох заборів пліч-о-пліч.
   *
   * Об'єднання, а не перетин: показник, зданий лише в одному з бланків, теж
   * має бути видно — «з'явився» і «зник» це така сама інформація, як зміна
   * числа, і мовчки викидати такі рядки означало б приховувати частину бланка.
   */
  async compare(userId: string, aId: string, bId: string, locale: Locale) {
    const [first, second] = await Promise.all([
      this.panelWithResults(userId, aId),
      this.panelWithResults(userId, bId),
    ]);

    // Впорядковуємо ХРОНОЛОГІЧНО, а не за порядком вибору. Список заборів
    // відсортований від найновішого, тож позначивши два верхні, людина
    // надсилала б a=новіший, b=старіший — і таблиця читалася б назад у часі:
    // Δ показувало б зростання там, де показник насправді впав. Напрямок
    // «було → стало» має задавати дата, а не те, на що клікнули першим.
    const [a, b] =
      first.takenAt <= second.takenAt ? [first, second] : [second, first];

    const ctx = await this.ctx(userId);

    const byBiomarker = new Map<
      string,
      { biomarker: (typeof a.results)[number]['biomarker']; a?: (typeof a.results)[number]; b?: (typeof a.results)[number] }
    >();
    for (const r of a.results) {
      byBiomarker.set(r.biomarkerId, { biomarker: r.biomarker, a: r });
    }
    for (const r of b.results) {
      const entry = byBiomarker.get(r.biomarkerId);
      if (entry) entry.b = r;
      else byBiomarker.set(r.biomarkerId, { biomarker: r.biomarker, b: r });
    }

    const collator = new Intl.Collator(locale);
    const rows = [...byBiomarker.values()]
      .map(({ biomarker, a: ra, b: rb }) => {
        const bands = parseBands(biomarker.bands);
        const range = pickRange(biomarker.referenceRanges, ctx);
        const side = (r?: (typeof a.results)[number]) =>
          r
            ? {
                value: r.value,
                unit: r.unit,
                flag: r.flag as ResultFlag,
                zone: computeZone(r.value, bands),
              }
            : null;
        const sa = side(ra);
        const sb = side(rb);
        return {
          biomarker: {
            slug: biomarker.slug,
            ...localizeBiomarkerName(biomarker, locale),
            unit: biomarker.unit,
            precision: biomarker.precision,
            category: localizeCategory(biomarker.category, locale),
          },
          a: sa,
          b: sb,
          // Δ лише коли є обидва значення: різниця «з нічим» — не нуль, і
          // показувати її нулем означало б збрехати про відсутній вимір.
          delta:
            sa && sb ? +(sb.value - sa.value).toFixed(biomarker.precision) : null,
          reference: range ? { low: range.low, high: range.high } : null,
        };
      })
      .sort((x, y) => collator.compare(x.biomarker.name, y.biomarker.name));

    return {
      a: { id: a.id, name: a.name, labName: a.labName, takenAt: a.takenAt },
      b: { id: b.id, name: b.name, labName: b.labName, takenAt: b.takenAt },
      rows,
    };
  }

  private async panelWithResults(userId: string, id: string) {
    const panel = await this.prisma.labPanel.findUnique({
      where: { id },
      include: {
        results: {
          include: {
            biomarker: {
              include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
            },
          },
        },
      },
    });
    if (!panel) throw new NotFoundException('Забір не знайдено');
    if (panel.userId !== userId) throw new ForbiddenException();
    return panel;
  }

  private row(
    r: {
      id: string;
      value: number;
      unit: string;
      flag: ResultFlag;
      note: string | null;
      biomarker: {
        slug: string;
        unit: string;
        precision: number;
        bands: unknown;
        canonicalName: string;
        canonicalShort: string | null;
        translations: { locale: string; name: string; shortName?: string | null }[];
        referenceRanges: Parameters<typeof pickRange>[0];
        category: Parameters<typeof localizeCategory>[0];
      };
    },
    ctx: { sex?: 'MALE' | 'FEMALE' | 'ANY'; ageYears: number | null },
    locale: Locale,
  ) {
    const range = pickRange(r.biomarker.referenceRanges, ctx);
    const zone: Zone | null = computeZone(r.value, parseBands(r.biomarker.bands));
    return {
      id: r.id,
      value: r.value,
      unit: r.unit,
      flag: r.flag,
      zone,
      note: r.note,
      biomarker: {
        slug: r.biomarker.slug,
        ...localizeBiomarkerName(r.biomarker, locale),
        unit: r.biomarker.unit,
        precision: r.biomarker.precision,
        category: localizeCategory(r.biomarker.category, locale),
      },
      reference: range ? { low: range.low, high: range.high } : null,
    };
  }
}
