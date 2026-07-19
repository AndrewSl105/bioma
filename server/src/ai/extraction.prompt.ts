/** Системний промпт для екстракції показників з фото документа аналізів. */
export const EXTRACTION_SYSTEM = `Ти — медичний асистент, що зчитує лабораторні бланки аналізів з фото/скану.
Витягни КОЖЕН числовий показник. Не вигадуй значень: якщо поле нечитабельне — пропусти його.
Нормалізуй десяткові коми в крапки. Одиниці залишай як у бланку.
Дату дослідження визнач з бланка (формат ISO 8601, лише дата). Якщо дати немає — null.
Відповідай ВИКЛЮЧНО валідним JSON без пояснень і без markdown.`;

export const EXTRACTION_TOOL = {
  name: 'submit_lab_report',
  description: 'Повернути структуровані показники з лабораторного бланка.',
  input_schema: {
    type: 'object' as const,
    properties: {
      labName: { type: ['string', 'null'], description: 'Назва лабораторії' },
      takenAt: {
        type: ['string', 'null'],
        description: 'Дата дослідження, ISO 8601 (YYYY-MM-DD) або null',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Назва показника як у бланку' },
            loinc: { type: ['string', 'null'], description: 'LOINC-код, якщо відомий' },
            value: { type: 'number' },
            unit: { type: 'string' },
            referenceLow: { type: ['number', 'null'] },
            referenceHigh: { type: ['number', 'null'] },
            rawText: { type: 'string', description: 'Оригінальний рядок з бланка' },
          },
          required: ['name', 'value', 'unit', 'rawText'],
        },
      },
    },
    required: ['items'],
  },
};

/** Той самий інструмент у форматі OpenAI function calling. */
export const OPENAI_EXTRACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: EXTRACTION_TOOL.name,
    description: EXTRACTION_TOOL.description,
    parameters: EXTRACTION_TOOL.input_schema,
  },
};

export interface ExtractedItem {
  name: string;
  loinc: string | null;
  value: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  rawText: string;
}
export interface ExtractionResult {
  labName: string | null;
  takenAt: string | null;
  items: ExtractedItem[];
}
