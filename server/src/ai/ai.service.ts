import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ResultSource } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadedFileLike } from '../common/uploaded-file';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import {
  EXTRACTION_SYSTEM,
  EXTRACTION_TOOL,
  OPENAI_EXTRACTION_TOOL,
  ExtractionResult,
} from './extraction.prompt';

type AiProvider = 'anthropic' | 'openai';

const PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as AiProvider;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';

const EXTRACTION_USER_TEXT = 'Витягни всі показники з цього лабораторного бланка.';

@Injectable()
export class AiService {
  // Клієнти створюються ліниво: ключ потрібен лише для активного провайдера.
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;

  constructor(private prisma: PrismaService) {}

  private get anthropic(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error('ANTHROPIC_API_KEY не налаштовано');
    return (this.anthropicClient ??= new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }));
  }

  private get openai(): OpenAI {
    if (!process.env.OPENAI_API_KEY)
      throw new Error('OPENAI_API_KEY не налаштовано');
    return (this.openaiClient ??= new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }));
  }

  /**
   * Крок 1. Фото → vision-модель (Claude або OpenAI) → структуровані показники.
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
      const extraction =
        PROVIDER === 'openai'
          ? await this.extractWithOpenAi(file)
          : await this.extractWithAnthropic(file);

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

  /** Виклик Claude vision із примусовим tool use. */
  private async extractWithAnthropic(file: UploadedFileLike): Promise<ExtractionResult> {
    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
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
            { type: 'text', text: EXTRACTION_USER_TEXT },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use')
      throw new Error('AI не повернув структурованих даних');

    // Anthropic віддає input вже розпарсеним об'єктом.
    return toolUse.input as ExtractionResult;
  }

  /** Виклик OpenAI vision із примусовим function calling. */
  private async extractWithOpenAi(file: UploadedFileLike): Promise<ExtractionResult> {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const completion = await this.openai.chat.completions.create({
      model: OPENAI_MODEL,
      tools: [OPENAI_EXTRACTION_TOOL],
      tool_choice: {
        type: 'function',
        function: { name: OPENAI_EXTRACTION_TOOL.function.name },
      },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: EXTRACTION_USER_TEXT },
          ],
        },
      ],
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== 'function')
      throw new Error('AI не повернув структурованих даних');

    // На відміну від Anthropic, OpenAI віддає аргументи рядком JSON.
    try {
      return JSON.parse(call.function.arguments) as ExtractionResult;
    } catch {
      throw new Error('AI повернув невалідний JSON');
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
