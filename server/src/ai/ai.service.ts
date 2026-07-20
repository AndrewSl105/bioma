import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ResultSource } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadedFileLike } from '../common/uploaded-file';
import { computeFlag, pickRange } from '../biomarkers/reference.util';
import { normalizeUnit } from '../biomarkers/unit-conversions';
import type { Locale } from '../i18n/locale';
import { localizeBiomarkerName } from '../i18n/localize';
import { buildMatcher } from './match-biomarker';
import {
  EXTRACTION_SYSTEM,
  EXTRACTION_TOOL,
  OPENAI_EXTRACTION_TOOL,
  ExtractionResult,
} from './extraction.prompt';

type AiProvider = 'anthropic' | 'openai';

/**
 * Конфіг читається ЛІНИВО, а не на рівні модуля.
 *
 * Імпорти виконуються раніше, ніж ConfigModule.forRoot() підвантажить .env,
 * тож на момент завантаження файлу process.env ще порожній. Раніше через це
 * AI_PROVIDER="openai" із .env мовчки ігнорувався: провайдер лишався
 * anthropic і падав на «ANTHROPIC_API_KEY не налаштовано». У проді змінні
 * задані середовищем, тому баг був видимий лише локально.
 */
const provider = (): AiProvider => (process.env.AI_PROVIDER ?? 'anthropic') as AiProvider;
const anthropicModel = () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const openaiModel = () => process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';

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
  async extract(userId: string, file: UploadedFileLike, locale: Locale) {
    if (!file) throw new BadRequestException('Файл не надіслано');
    // PDF нарівні із фото: бланк із лабораторії однаково часто приходить і
    // сканом, і файлом, а пайплайн далі однаковий — прев'ю, підтвердження,
    // запис. Обидва провайдери приймають PDF нативно, тож розпізнавати
    // сторінки самотужки не треба.
    const isPdf = file.mimetype === 'application/pdf';
    if (!isPdf && !file.mimetype.startsWith('image/'))
      throw new BadRequestException('Очікується зображення (JPEG/PNG/WebP) або PDF');

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
        provider() === 'openai'
          ? await this.extractWithOpenAi(file)
          : await this.extractWithAnthropic(file);

      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'PROCESSED', aiRaw: extraction as any },
      });

      const matched = await this.matchToBiomarkers(userId, extraction, locale);
      return {
        documentId: doc.id,
        labName: extraction.labName,
        takenAt: extraction.takenAt,
        // Чи такий забір уже імпортований. Не блокуємо — лише попереджаємо:
        // повторне завантаження того самого бланка це найпоширеніший спосіб
        // задвоїти історію, і мовчки дозволяти його не варто.
        duplicate: await this.findExistingPanel(userId, extraction.labName, extraction.takenAt),
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
  /** Блок контенту під тип файлу: у PDF власний тип, не image. */
  private anthropicSource(file: UploadedFileLike): any {
    const data = file.buffer.toString('base64');
    return file.mimetype === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: file.mimetype as any, data } };
  }

  private openaiSource(file: UploadedFileLike): any {
    const b64 = file.buffer.toString('base64');
    return file.mimetype === 'application/pdf'
      ? {
          type: 'file',
          file: {
            filename: file.originalname || 'document.pdf',
            file_data: `data:application/pdf;base64,${b64}`,
          },
        }
      : { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${b64}` } };
  }

  private async extractWithAnthropic(file: UploadedFileLike): Promise<ExtractionResult> {
    const message = await this.anthropic.messages.create({
      model: anthropicModel(),
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            this.anthropicSource(file),
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
    const completion = await this.openai.chat.completions.create({
      model: openaiModel(),
      // Моделі з ланцюжком міркувань не приймають function tools у
      // /v1/chat/completions, доки reasoning_effort не вимкнено явно — саме
      // це API і пропонує в тексті помилки. Витягування з бланка структурне
      // (виклик інструмента зі схемою), розмірковувати тут нема над чим.
      reasoning_effort: 'none',
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
            this.openaiSource(file),
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
  private async matchToBiomarkers(userId: string, extraction: ExtractionResult, locale: Locale) {
    const catalog = await this.prisma.biomarker.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      include: { translations: true },
    });
    const bySlug = new Map(catalog.map((b) => [b.slug, b]));

    // Логіка зіставлення живе в match-biomarker.ts і покрита тестами: саме
    // тут найлегше тихо покласти значення не в той показник.
    const match = buildMatcher(
      catalog.map((b) => ({
        slug: b.slug,
        loincCode: b.loincCode,
        names: [b.canonicalName, ...b.translations.map((t) => t.name)],
        shorts: [b.canonicalShort, ...b.translations.map((t) => t.shortName ?? null)],
      })),
    );

    return extraction.items.map((item) => {
      const hit = match(item.name, item.loinc);
      const biomarker = hit ? bySlug.get(hit.target.slug) : undefined;

      // Одиниця бланка може відрізнятись від канонічної — рахуємо перерахунок
      // ВІДРАЗУ і показуємо обидва значення. Інакше людина підтверджувала б
      // «30 нг/мл», а в історію лягало б 74,88 нмоль/л без жодного пояснення.
      const conversion =
        biomarker && typeof item.value === 'number'
          ? normalizeUnit(biomarker.slug, item.value, item.unit, biomarker.unit)
          : null;

      return {
        extracted: item,
        matchedBiomarker: biomarker
          ? {
              slug: biomarker.slug,
              name: localizeBiomarkerName(biomarker, locale).name,
              unit: biomarker.unit,
            }
          : null,
        /** exact — за LOINC чи повною назвою; fuzzy потребує підтвердження. */
        matchConfidence: hit?.confidence ?? null,
        conversion: conversion?.converted
          ? {
              value: +conversion.value.toFixed(4),
              unit: conversion.unit,
              enteredValue: conversion.enteredValue,
              enteredUnit: conversion.enteredUnit,
            }
          : null,
      };
    });
  }

  /**
   * Наявний забір за тією ж лабораторією й датою.
   *
   * Ідентичність забору — це лабораторія + дата: номера бланка в розпізнаному
   * тексті може не бути, а дата й лабораторія є завжди. Точного збігу досить,
   * щоб упізнати повторне завантаження того самого файлу.
   */
  private async findExistingPanel(userId: string, labName: string | null, takenAt: string | null) {
    if (!takenAt) return null;
    const day = new Date(takenAt);
    if (Number.isNaN(day.getTime())) return null;
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);

    const existing = await this.prisma.labPanel.findFirst({
      where: {
        userId,
        takenAt: { gte: start, lt: end },
        ...(labName ? { labName } : {}),
      },
      include: { _count: { select: { results: true } } },
    });
    return existing
      ? {
          panelId: existing.id,
          takenAt: existing.takenAt,
          labName: existing.labName,
          resultCount: existing._count.results,
        }
      : null;
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
      /** Джерело: фото чи PDF. Впливає лише на маркування результатів. */
      source?: 'AI_PHOTO' | 'IMPORT';
    },
  ) {
    // Профілю може ще не бути — тоді стать/вік невідомі, референси best-effort.
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ageYears = profile?.birthDate
      ? Math.floor((Date.now() - profile.birthDate.getTime()) / 31557600000)
      : null;

    // Ідемпотентність: той самий бланк, завантажений двічі, має лягти в ТУ Ж
    // панель, а не створити другу з тією ж датою й лабораторією. Повторне
    // завантаження — найпоширеніший спосіб задвоїти історію.
    const existing = await this.findExistingPanel(userId, body.labName ?? null, body.takenAt);
    const panel = existing
      ? await this.prisma.labPanel.findUniqueOrThrow({ where: { id: existing.panelId } })
      : await this.prisma.labPanel.create({
          data: {
            userId,
            name: body.labName,
            labName: body.labName,
            takenAt: new Date(body.takenAt),
            documentId: body.documentId,
          },
        });

    const measuredAt = new Date(body.takenAt);
    const resultSource =
      body.source === 'IMPORT' ? ResultSource.IMPORT : ResultSource.AI_PHOTO;

    let created = 0;
    let skipped = 0;
    for (const item of body.items) {
      const biomarker = await this.prisma.biomarker.findFirst({
        where: { slug: item.biomarkerSlug, OR: [{ ownerId: null }, { ownerId: userId }] },
        include: { referenceRanges: true },
      });
      if (!biomarker) continue;

      // Той самий показник на ту саму дату вже є — не дублюємо. Правка
      // значення це окрема свідома дія, а не побічний ефект повторного
      // імпорту того самого файлу.
      const already = await this.prisma.labResult.findFirst({
        where: { userId, biomarkerId: biomarker.id, measuredAt },
        select: { id: true },
      });
      if (already) {
        skipped++;
        continue;
      }

      const range = pickRange(biomarker.referenceRanges, {
        sex: profile?.sex ?? undefined,
        ageYears,
      });

      // Той самий перерахунок, що й при ручному введенні: бланк із фото —
      // найімовірніше джерело «чужої» одиниці, бо лабораторію обирає не
      // застосунок. Без цього імпорт мовчки псував би тренд.
      const norm = normalizeUnit(biomarker.slug, item.value, item.unit, biomarker.unit);

      await this.prisma.$transaction([
        this.prisma.labResult.create({
          data: {
            userId,
            biomarkerId: biomarker.id,
            value: norm.value,
            unit: norm.unit,
            enteredValue: norm.enteredValue,
            enteredUnit: norm.enteredUnit,
            measuredAt,
            flag: computeFlag(norm.value, range ?? undefined),
            source: resultSource,
            rawText: item.rawText,
            panelId: panel.id,
          },
        }),
        // Дашборд будується з обраних показників — без цього рядка розпізнана
        // з фото панель осіла б у базі, але на дашборді не з'явилася.
        this.prisma.userBiomarker.upsert({
          where: { userId_biomarkerId: { userId, biomarkerId: biomarker.id } },
          update: {},
          create: { userId, biomarkerId: biomarker.id },
        }),
      ]);
      created++;
    }
    // skipped віддаємо явно: «додано 0» без пояснення виглядає як поломка,
    // хоча насправді все вже було імпортовано раніше.
    return { panelId: panel.id, created, skipped, reusedPanel: !!existing };
  }
}

