import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Sex } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Locale } from '../i18n/locale';
import { CANONICAL_LOCALE } from '../i18n/locale';
import {
  CATEGORY_INCLUDE,
  localizeBiomarkerName,
  localizeCategory,
  type LocalizableBiomarker,
  type LocalizableCategory,
} from '../i18n/localize';
import type { BiomarkerContentDto } from './dto/biomarker-content.dto';
import type {
  CreateBiomarkerDto,
  ReferenceRangeDto,
  UpdateBiomarkerDto,
} from './dto/biomarker.dto';

type WithTranslations = LocalizableBiomarker & { category?: LocalizableCategory | null };

/** Біомаркер у вигляді для клієнта: назви й категорія — обраною мовою. */
function toDto<T extends WithTranslations>(b: T, locale: Locale) {
  const { translations, category, ...rest } = b;
  return {
    ...rest,
    ...localizeBiomarkerName(b, locale),
    // Категорія — об'єкт, а не рядок: клієнту потрібні ще slug і картинка.
    category: localizeCategory(category, locale),
  };
}

@Injectable()
export class BiomarkersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Системний каталог — те, з чого користувач обирає показники собі на дашборд.
   * Історичні власні маркери теж показуємо: їх більше не створити, але ховати
   * те, за чим у людини вже є аналізи, не можна.
   *
   * selected каже, чи показник уже на дашборді, — щоб список у діалозі вибору
   * не пропонував додати те, що вже додано.
   */
  async list(userId: string, locale: Locale) {
    const rows = await this.prisma.biomarker.findMany({
      // Неактивні маркери зникають із каталогу, але наявні результати за
      // ними лишаються — деактивація не є видаленням історії.
      where: { isActive: true, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: {
        referenceRanges: true,
        translations: true,
        category: CATEGORY_INCLUDE,
        selectedBy: { where: { userId }, select: { userId: true } },
      },
      // Категорії — за sortOrder (порядок задає адміністратор), маркери
      // всередині — за канонічною назвою. Маркери без категорії — в кінці.
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { category: { name: 'asc' } },
        { canonicalName: 'asc' },
      ],
    });
    const dtos = rows.map(({ selectedBy, ...b }) => ({
      ...toDto(b, locale),
      selected: selectedBy.length > 0,
    }));

    // Порядок категорій задає адміністратор (sortOrder) — він приходить із БД і
    // зберігається порядком груп. А всередині категорії сортуємо за
    // ЛОКАЛІЗОВАНОЮ назвою: сортування за англійським каноном виглядало для
    // україномовного списку випадковим.
    const collator = new Intl.Collator(locale);
    const groups = new Map<string, typeof dtos>();
    for (const dto of dtos) {
      const key = dto.category?.slug ?? '';
      const group = groups.get(key);
      if (group) group.push(dto);
      else groups.set(key, [dto]);
    }
    return [...groups.values()].flatMap((group) =>
      group.sort((a, b) => collator.compare(a.name, b.name)),
    );
  }

  /** Додає показник на дашборд користувача. Ідемпотентно. */
  async select(userId: string, slug: string) {
    const biomarker = await this.findSelectable(userId, slug);
    await this.prisma.userBiomarker.upsert({
      where: { userId_biomarkerId: { userId, biomarkerId: biomarker.id } },
      update: {},
      create: { userId, biomarkerId: biomarker.id },
    });
    return { ok: true, slug: biomarker.slug };
  }

  /**
   * Прибирає показник із дашборда. Результати лишаються в базі: це приховування
   * картки, а не видалення історії аналізів — повернувши показник, людина
   * побачить усі свої старі значення.
   */
  async deselect(userId: string, slug: string) {
    const biomarker = await this.findSelectable(userId, slug);
    await this.prisma.userBiomarker.deleteMany({
      where: { userId, biomarkerId: biomarker.id },
    });
    return { ok: true, slug: biomarker.slug };
  }

  private async findSelectable(userId: string, slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, isActive: true, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true, slug: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return biomarker;
  }

  async findBySlug(userId: string, slug: string, locale: Locale) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return toDto(biomarker, locale);
  }

  /**
   * Довідковий контент показника обраною мовою, з відкатом на канон.
   * Пусто — не помилка: контент наповнюється поступово.
   */
  async findContent(userId: string, slug: string, locale: Locale) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { content: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return (
      pickContent(biomarker.content, locale) ??
      pickContent(biomarker.content, CANONICAL_LOCALE) ??
      null
    );
  }

  /** Усі локалі контенту — для форми редагування в адмінці. */
  async listContent(slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug },
      include: { content: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return biomarker.content.map(toContentDto);
  }

  /** Upsert контенту для однієї локалі. */
  async upsertContent(
    slug: string,
    locale: string,
    dto: BiomarkerContentDto,
    adminUserId: string,
  ) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    const data = contentData(dto, adminUserId);
    const saved = await this.prisma.biomarkerContent.upsert({
      where: { biomarkerId_locale: { biomarkerId: biomarker.id, locale } },
      update: data,
      create: { biomarkerId: biomarker.id, locale, ...data },
    });
    return toContentDto(saved);
  }

  /**
   * Повний список для адмінки: разом із неактивними, перекладами, діапазонами
   * й переліком локалей, для яких уже є контент. Окремо від користувацького
   * list(), бо той свідомо ховає неактивне.
   */
  async adminList(locale: Locale) {
    const rows = await this.prisma.biomarker.findMany({
      where: { ownerId: null },
      include: {
        referenceRanges: true,
        translations: true,
        category: CATEGORY_INCLUDE,
        content: { select: { locale: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { canonicalName: 'asc' }],
    });

    return rows.map(({ content, ...b }) => ({
      ...toDto(b, locale),
      // Канон віддаємо явно: у формі редагування адмін бачить і англійський
      // оригінал, і переклади, а toDto підмінив би name локалізованим.
      canonicalName: b.canonicalName,
      canonicalShort: b.canonicalShort,
      translations: b.translations.map((t) => ({
        locale: t.locale,
        name: t.name,
        shortName: t.shortName,
      })),
      contentLocales: content.map((c) => c.locale),
    }));
  }

  /**
   * Заведення показника в системний каталог. Доступно лише адміністратору:
   * користувач маркери не створює, а обирає зі списку (див. select).
   * Маркер одразу стає спільним — ownerId порожній, isSystem true.
   */
  async createSystem(adminUserId: string, locale: Locale, dto: CreateBiomarkerDto) {
    const slug = slugify(dto.name);
    if (!slug) throw new ConflictException('Не вдалося побудувати slug із назви');

    const duplicate = await this.prisma.biomarker.findFirst({
      where: { ownerId: null, slug },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Показник із такою назвою вже є в каталозі');

    const created = await this.prisma.biomarker.create({
      data: {
        ownerId: null,
        isSystem: true,
        createdBy: adminUserId,
        slug,
        canonicalName: dto.name,
        canonicalShort: dto.shortName ?? null,
        unit: dto.unit,
        categoryId: dto.categoryId ?? null,
        precision: dto.precision ?? 2,
        loincCode: dto.loincCode ?? null,
        translations: dto.translations?.length
          ? {
              create: dto.translations.map((t) => ({
                locale: t.locale,
                name: t.name,
                shortName: t.shortName ?? null,
              })),
            }
          : undefined,
        referenceRanges: dto.referenceRanges?.length
          ? { create: dto.referenceRanges.map((r) => rangeData(r, dto.unit)) }
          : undefined,
        content: dto.content?.length
          ? {
              create: dto.content.map(({ locale: l, ...c }) => ({
                locale: l,
                ...contentData(c, adminUserId),
              })),
            }
          : undefined,
      },
      include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
    });
    return toDto(created, locale);
  }

  /** Редагування показника адміністратором. */
  async update(slug: string, dto: UpdateBiomarkerDto, locale: Locale) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { ownerId: null, slug },
      select: { id: true, unit: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');

    await this.prisma.biomarker.update({
      where: { id: biomarker.id },
      data: {
        ...(dto.name !== undefined ? { canonicalName: dto.name } : {}),
        ...(dto.shortName !== undefined ? { canonicalShort: dto.shortName } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.precision !== undefined ? { precision: dto.precision } : {}),
        ...(dto.loincCode !== undefined ? { loincCode: dto.loincCode } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    for (const t of dto.translations ?? []) {
      await this.prisma.biomarkerTranslation.upsert({
        where: { biomarkerId_locale: { biomarkerId: biomarker.id, locale: t.locale } },
        update: { name: t.name, shortName: t.shortName ?? null },
        create: {
          biomarkerId: biomarker.id,
          locale: t.locale,
          name: t.name,
          shortName: t.shortName ?? null,
        },
      });
    }

    // Діапазони замінюємо повністю (див. коментар у DTO). Транзакція — щоб
    // маркер ніколи не лишився взагалі без референсів через збій на середині.
    if (dto.referenceRanges) {
      const unit = dto.unit ?? biomarker.unit;
      await this.prisma.$transaction([
        this.prisma.referenceRange.deleteMany({ where: { biomarkerId: biomarker.id } }),
        ...dto.referenceRanges.map((r) =>
          this.prisma.referenceRange.create({
            data: { biomarkerId: biomarker.id, ...rangeData(r, unit) },
          }),
        ),
      ]);
    }

    const fresh = await this.prisma.biomarker.findUniqueOrThrow({
      where: { id: biomarker.id },
      include: { referenceRanges: true, translations: true, category: CATEGORY_INCLUDE },
    });
    return toDto(fresh, locale);
  }
}

/** Референс без id: спільне для створення й заміни. */
function rangeData(r: ReferenceRangeDto, unit: string) {
  return {
    low: r.low ?? null,
    high: r.high ?? null,
    optimalLow: r.optimalLow ?? null,
    optimalHigh: r.optimalHigh ?? null,
    unit,
    sex: r.sex ?? Sex.ANY,
    ageMinYears: r.ageMinYears ?? null,
    ageMaxYears: r.ageMaxYears ?? null,
    source: r.source ?? null,
  };
}

/**
 * DTO → колонки. Списки лягають у Json, тож undefined і null тут різні речі:
 * undefined лишає поле недоторканим при update, null свідомо його очищає.
 */
function contentData(dto: BiomarkerContentDto, reviewedBy: string) {
  const json = (v: unknown[] | undefined) =>
    v === undefined ? undefined : (v as Prisma.InputJsonValue);
  return {
    overview: dto.overview,
    whatItMeasures: dto.whatItMeasures,
    roleInBody: dto.roleInBody,
    relatedSystems: json(dto.relatedSystems),
    functionalLinks: dto.functionalLinks,
    lowMeaning: dto.lowMeaning,
    highMeaning: dto.highMeaning,
    influencingFactors: json(dto.influencingFactors),
    preparation: dto.preparation,
    commonlyEvaluatedWith: json(dto.commonlyEvaluatedWith),
    confirmatoryTests: json(dto.confirmatoryTests),
    foodSources: json(dto.foodSources),
    supplementsInfo: dto.supplementsInfo,
    drugClassesInfo: dto.drugClassesInfo,
    medicalSources: json(dto.medicalSources),
    // Дата перевірки — момент збереження, якщо адмін не вказав свою: контент
    // без неї не можна відрізнити від давно не переглянутого.
    lastReviewedAt: dto.lastReviewedAt ? new Date(dto.lastReviewedAt) : new Date(),
    reviewedBy: dto.reviewedBy ?? reviewedBy,
  };
}

type ContentRow = {
  locale: string;
  overview: string | null;
  whatItMeasures: string | null;
  roleInBody: string | null;
  relatedSystems: unknown;
  functionalLinks: string | null;
  lowMeaning: string | null;
  highMeaning: string | null;
  influencingFactors: unknown;
  preparation: string | null;
  commonlyEvaluatedWith: unknown;
  confirmatoryTests: unknown;
  foodSources: unknown;
  supplementsInfo: string | null;
  drugClassesInfo: string | null;
  medicalSources: unknown;
  lastReviewedAt: Date | null;
  reviewedBy: string | null;
};

function pickContent(rows: ContentRow[], locale: string) {
  const row = rows.find((c) => c.locale === locale);
  return row ? toContentDto(row) : null;
}

/** Json-колонки віддаємо клієнту вже масивами, а не сирим unknown. */
function toContentDto(c: ContentRow) {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    locale: c.locale,
    overview: c.overview,
    whatItMeasures: c.whatItMeasures,
    roleInBody: c.roleInBody,
    relatedSystems: arr<string>(c.relatedSystems),
    functionalLinks: c.functionalLinks,
    lowMeaning: c.lowMeaning,
    highMeaning: c.highMeaning,
    influencingFactors: arr<string>(c.influencingFactors),
    preparation: c.preparation,
    commonlyEvaluatedWith: arr<string>(c.commonlyEvaluatedWith),
    confirmatoryTests: arr<string>(c.confirmatoryTests),
    foodSources: arr<string>(c.foodSources),
    supplementsInfo: c.supplementsInfo,
    drugClassesInfo: c.drugClassesInfo,
    medicalSources: arr<{ title: string; url: string }>(c.medicalSources),
    lastReviewedAt: c.lastReviewedAt,
    reviewedBy: c.reviewedBy,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
