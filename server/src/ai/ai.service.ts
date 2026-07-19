import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ResultSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadedFileLike } from '../common/uploaded-file';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import {
  EXTRACTION_SYSTEM,
  EXTRACTION_TOOL,
  ExtractionResult,
} from './extraction.prompt';

const MODEL = 'claude-sonnet-5';

@Injectable()
export class AiService {
  private anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(private prisma: PrismaService) {}

  /**
   * Крок 1. Фото → Claude vision → структуровані показники.
   * Створює Document (для аудиту), НЕ додаючи результатів в історію.
   * Повертає прев'ю + мапінг на біомаркери каталогу для підтвердження.
   */
  async extract(userId: string, file: UploadedFileLike) {
    if (!file) throw new BadRequestException('Файл не надіслано');
    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('Очікується зображення (JPEG/PNG/WebP)');

    const doc = await this.prisma.document.create({
      data: {
        userId,
        storageKey: `inline:${file.originalname}`,
        mimeType: file.mimetype,
        fileName: file.originalname,
        status: 'PROCESSING',
      },
    });

    try {
      const message = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: EXTRACTION_SYSTEM,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.mimetype as any,
                  data: file.buffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Витягни всі показники з цього лабораторного бланка.',
              },
            ],
          },
        ],
      });

      const toolUse = message.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use')
        throw new Error('AI не повернув структурованих даних');

      const extraction = toolUse.input as ExtractionResult;

      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'PROCESSED', aiRaw: extraction as any },
      });

      const matched = await this.matchToBiomarkers(userId, extraction);
      return {
        documentId: doc.id,
        labName: extraction.labName,
        takenAt: extraction.takenAt,
        items: matched,
      };
    } catch (e: any) {
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'FAILED', error: String(e?.message ?? e) },
      });
      throw new BadRequestException(`Не вдалося розпізнати документ: ${e?.message ?? e}`);
    }
  }

  /** Зіставляє витягнуті рядки з біомаркерами каталогу (LOINC → назва). */
  private async matchToBiomarkers(userId: string, extraction: ExtractionResult) {
    type CatalogItem = {
      slug: string;
      name: string;
      shortName: string | null;
      unit: string;
      loincCode: string | null;
    };
    const catalog: CatalogItem[] = await this.prisma.biomarker.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    });
    const byLoinc = new Map(catalog.filter((b) => b.loincCode).map((b) => [b.loincCode!, b]));
    const byName = new Map(catalog.map((b) => [norm(b.name), b]));
    const byShort = new Map(
      catalog.filter((b) => b.shortName).map((b) => [norm(b.shortName!), b]),
    );

    return extraction.items.map((item) => {
      const match =
        (item.loinc && byLoinc.get(item.loinc)) ||
        byName.get(norm(item.name)) ||
        byShort.get(norm(item.name)) ||
        [...byName.values()].find((b) => norm(item.name).includes(norm(b.shortName ?? b.name)));

      return {
        extracted: item,
        matchedBiomarker: match
          ? { slug: match.slug, name: match.name, unit: match.unit }
          : null,
      };
    });
  }

  /**
   * Крок 2. Користувач підтвердив/відкоригував — створюємо панель і результати.
   */
  async commit(
    userId: string,
    body: {
      documentId?: string;
      labName?: string;
      takenAt: string;
      items: { biomarkerSlug: string; value: number; unit: string; rawText?: string }[];
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ageYears = user?.birthDate
      ? Math.floor((Date.now() - user.birthDate.getTime()) / 31557600000)
      : null;

    const panel = await this.prisma.labPanel.create({
      data: {
        userId,
        name: body.labName,
        labName: body.labName,
        takenAt: new Date(body.takenAt),
        documentId: body.documentId,
      },
    });

    let created = 0;
    for (const item of body.items) {
      const biomarker = await this.prisma.biomarker.findFirst({
        where: { slug: item.biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
        include: { referenceRanges: true },
      });
      if (!biomarker) continue;

      const range = pickRange(biomarker.referenceRanges, {
        sex: user?.sex ?? undefined,
        ageYears,
      });
      await this.prisma.labResult.create({
        data: {
          userId,
          biomarkerId: biomarker.id,
          value: item.value,
          unit: item.unit ?? biomarker.unit,
          measuredAt: new Date(body.takenAt),
          flag: computeFlag(item.value, range ?? undefined),
          source: ResultSource.AI_PHOTO,
          rawText: item.rawText,
          panelId: panel.id,
        },
      });
      created++;
    }
    return { panelId: panel.id, created };
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zа-яіїєґ0-9]+/gi, ' ')
    .trim();
}
