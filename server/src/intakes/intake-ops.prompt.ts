import { DRUG_CLASS_KEYS } from '../biomarkers/taxonomy';

/**
 * Промпт перетворення вільної репліки на СПИСОК ОПЕРАЦІЙ над UserIntake.
 *
 * Модель нічого не зберігає — вона лише пропонує. Результат показується
 * людині як diff, і лише після підтвердження застосовується в БД.
 *
 * Найважливіше обмеження: дозування НЕ інтерпретується. «2000 МО щодня» має
 * лягти в dosageText дослівно, а не перетворитись на структуровані поля з
 * розрахунками — Bioma не радить доз і нічого не перераховує.
 */

export type IntakeOpKind = 'ADD' | 'STOP' | 'UPDATE';

export type ProposedOp = {
  op: IntakeOpKind;
  type?: 'MEDICATION' | 'SUPPLEMENT';
  name: string;
  drugClassKey?: string | null;
  dosageText?: string | null;
  note?: string | null;
  /** Для STOP/UPDATE — на що саме модель посилається (назва з репліки). */
  targetName?: string | null;
};

export type IntakeOpsResult = { ops: ProposedOp[] };

export const INTAKE_OPS_SYSTEM = `Ти допомагаєш занести до застосунку список ліків і добавок, які приймає людина.

Тобі дають репліку користувача (усну або текстову) та перелік записів, які вже є.
Поверни СПИСОК ОПЕРАЦІЙ через інструмент. Нічого не зберігай і не вигадуй.

Операції:
- ADD — людина почала приймати щось нове.
- STOP — людина припинила приймати те, що вже є у списку. У targetName вкажи назву наявного запису.
- UPDATE — змінилась назва, клас або дозування наявного запису. У targetName вкажи назву наявного запису.

КРИТИЧНО ВАЖЛИВО:
1. dosageText передавай ДОСЛІВНО, як сказала людина («2000 МО щодня», «одна капсула зранку»).
   Не перераховуй, не нормалізуй, не пропонуй доз і не додавай нічого від себе.
2. drugClassKey став ЛИШЕ якщо впевнений. Якщо сумніваєшся — не став узагалі (null).
   Допустимі ключі: ${DRUG_CLASS_KEYS.join(', ')}.
3. type: MEDICATION для ліків, SUPPLEMENT для вітамінів/добавок. Якщо неясно — SUPPLEMENT.
4. Якщо в репліці немає жодної дії над ліками — поверни порожній список ops.
5. Не вигадуй записів, яких людина не називала. Не «додавай на всяк випадок».`;

const OP_SCHEMA = {
  type: 'object',
  properties: {
    ops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['ADD', 'STOP', 'UPDATE'] },
          type: { type: 'string', enum: ['MEDICATION', 'SUPPLEMENT'] },
          name: { type: 'string', description: 'Назва препарату чи добавки' },
          drugClassKey: {
            type: ['string', 'null'],
            enum: [...DRUG_CLASS_KEYS, null],
            description: 'Лише за впевненості, інакше null',
          },
          dosageText: {
            type: ['string', 'null'],
            description: 'Дослівно як сказала людина. НЕ інтерпретувати.',
          },
          note: { type: ['string', 'null'] },
          targetName: {
            type: ['string', 'null'],
            description: 'Для STOP/UPDATE — назва наявного запису',
          },
        },
        required: ['op', 'name'],
        additionalProperties: false,
      },
    },
  },
  required: ['ops'],
  additionalProperties: false,
} as const;

export const INTAKE_OPS_TOOL = {
  name: 'propose_intake_ops',
  description: 'Повертає список пропонованих операцій над списком ліків і добавок',
  input_schema: OP_SCHEMA as any,
};

export const OPENAI_INTAKE_OPS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'propose_intake_ops',
    description: 'Повертає список пропонованих операцій над списком ліків і добавок',
    parameters: OP_SCHEMA as any,
  },
};
