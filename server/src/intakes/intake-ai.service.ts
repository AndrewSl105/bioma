import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadedFileLike } from '../common/uploaded-file';
import { DRUG_CLASS_KEYS } from '../biomarkers/taxonomy';
import { isIntakeActive } from './intakes.service';
import {
  INTAKE_OPS_SYSTEM,
  INTAKE_OPS_TOOL,
  OPENAI_INTAKE_OPS_TOOL,
  type IntakeOpsResult,
  type ProposedOp,
} from './intake-ops.prompt';

type AiProvider = 'anthropic' | 'openai';

// Ліниво, як і в ai.service: імпорти виконуються раніше, ніж ConfigModule
// підвантажить .env, і на рівні модуля process.env ще порожній.
const provider = (): AiProvider => (process.env.AI_PROVIDER ?? 'anthropic') as AiProvider;
const anthropicModel = () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const openaiModel = () => process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';
const sttModel = () => process.env.OPENAI_STT_MODEL ?? 'whisper-1';

/** Операція, збагачена посиланням на конкретний наявний запис. */
export type ResolvedOp = ProposedOp & {
  /** id наявного запису для STOP/UPDATE; null, якщо не знайшли. */
  targetId: string | null;
  targetLabel: string | null;
};

/**
 * Голос і текст → пропоновані зміни у списку ліків.
 *
 * НІЧОГО НЕ ЗБЕРІГАЄ. Повертає операції, які показуються людині як diff;
 * запис відбувається окремим викликом apply() уже після підтвердження.
 *
 * Дозування тут не інтерпретується ніде: dosageText проходить наскрізь як
 * текст. Bioma не радить доз і не вирішує, що приймати.
 */
@Injectable()
export class IntakeAiService {
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;

  constructor(private prisma: PrismaService) {}

  private get anthropic(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY не налаштовано');
    return (this.anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
  }

  private get openai(): OpenAI {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY не налаштовано');
    return (this.openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  /**
   * Аудіо → текст. Whisper, бо ключ OpenAI уже налаштований, а якість
   * української в нього прийнятна. Транскрипт ПОВЕРТАЄМО користувачу: він
   * має бачити, що саме «почула» модель, ще до розбору на операції.
   */
  async transcribe(file: UploadedFileLike): Promise<string> {
    if (!file) throw new BadRequestException('Аудіо не надіслано');
    const audio = new File([new Uint8Array(file.buffer)], file.originalname || 'audio.webm', {
      type: file.mimetype || 'audio/webm',
    });
    try {
      const r = await this.openai.audio.transcriptions.create({
        file: audio,
        model: sttModel(),
      });
      return r.text ?? '';
    } catch (e: any) {
      throw new BadRequestException(`Не вдалося розпізнати аудіо: ${e?.message ?? e}`);
    }
  }

  /**
   * Текст → пропоновані операції, звірені з наявними записами користувача.
   *
   * Наявні записи йдуть у промпт, щоб STOP/UPDATE могли послатись саме на
   * них: без цього модель «зупиняла» б записи, яких немає.
   */
  async parse(userId: string, text: string) {
    const transcript = text?.trim();
    if (!transcript) throw new BadRequestException('Порожній текст');

    const existing = await this.prisma.userIntake.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, drugClassKey: true, startDate: true, endDate: true },
    });
    const active = existing.filter(isIntakeActive);

    const userMessage =
      `Репліка користувача: «${transcript}»\n\n` +
      (active.length
        ? `Наявні записи, які людина приймає зараз:\n${active.map((i) => `- ${i.name}`).join('\n')}`
        : 'Наявних записів немає.');

    const raw =
      provider() === 'openai'
        ? await this.parseWithOpenAi(userMessage)
        : await this.parseWithAnthropic(userMessage);

    return { transcript, ops: this.resolve(raw.ops ?? [], active) };
  }

  private async parseWithAnthropic(userMessage: string): Promise<IntakeOpsResult> {
    const message = await this.anthropic.messages.create({
      model: anthropicModel(),
      max_tokens: 1024,
      system: INTAKE_OPS_SYSTEM,
      tools: [INTAKE_OPS_TOOL],
      tool_choice: { type: 'tool', name: INTAKE_OPS_TOOL.name },
      messages: [{ role: 'user', content: userMessage }],
    });
    const use = message.content.find((b) => b.type === 'tool_use');
    if (!use || use.type !== 'tool_use') throw new BadRequestException('AI не повернув операцій');
    return use.input as IntakeOpsResult;
  }

  private async parseWithOpenAi(userMessage: string): Promise<IntakeOpsResult> {
    const completion = await this.openai.chat.completions.create({
      model: openaiModel(),
      // Як і у витягуванні з бланка: function tools у chat.completions
      // вимагають явно вимкненого reasoning_effort.
      reasoning_effort: 'none',
      tools: [OPENAI_INTAKE_OPS_TOOL],
      tool_choice: { type: 'function', function: { name: OPENAI_INTAKE_OPS_TOOL.function.name } },
      messages: [
        { role: 'system', content: INTAKE_OPS_SYSTEM },
        { role: 'user', content: userMessage },
      ],
    });
    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== 'function') throw new BadRequestException('AI не повернув операцій');
    try {
      return JSON.parse(call.function.arguments) as IntakeOpsResult;
    } catch {
      throw new BadRequestException('AI повернув невалідний JSON');
    }
  }

  /**
   * Прив'язує STOP/UPDATE до конкретного наявного запису і чистить те, чому
   * не можна довіряти.
   *
   * Операція без знайденого запису НЕ відкидається мовчки: вона показується
   * з поміткою «запис не знайдено», щоб людина побачила, що модель мала на
   * увазі щось, чого в списку немає.
   */
  private resolve(
    ops: ProposedOp[],
    active: { id: string; name: string }[],
  ): ResolvedOp[] {
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const byName = new Map(active.map((i) => [norm(i.name), i]));

    return ops
      .filter((o) => o.name?.trim())
      .map((o) => {
        const needle = norm(o.targetName || o.name);
        const hit =
          byName.get(needle) ??
          active.find((i) => norm(i.name).includes(needle) || needle.includes(norm(i.name)));

        return {
          ...o,
          // Невідомий клас відкидаємо: якби він доїхав до БД, прив'язка до
          // показників мовчки не спрацьовувала б.
          drugClassKey:
            o.drugClassKey && (DRUG_CLASS_KEYS as readonly string[]).includes(o.drugClassKey)
              ? o.drugClassKey
              : null,
          type: o.type ?? 'SUPPLEMENT',
          targetId: o.op === 'ADD' ? null : hit?.id ?? null,
          targetLabel: o.op === 'ADD' ? null : hit?.name ?? null,
        };
      });
  }
}
