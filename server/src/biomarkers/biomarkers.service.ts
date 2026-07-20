import { Injectable, NotFoundException } from '@nestjs/common';
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

  /** Каталог: глобальні + власні біомаркери користувача. */
  async list(userId: string) {
    const rows = await this.prisma.biomarker.findMany({
      // Неактивні маркери зникають із каталогу, але наявні результати за
      // ними лишаються — деактивація не є видаленням історії.
      where: { isActive: true, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true, category: true },
      // Категорії — за sortOrder (порядок задає адміністратор), маркери
      // всередині — за канонічною назвою. Маркери без категорії — в кінці.
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { category: { name: 'asc' } },
        { canonicalName: 'asc' },
      ],
    });
    return rows.map(toDto);
  }

  async findBySlug(userId: string, slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true, category: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return toDto(biomarker);
  }

  /** Створення власного біомаркера (напр. рідкісний показник). */
  async createCustom(
    userId: string,
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
    // Власний біомаркер користувач називає своєю мовою — перекладів у нього
    // немає, тож toDto віддасть цю ж назву через відкат на канон.
    const created = await this.prisma.biomarker.create({
      data: {
        ownerId: userId,
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
