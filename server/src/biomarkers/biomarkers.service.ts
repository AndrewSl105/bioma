import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Sex } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toCategoryDto, type CategoryDto } from '../r2/r2.url';

/** Локаль інтерфейсу — якою назвою віддавати біомаркер клієнту. */
const UI_LOCALE = 'uk';

type CategoryRelation = { id: string; slug: string; name: string; imageKey: string | null } | null;

type WithTranslations = {
  canonicalName: string;
  canonicalShort: string | null;
  translations: { locale: string; name: string; shortName: string | null }[];
  category?: CategoryRelation;
};

/**
 * У БД канон англійський, а клієнт очікує поля name/shortName рідною мовою.
 * Тому назви підмінюємо перекладом UI_LOCALE, з відкатом на канон.
 */
function toDto<T extends WithTranslations>(b: T) {
  const t = b.translations.find((x) => x.locale === UI_LOCALE);
  const { translations, category, ...rest } = b;
  return {
    ...rest,
    name: t?.name ?? b.canonicalName,
    shortName: t?.shortName ?? b.canonicalShort,
    // Категорія — об'єкт, а не рядок: клієнту потрібні ще slug і картинка.
    category: toCategoryDto(category) as CategoryDto | null,
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
  async list(userId: string) {
    const rows = await this.prisma.biomarker.findMany({
      // Неактивні маркери зникають із каталогу, але наявні результати за
      // ними лишаються — деактивація не є видаленням історії.
      where: { isActive: true, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: {
        referenceRanges: true,
        translations: true,
        category: true,
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
    return rows.map(({ selectedBy, ...b }) => ({
      ...toDto(b),
      selected: selectedBy.length > 0,
    }));
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

  async findBySlug(userId: string, slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true, category: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return toDto(biomarker);
  }

  /**
   * Заведення показника в системний каталог. Доступно лише адміністратору:
   * користувач маркери не створює, а обирає зі списку (див. select).
   * Маркер одразу стає спільним — ownerId порожній, isSystem true.
   */
  async createSystem(
    adminUserId: string,
    data: {
      name: string;
      unit: string;
      shortName?: string;
      categoryId?: string;
      precision?: number;
      referenceLow?: number;
      referenceHigh?: number;
    },
  ) {
    const slug = slugify(data.name);
    const duplicate = await this.prisma.biomarker.findFirst({
      where: { ownerId: null, slug },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Показник із такою назвою вже є в каталозі');

    // Адмін вводить назву своєю мовою — перекладів у неї ще немає, тож toDto
    // віддасть цю ж назву через відкат на канон.
    const created = await this.prisma.biomarker.create({
      data: {
        ownerId: null,
        isSystem: true,
        createdBy: adminUserId,
        slug,
        canonicalName: data.name,
        canonicalShort: data.shortName,
        unit: data.unit,
        categoryId: data.categoryId ?? null,
        precision: data.precision ?? 2,
        referenceRanges:
          data.referenceLow != null || data.referenceHigh != null
            ? {
                create: {
                  low: data.referenceLow ?? null,
                  high: data.referenceHigh ?? null,
                  unit: data.unit,
                  sex: Sex.ANY,
                },
              }
            : undefined,
      },
      include: { referenceRanges: true, translations: true, category: true },
    });
    return toDto(created);
  }
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
