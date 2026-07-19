import 'dotenv/config'; // tsx не вантажить .env сам
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Sex, ResultFlag, ResultSource } from '../src/generated/prisma/client';
import { CATALOG, CatalogRange } from './catalog';
import { PATIENT_PANELS, PATIENT_PROFILE } from './patient-data';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

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

// ── вибір діапазону за статтю/віком + прапорець ──────────────
function ageAt(birthDate: string, at: Date): number {
  const b = new Date(birthDate);
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--;
  return age;
}

function pickRange(ranges: CatalogRange[], sex: Sex, age: number): CatalogRange | undefined {
  const scored = ranges
      .map((r) => {
        let score = 0;
        if (r.sex && r.sex !== Sex.ANY) {
          if (r.sex === sex) score += 2;
          else return null;
        } else score += 1;
        if (r.ageMinYears != null && age < r.ageMinYears) return null;
        if (r.ageMaxYears != null && age > r.ageMaxYears) return null;
        if (r.ageMinYears != null || r.ageMaxYears != null) score += 1;
        return { r, score };
      })
      .filter((x): x is { r: CatalogRange; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
  return scored[0]?.r;
}

function computeFlag(value: number, range?: CatalogRange): ResultFlag {
  if (!range || (range.low == null && range.high == null)) return ResultFlag.UNKNOWN;
  if (range.low != null && value < range.low) return ResultFlag.LOW;
  if (range.high != null && value > range.high) return ResultFlag.HIGH;
  return ResultFlag.NORMAL;
}

async function seedCatalog() {
  let created = 0;
  let translations = 0;
  for (const b of CATALOG) {
    let biomarker = await prisma.biomarker.findFirst({ where: { ownerId: null, slug: b.slug } });
    if (!biomarker) {
      biomarker = await prisma.biomarker.create({
        data: {
          ownerId: null,
          slug: b.slug,
          loincCode: b.loincCode,
          canonicalName: b.canonicalName,
          canonicalShort: b.canonicalShort,
          category: b.category,
          unit: b.unit,
          precision: b.precision ?? 2,
          bands: b.bands ?? undefined,
          referenceRanges: {
            create: b.ranges
                .filter((r) => r.low != null || r.high != null || r.optimalLow != null || r.optimalHigh != null)
                .map((r) => ({
                  low: r.low ?? null,
                  high: r.high ?? null,
                  optimalLow: r.optimalLow ?? null,
                  optimalHigh: r.optimalHigh ?? null,
                  unit: b.unit,
                  sex: r.sex ?? Sex.ANY,
                  ageMinYears: r.ageMinYears ?? null,
                  ageMaxYears: r.ageMaxYears ?? null,
                  source: r.source,
                })),
          },
        },
      });
      created++;
    } else {
      // оновлюємо канонічні поля + bands на випадок змін каталогу
      await prisma.biomarker.update({
        where: { id: biomarker.id },
        data: {
          loincCode: b.loincCode,
          canonicalName: b.canonicalName,
          canonicalShort: b.canonicalShort,
          category: b.category,
          unit: b.unit,
          precision: b.precision ?? 2,
          bands: b.bands ?? undefined,
        },
      });
    }

    for (const [locale, t] of Object.entries(b.i18n)) {
      await prisma.biomarkerTranslation.upsert({
        where: { biomarkerId_locale: { biomarkerId: biomarker.id, locale } },
        update: { name: t.name, shortName: t.shortName, category: t.category },
        create: { biomarkerId: biomarker.id, locale, name: t.name, shortName: t.shortName, category: t.category },
      });
      translations++;
    }
  }
  return { created, translations };
}

async function seedPatient() {
  // Демо-панелі ллються ВИКЛЮЧНО в реальний акаунт Neon Auth — id тільки з env.
  const userId = process.env.SEED_USER_ID?.trim();
  if (!userId) {
    throw new Error(
      'SEED_USER_ID не задано. Передай реальний Neon Auth user id (sub), ' +
        'напр. SEED_USER_ID=... npm run db:seed',
    );
  }

  // Профіль пацієнта (чол., 1998) — щоб працювали референси за статтю/віком.
  // Створюємо/оновлюємо користувача лише зі статтю і датою народження;
  // email/ім'я НЕ чіпаємо — їх виставить сам Neon Auth при вході (ensureUser).
  await prisma.user.upsert({
    where: { id: userId },
    update: { sex: PATIENT_PROFILE.sex, birthDate: new Date(PATIENT_PROFILE.birthDate) },
    create: { id: userId, sex: PATIENT_PROFILE.sex, birthDate: new Date(PATIENT_PROFILE.birthDate) },
  });

  const catalogBySlug = new Map(CATALOG.map((c) => [c.slug, c]));
  const dbBiomarkers = await prisma.biomarker.findMany({ where: { ownerId: null } });
  const idBySlug = new Map(dbBiomarkers.map((b) => [b.slug, b.id]));

  let panelsCreated = 0;
  let resultsCreated = 0;
  let panelsSkipped = 0;

  for (const panel of PATIENT_PANELS) {
    const takenAt = new Date(panel.takenAt);
    // ідемпотентність: пропускаємо, якщо панель з таким orderNo вже є
    const existing = await prisma.labPanel.findFirst({
      where: { userId, name: panel.orderNo },
    });
    if (existing) {
      panelsSkipped++;
      continue;
    }

    const age = ageAt(PATIENT_PROFILE.birthDate, takenAt);

    const created = await prisma.labPanel.create({
      data: {
        userId,
        name: panel.orderNo,
        labName: panel.labName,
        takenAt,
        results: {
          create: Object.entries(panel.results)
              .filter(([slug]) => idBySlug.has(slug))
              .map(([slug, value]) => {
                const cat = catalogBySlug.get(slug)!;
                const range = pickRange(cat.ranges, PATIENT_PROFILE.sex, age);
                return {
                  userId,
                  biomarkerId: idBySlug.get(slug)!,
                  value,
                  unit: cat.unit,
                  measuredAt: takenAt,
                  flag: computeFlag(value, range),
                  source: ResultSource.IMPORT,
                };
              }),
        },
      },
      include: { results: true },
    });
    panelsCreated++;
    resultsCreated += created.results.length;
  }
  return { userId, panelsCreated, resultsCreated, panelsSkipped };
}

async function main() {
  const c = await seedCatalog();
  await prisma.promInstrument.upsert({
    where: { slug: PHQ9.slug },
    update: {},
    create: { slug: PHQ9.slug, title: PHQ9.title, description: PHQ9.description, schema: PHQ9.schema },
  });
  console.log(
      `Каталог: +${c.created} біомаркерів (усього ${CATALOG.length}), ${c.translations} перекладів.\n` +
      `+1 PROM-опитувальник (PHQ-9).`,
  );

  // Демо-дані пацієнта: тільки в реальний акаунт Neon Auth (SEED_USER_ID).
  // Користувача створює сам сід (upsert), заходити в застосунок заздалегідь не треба.
  const p = await seedPatient();
  const skipped = p.panelsSkipped
      ? ` (${p.panelsSkipped} панелей уже існували — пропущено, дублів немає)`
      : '';
  console.log(
      `Пацієнт ${p.userId}: +${p.panelsCreated} панелей, ` +
      `+${p.resultsCreated} результатів на ${PATIENT_PANELS.length} дати${skipped}.`,
  );
}

main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());