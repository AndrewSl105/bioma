import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Locale } from '../i18n/locale';
import { localizeCategory } from '../i18n/localize';
import type {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

/** Крок sortOrder: лишає місце вставити категорію між двома наявними. */
const ORDER_STEP = 10;

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Список категорій. Звичайному користувачу — лише активні; адміну всі,
   * бо деактивована категорія має лишатись видимою, щоб її можна було
   * повернути.
   */
  async list(locale: Locale, includeInactive = false) {
    const rows = await this.prisma.biomarkerCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        translations: true,
        // Кількість маркерів потрібна адмінці: за нею видно, що видалення
        // категорії зачепить, і чи вона взагалі використовується.
        _count: { select: { biomarkers: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map((c) => ({
      ...localizeCategory(c, locale)!,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      biomarkerCount: c._count.biomarkers,
      // Адмінці потрібні всі мови одразу — інакше форму редагування
      // довелося б наповнювати окремим запитом на кожну категорію. Канон
      // теж окремо: у полі name лежить уже локалізована назва.
      canonicalName: includeInactive ? c.name : undefined,
      translations: includeInactive
        ? c.translations.map((t) => ({ locale: t.locale, name: t.name }))
        : undefined,
    }));
  }

  async create(dto: CreateCategoryDto, locale: Locale) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    if (!slug) throw new BadRequestException('Не вдалося побудувати slug із назви');

    const existing = await this.prisma.biomarkerCategory.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Категорія з таким slug уже існує');

    // Нову категорію ставимо в кінець: вгадувати місце в чужому порядку
    // гірше, ніж дати адміну перетягнути її самому.
    const last = await this.prisma.biomarkerCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await this.prisma.biomarkerCategory.create({
      data: {
        slug,
        name: dto.name,
        imageKey: dto.imageKey ?? null,
        sortOrder: dto.sortOrder ?? (last?.sortOrder ?? 0) + ORDER_STEP,
        translations: dto.translations?.length
          ? { create: dto.translations.map((t) => ({ locale: t.locale, name: t.name })) }
          : undefined,
      },
      include: { translations: true },
    });
    return localizeCategory(created, locale);
  }

  async update(id: string, dto: UpdateCategoryDto, locale: Locale) {
    await this.getOrThrow(id);

    const updated = await this.prisma.biomarkerCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.imageKey !== undefined ? { imageKey: dto.imageKey } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { translations: true },
    });

    for (const t of dto.translations ?? []) {
      await this.prisma.biomarkerCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: id, locale: t.locale } },
        update: { name: t.name },
        create: { categoryId: id, locale: t.locale, name: t.name },
      });
    }

    // Перечитуємо: переклади оновлювались після update, тож у `updated`
    // вони ще старі.
    const fresh = await this.prisma.biomarkerCategory.findUnique({
      where: { id },
      include: { translations: true },
    });
    return localizeCategory(fresh ?? updated, locale);
  }

  /** Новий порядок — послідовність id. Незгадані категорії лишаються позаду. */
  async reorder(dto: ReorderCategoriesDto) {
    const found = await this.prisma.biomarkerCategory.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true },
    });
    if (found.length !== dto.ids.length) {
      throw new BadRequestException('У переліку є неіснуючі категорії');
    }

    // Транзакція: частково застосований порядок — гірше за незмінений,
    // бо на екрані він виглядав би випадковим.
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.biomarkerCategory.update({
          where: { id },
          data: { sortOrder: (index + 1) * ORDER_STEP },
        }),
      ),
    );
    return { ok: true, count: dto.ids.length };
  }

  /**
   * М'яке видалення: на категорію посилаються маркери, і жорстке прибирання
   * знеструмило б їм categoryId (у схемі SetNull). Категорію з прив'язаними
   * маркерами взагалі не видаляємо — лише ховаємо.
   */
  async remove(id: string) {
    const category = await this.getOrThrow(id);
    const biomarkers = await this.prisma.biomarker.count({ where: { categoryId: id } });

    if (biomarkers > 0) {
      await this.prisma.biomarkerCategory.update({ where: { id }, data: { isActive: false } });
      return { ok: true, deactivated: true, biomarkers };
    }

    // Порожню категорію прибираємо остаточно — ховати нічого.
    await this.prisma.biomarkerCategory.delete({ where: { id: category.id } });
    return { ok: true, deactivated: false, biomarkers: 0 };
  }

  private async getOrThrow(id: string) {
    const category = await this.prisma.biomarkerCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Категорію не знайдено');
    return category;
  }
}

/** Той самий підхід, що й для біомаркерів: латиниця, цифри, дефіси. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
