import { Injectable, NotFoundException } from '@nestjs/common';
import { Sex } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BiomarkersService {
  constructor(private prisma: PrismaService) {}

  /** Каталог: глобальні + власні біомаркери користувача. */
  async list(userId: string) {
    return this.prisma.biomarker.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findBySlug(userId: string, slug: string) {
    const biomarker = await this.prisma.biomarker.findFirst({
      where: { slug, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { referenceRanges: true },
    });
    if (!biomarker) throw new NotFoundException('Біомаркер не знайдено');
    return biomarker;
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
    return this.prisma.biomarker.create({
      data: {
        ownerId: userId,
        slug,
        name: data.name,
        shortName: data.shortName,
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
      include: { referenceRanges: true },
    });
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
