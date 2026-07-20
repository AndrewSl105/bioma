import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isIntakeActive } from '../intakes/intakes.service';
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
import { allowedUnits } from './unit-conversions';
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
  const withUnits = rest as typeof rest & { slug?: string; unit?: string };
  return {
    ...rest,
    ...localizeBiomarkerName(b, locale),
    // Категорія — об'єкт, а не рядок: клієнту потрібні ще slug і картинка.
    category: localizeCategory(category, locale),
    // Одиниці, які можна обрати у формі. Канон завжди перший. Список рахує
    // сервер: реєстр конверсій живе тут, і дублювати його на клієнті означало
    // б дати формі пропонувати одиниці, які бекенд не вміє перерахувати.
    units:
      withUnits.slug && withUnits.unit ? allowedUnits(withUnits.slug, withUnits.unit) : undefined,
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

  /**
   * Особистий інтервал перездачі. null прибирає його — тоді діє типовий
   * інтервал показника, а якщо й того немає, нагадування просто зникає.
   *
   * Пише лише в рядок ЦЬОГО користувача: періодичність — його справа, і
   * чужий UserBiomarker сюди не потрапляє за побудовою складеного ключа.
   */
  async setRetestInterval(userId: string, slug: string, days: number | null) {
    const biomarker = await this.findSelectable(userId, slug);
    await this.prisma.userBiomarker.upsert({
      where: { userId_biomarkerId: { userId, biomarkerId: biomarker.id } },
      update: { retestIntervalDays: days },
      // Показник міг бути ще не обраний — тоді налаштування інтервалу і є
      // вибором: людина явно сказала, що хоче за ним стежити.
      create: { userId, biomarkerId: biomarker.id, retestIntervalDays: days },
    });
    return { slug: biomarker.slug, retestIntervalDays: days };
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
    const content =
      pickContent(biomarker.content, locale) ??
      pickContent(biomarker.content, CANONICAL_LOCALE) ??
      null;
    if (!content) return null;

    // Прийоми користувача, клас яких згаданий у affectedByDrugClasses цього
    // показника. Співставлення за КЛЮЧАМИ, а не за прозою drugClassesInfo:
    // шукати клас регулярками в тексті означало б ставити плашку в залежність
    // від формулювання, і переклад її ламав би.
    const classes = content.affectedByDrugClasses ?? [];
    const matchedIntakes = classes.length
      ? (
          await this.prisma.userIntake.findMany({
            where: { userId, drugClassKey: { in: classes } },
            select: {
              id: true,
              name: true,
              type: true,
              drugClassKey: true,
              startDate: true,
              endDate: true,
            },
          })
        )
          // Лише те, що людина приймає ЗАРАЗ: плашка про давно скасований
          // препарат була б не контекстом, а шумом.
          .filter(isIntakeActive)
          .map(({ id, name, type, drugClassKey }) => ({ id, name, type, drugClassKey }))
      : [];

    return { ...content, matchedIntakes };
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
  return {
    overview: dto.overview,
    whatItMeasures: dto.whatItMeasures,
    roleInBody: dto.roleInBody,
    relatedSystems: dto.relatedSystems,
    functionalLinks: dto.functionalLinks,
    relatedSystemKeys: dto.relatedSystemKeys,
    functionalTagKeys: dto.functionalTagKeys,
    lowMeaning: dto.lowMeaning,
    highMeaning: dto.highMeaning,
    influencingFactors: dto.influencingFactors,
    preparation: dto.preparation,
    commonlyEvaluatedWith: dto.commonlyEvaluatedWith,
    confirmatoryTests: dto.confirmatoryTests,
    foodSources: dto.foodSources,
    supplementsInfo: dto.supplementsInfo,
    drugClassesInfo: dto.drugClassesInfo,
    // Єдине, що лишилось Json: у джерел є структура {title, url?}, і масив
    // рядків її не вміщає.
    medicalSources: dto.medicalSources as Prisma.InputJsonValue | undefined,
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
  relatedSystems: string | null;
  functionalLinks: string | null;
  relatedSystemKeys: string[];
  functionalTagKeys: string[];
  affectedByDrugClasses: string[];
  lowMeaning: string | null;
  highMeaning: string | null;
  influencingFactors: string | null;
  preparation: string | null;
  commonlyEvaluatedWith: string[];
  confirmatoryTests: string[];
  foodSources: string | null;
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

/**
 * Рядок БД → відповідь клієнту. Текстові поля віддаємо як є; масиви slug'ів
 * тепер типізовані самою БД. Json лишився тільки в джерелах, тож саме їх і
 * доводиться перевіряти на форму.
 */
function toContentDto(c: ContentRow) {
  const sources = Array.isArray(c.medicalSources)
    ? (c.medicalSources as { title: string; url?: string }[])
    : [];
  return {
    locale: c.locale,
    overview: c.overview,
    whatItMeasures: c.whatItMeasures,
    roleInBody: c.roleInBody,
    relatedSystems: c.relatedSystems,
    functionalLinks: c.functionalLinks,
    relatedSystemKeys: c.relatedSystemKeys,
    functionalTagKeys: c.functionalTagKeys,
    affectedByDrugClasses: c.affectedByDrugClasses,
    lowMeaning: c.lowMeaning,
    highMeaning: c.highMeaning,
    influencingFactors: c.influencingFactors,
    preparation: c.preparation,
    commonlyEvaluatedWith: c.commonlyEvaluatedWith,
    confirmatoryTests: c.confirmatoryTests,
    foodSources: c.foodSources,
    supplementsInfo: c.supplementsInfo,
    drugClassesInfo: c.drugClassesInfo,
    medicalSources: sources,
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
