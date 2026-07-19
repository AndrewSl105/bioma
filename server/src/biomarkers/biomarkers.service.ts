import { Injectable, NotFoundException } from '@nestjs/common';
import { Sex } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Локаль інтерфейсу — якою назвою віддавати біомаркер клієнту. */
const UI_LOCALE = 'uk';

type WithTranslations = {
  canonicalName: string;
  canonicalShort: string | null;
  translations: { locale: string; name: string; shortName: string | null }[];
};

/**
 * У БД канон англійський, а клієнт очікує поля name/shortName рідною мовою.
 * Тому назви підмінюємо перекладом UI_LOCALE, з відкатом на канон.
 */
function toDto<T extends WithTranslations>(b: T) {
  const t = b.translations.find((x) => x.locale === UI_LOCALE);
  const { translations, ...rest } = b;
  return {
    ...rest,
    name: t?.name ?? b.canonicalName,
    shortName: t?.shortName ?? b.canonicalShort,
  };
}

@Injectable()
export class BiomarkersService {
  constructor(private prisma: PrismaService) {}

  /** Каталог: глобальні + власні біомаркери користувача. */
  async list(userId: string) {
    const rows = await this.prisma.biomarker.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true },
      orderBy: [{ category: 'asc' }, { canonicalName: 'asc' }],
    });
    return rows.map(toDto);
  }

  async findBySlug(userId: string, slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true, translations: true },
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
      category?: string;
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
        category: data.category,
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
      include: { referenceRanges: true, translations: true },
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
