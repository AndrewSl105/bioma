import { PrismaClient, Sex } from '@prisma/client';

const prisma = new PrismaClient();

type Seed = {
  slug: string;
  name: string;
  shortName: string;
  unit: string;
  category: string;
  loincCode?: string;
  precision?: number;
  ranges: {
    low?: number;
    high?: number;
    optimalLow?: number;
    optimalHigh?: number;
    sex?: Sex;
    source?: string;
  }[];
};

// Демонстраційний каталог. Референси спрощені — звіряйте з бланком лабораторії.
const CATALOG: Seed[] = [
  {
    slug: 'vitamin-d',
    name: 'Вітамін D (25-OH)',
    shortName: 'Вітамін D',
    unit: 'нг/мл',
    category: 'Вітаміни',
    loincCode: '35059-2',
    ranges: [{ low: 30, high: 100, optimalLow: 40, optimalHigh: 60, source: 'Endocrine Society' }],
  },
  {
    slug: 'total-cholesterol',
    name: 'Загальний холестерин',
    shortName: 'Холестерин',
    unit: 'ммоль/л',
    category: 'Ліпідограма',
    loincCode: '2093-3',
    ranges: [{ high: 5.2, source: 'NCEP ATP III' }],
  },
  {
    slug: 'ldl',
    name: 'Холестерин ЛПНЩ (LDL)',
    shortName: 'ЛПНЩ',
    unit: 'ммоль/л',
    category: 'Ліпідограма',
    loincCode: '13457-7',
    ranges: [{ high: 3.0 }],
  },
  {
    slug: 'hdl',
    name: 'Холестерин ЛПВЩ (HDL)',
    shortName: 'ЛПВЩ',
    unit: 'ммоль/л',
    category: 'Ліпідограма',
    loincCode: '2085-9',
    ranges: [
      { low: 1.0, sex: Sex.MALE },
      { low: 1.2, sex: Sex.FEMALE },
    ],
  },
  {
    slug: 'triglycerides',
    name: 'Тригліцериди',
    shortName: 'Тригліцериди',
    unit: 'ммоль/л',
    category: 'Ліпідограма',
    loincCode: '2571-8',
    ranges: [{ high: 1.7 }],
  },
  {
    slug: 'glucose',
    name: 'Глюкоза (натще)',
    shortName: 'Глюкоза',
    unit: 'ммоль/л',
    category: 'Біохімія',
    loincCode: '1558-6',
    ranges: [{ low: 3.9, high: 5.6 }],
  },
  {
    slug: 'hba1c',
    name: 'Глікований гемоглобін (HbA1c)',
    shortName: 'HbA1c',
    unit: '%',
    category: 'Біохімія',
    loincCode: '4548-4',
    ranges: [{ high: 5.7 }],
  },
  {
    slug: 'tsh',
    name: 'Тиреотропний гормон (ТТГ)',
    shortName: 'ТТГ',
    unit: 'мкМО/мл',
    category: 'Гормони',
    loincCode: '3016-3',
    ranges: [{ low: 0.4, high: 4.0 }],
  },
  {
    slug: 'ferritin',
    name: 'Феритин',
    shortName: 'Феритин',
    unit: 'нг/мл',
    category: 'Гематологія',
    loincCode: '2276-4',
    ranges: [
      { low: 30, high: 400, sex: Sex.MALE },
      { low: 15, high: 150, sex: Sex.FEMALE },
    ],
  },
  {
    slug: 'hemoglobin',
    name: 'Гемоглобін',
    shortName: 'Гемоглобін',
    unit: 'г/л',
    category: 'Гематологія',
    loincCode: '718-7',
    ranges: [
      { low: 130, high: 170, sex: Sex.MALE },
      { low: 120, high: 150, sex: Sex.FEMALE },
    ],
  },
];

const PHQ9 = {
  slug: 'phq-9',
  title: 'PHQ-9 — самопочуття (2 тижні)',
  description: 'Опитувальник депресивних симптомів. Не є діагнозом.',
  schema: {
    scale: [
      { value: 0, label: 'Зовсім ні' },
      { value: 1, label: 'Кілька днів' },
      { value: 2, label: 'Більше половини днів' },
      { value: 3, label: 'Майже щодня' },
    ],
    questions: [
      { id: 'q1', text: 'Мало інтересу чи задоволення від справ' },
      { id: 'q2', text: 'Пригнічений настрій, смуток або безнадія' },
      { id: 'q3', text: 'Проблеми зі сном' },
      { id: 'q4', text: 'Втома або брак енергії' },
      { id: 'q5', text: 'Поганий апетит або переїдання' },
    ],
    scoring: 'sum',
  },
};

async function main() {
  for (const b of CATALOG) {
    const existing = await prisma.biomarker.findFirst({
      where: { ownerId: null, slug: b.slug },
    });
    if (existing) continue;

    await prisma.biomarker.create({
      data: {
        ownerId: null,
        slug: b.slug,
        name: b.name,
        shortName: b.shortName,
        unit: b.unit,
        category: b.category,
        loincCode: b.loincCode,
        precision: b.precision ?? 2,
        referenceRanges: {
          create: b.ranges.map((r) => ({
            low: r.low ?? null,
            high: r.high ?? null,
            optimalLow: r.optimalLow ?? null,
            optimalHigh: r.optimalHigh ?? null,
            unit: b.unit,
            sex: r.sex ?? Sex.ANY,
            source: r.source,
          })),
        },
      },
    });
  }

  await prisma.promInstrument.upsert({
    where: { slug: PHQ9.slug },
    update: {},
    create: { slug: PHQ9.slug, title: PHQ9.title, description: PHQ9.description, schema: PHQ9.schema },
  });

  console.log(`Сід готово: ${CATALOG.length} біомаркерів + 1 PROM-опитувальник`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
