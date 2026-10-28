import 'dotenv/config'; // tsx не вантажить .env сам
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Sex,
  ResultFlag,
  ResultSource,
  BodyMetricKind,
  IntakeType,
} from '../src/generated/prisma/client';
import { CATALOG, CatalogRange } from './catalog';
import { PATIENT_PANELS, PATIENT_PROFILE } from './patient-data';
import { CATALOG_CONTENT, type BiomarkerInfoContent } from './catalog-content';
import { CONTENT_TAXONOMY } from './content-taxonomy';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/// Автор системного каталогу. Не userId: маркери заводить не конкретна людина,
/// а сід — і вони мусять пережити будь-якого адміністратора.
const ADMIN_AUTHOR = 'admin';

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

/// Slug категорії з англійського каноніка — тим самим правилом, що й міграція
/// biomarker_categories, інакше сід наплодив би дублі вже наявних категорій.
function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Категорії каталогу. Назву беремо українську (з i18n маркерів), бо саме її
 * бачить користувач; sortOrder наявних категорій НЕ чіпаємо — порядок задає
 * адміністратор в адмінці, і сід не має права його перезатирати.
 */
async function seedCategories() {
  const ukByEn = new Map<string, string>();
  for (const b of CATALOG) {
    const uk = Object.values(b.i18n).find((t) => t.category)?.category;
    if (uk && !ukByEn.has(b.category)) ukByEn.set(b.category, uk);
  }

  const idBySlug = new Map<string, string>();
  let order = 0;
  for (const en of [...new Set(CATALOG.map((c) => c.category))].sort()) {
    order += 10;
    const slug = categorySlug(en);
    const category = await prisma.biomarkerCategory.upsert({
      where: { slug },
      update: { name: ukByEn.get(en) ?? en },
      create: { slug, name: ukByEn.get(en) ?? en, sortOrder: order },
    });
    idBySlug.set(en, category.id);
  }
  return idBySlug;
}

async function seedCatalog(categoryIdByEn: Map<string, string>) {
  let created = 0;
  let translations = 0;
  for (const b of CATALOG) {
    let biomarker = await prisma.biomarker.findFirst({ where: { ownerId: null, slug: b.slug } });
    if (!biomarker) {
      biomarker = await prisma.biomarker.create({
        data: {
          // Каталог належить системі: ownerId лишається порожнім, а автором
          // проставляється адмін — користувач такі маркери лише обирає.
          ownerId: null,
          isSystem: true,
          createdBy: ADMIN_AUTHOR,
          slug: b.slug,
          loincCode: b.loincCode,
          canonicalName: b.canonicalName,
          canonicalShort: b.canonicalShort,
          // legacyCategory лишається джерелом істини для backfill, а зв'язок
          // із BiomarkerCategory — те, за чим каталог сортується й групується.
          legacyCategory: b.category,
          categoryId: categoryIdByEn.get(b.category) ?? null,
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
          isSystem: true,
          createdBy: ADMIN_AUTHOR,
          loincCode: b.loincCode,
          canonicalName: b.canonicalName,
          canonicalShort: b.canonicalShort,
          legacyCategory: b.category,
          categoryId: categoryIdByEn.get(b.category) ?? null,
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

/**
 * Довідковий контент біомаркерів. НЕ створює маркерів — лише доповнює наявні
 * рядком BiomarkerContent за (biomarkerId, locale). Повторний прогін оновлює
 * на місці, дублів не робить.
 *
 * Прив'язка за slug, і маркери, яких ще немає в БД, тихо пропускаються: контент
 * пишеться наперед, і його поява не має валити сід через відсутній показник.
 */
async function seedContent() {
  const dbBiomarkers = await prisma.biomarker.findMany({
    where: { ownerId: null },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(dbBiomarkers.map((b) => [b.slug, b.id]));

  // Ключі беремо за slug і кладемо в обидві локалі: вони мовно-незалежні.
  const toRow = (c: BiomarkerInfoContent, slug: string) => ({
    relatedSystemKeys: CONTENT_TAXONOMY[slug]?.systems ?? [],
    functionalTagKeys: CONTENT_TAXONOMY[slug]?.functional ?? [],
    affectedByDrugClasses: CONTENT_TAXONOMY[slug]?.drugClasses ?? [],
    overview: c.overview ?? null,
    whatItMeasures: c.whatItMeasures ?? null,
    roleInBody: c.roleInBody ?? null,
    relatedSystems: c.relatedSystems ?? null,
    functionalLinks: c.functionalLinks ?? null,
    lowMeaning: c.lowMeaning ?? null,
    highMeaning: c.highMeaning ?? null,
    influencingFactors: c.influencingFactors ?? null,
    preparation: c.preparation ?? null,
    commonlyEvaluatedWith: c.commonlyEvaluatedWith ?? [],
    confirmatoryTests: c.confirmatoryTests ?? [],
    foodSources: c.foodSources ?? null,
    supplementsInfo: c.supplementsInfo ?? null,
    drugClassesInfo: c.drugClassesInfo ?? null,
    medicalSources: c.medicalSources ?? undefined,
    lastReviewedAt: c.lastReviewedAt ? new Date(c.lastReviewedAt) : null,
  });

  let upserts = 0;
  const skipped: string[] = [];
  const brokenLinks = new Set<string>();

  for (const [slug, byLocale] of Object.entries(CATALOG_CONTENT)) {
    const biomarkerId = idBySlug.get(slug);
    if (!biomarkerId) {
      skipped.push(slug);
      continue;
    }
    for (const [locale, content] of Object.entries(byLocale)) {
      // Переліченіslug'и мають бути клікабельними на фронті; той, якого немає
      // в каталозі, дасть «мертвий» пункт — тож повідомляємо, а не мовчимо.
      for (const ref of [...(content.commonlyEvaluatedWith ?? []), ...(content.confirmatoryTests ?? [])]) {
        if (!idBySlug.has(ref)) brokenLinks.add(`${slug}/${locale} → ${ref}`);
      }
      await prisma.biomarkerContent.upsert({
        where: { biomarkerId_locale: { biomarkerId, locale } },
        update: toRow(content, slug),
        create: { biomarkerId, locale, ...toRow(content, slug) },
      });
      upserts++;
    }
  }
  const noKeys = Object.keys(CATALOG_CONTENT).filter(
      (slug) => idBySlug.has(slug) && !CONTENT_TAXONOMY[slug],
  );
  return { upserts, skipped, brokenLinks: [...brokenLinks], noKeys };
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
  // UserProfile мусить існувати ДО панелей: усі аналізи мають на нього FK.
  // Email/ім'я тут не зберігаємо — особа живе тільки в Neon Auth.
  await prisma.userProfile.upsert({
    where: { userId },
    update: { sex: PATIENT_PROFILE.sex, birthDate: new Date(PATIENT_PROFILE.birthDate) },
    create: { userId, sex: PATIENT_PROFILE.sex, birthDate: new Date(PATIENT_PROFILE.birthDate) },
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

  // Дашборд будується з обраних показників, а не з результатів, тож демо-акаунту
  // треба явно проставити вибір — інакше залиті панелі нікуди не потраплять.
  // Обираємо рівно те, по чому є результати: дашборд лишається таким, як був.
  const measured = await prisma.labResult.findMany({
    where: { userId },
    distinct: ['biomarkerId'],
    select: { biomarkerId: true },
  });
  await prisma.userBiomarker.createMany({
    data: measured.map((r) => ({ userId, biomarkerId: r.biomarkerId })),
    skipDuplicates: true,
  });

  return { userId, panelsCreated, resultsCreated, panelsSkipped, selected: measured.length };
}

/**
 * Публічне демо: щоб вкладки «Тіло», «Ліки» й «Самопочуття» не стояли
 * порожніми, доливаємо трохи вигаданих даних. Лише за SEED_DEMO_EXTRAS=true —
 * у реальний акаунт це потрапляти не повинно.
 *
 * Ідемпотентно по-таблично: якщо в користувача вже є хоч один запис певного
 * типу, цей тип не чіпаємо (і не дублюємо, і не затираємо зроблене руками).
 */
async function seedDemoExtras(userId: string) {
  const DAY = 86_400_000;
  const today = new Date(new Date().toISOString().slice(0, 10));
  // Детерміновані «коливання» замість Math.random: однаковий сід — однакове демо.
  const wave = (i: number, amp: number) => Math.round(Math.sin(i * 1.7) * amp * 10) / 10;
  const done: string[] = [];

  // Зріст — щоб на «Тілі» рахувався ІМТ.
  await prisma.userProfile.update({ where: { userId }, data: { heightCm: 180 } });

  if (!(await prisma.bodyMetric.count({ where: { userId } }))) {
    const rows: { userId: string; kind: BodyMetricKind; value: number; measuredAt: Date }[] = [];
    for (let m = 7; m >= 0; m--) {
      const measuredAt = new Date(today.getTime() - m * 30 * DAY);
      const i = 7 - m;
      rows.push(
        { userId, kind: BodyMetricKind.WEIGHT, value: 82.4 - i * 0.45 + wave(i, 0.3), measuredAt },
        { userId, kind: BodyMetricKind.WAIST, value: 91 - i * 0.4 + wave(i, 0.4), measuredAt },
        { userId, kind: BodyMetricKind.RESTING_HR, value: Math.round(68 - i * 0.6 + wave(i, 2)), measuredAt },
        { userId, kind: BodyMetricKind.BP_SYSTOLIC, value: Math.round(126 - i + wave(i, 3)), measuredAt },
        { userId, kind: BodyMetricKind.BP_DIASTOLIC, value: Math.round(82 - i * 0.5 + wave(i, 2)), measuredAt },
      );
    }
    await prisma.bodyMetric.createMany({ data: rows });
    done.push(`${rows.length} тілесних вимірів`);
  }

  if (!(await prisma.wellbeingLog.count({ where: { userId } }))) {
    const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
    const rows = Array.from({ length: 28 }, (_, d) => ({
      userId,
      date: new Date(today.getTime() - (27 - d) * DAY),
      energy: clamp(3.4 + wave(d, 1.2)),
      sleepQuality: clamp(3.6 + wave(d + 2, 1.1)),
      sleepHours: Math.round((7.1 + wave(d + 1, 0.9)) * 2) / 2,
      mood: clamp(3.8 + wave(d + 3, 1)),
      digestion: clamp(4 + wave(d + 5, 0.8)),
    }));
    await prisma.wellbeingLog.createMany({ data: rows });
    done.push(`${rows.length} днів самопочуття`);
  }

  if (!(await prisma.userIntake.count({ where: { userId } }))) {
    const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);
    await prisma.userIntake.createMany({
      data: [
        { userId, type: IntakeType.SUPPLEMENT, name: 'Vitamin D3', dosageText: '2000 IU daily', startDate: daysAgo(240) },
        { userId, type: IntakeType.SUPPLEMENT, name: 'Omega-3', dosageText: '1 g daily', startDate: daysAgo(120) },
        {
          userId,
          type: IntakeType.SUPPLEMENT,
          name: 'Biotin',
          drugClassKey: 'biotin',
          dosageText: '5 mg daily',
          startDate: daysAgo(400),
          endDate: daysAgo(300),
        },
      ],
    });
    done.push('3 записи ліків/добавок');
  }

  return done;
}

async function main() {
  const categories = await seedCategories();
  const c = await seedCatalog(categories);
  await prisma.promInstrument.upsert({
    where: { slug: PHQ9.slug },
    update: {},
    create: { slug: PHQ9.slug, title: PHQ9.title, description: PHQ9.description, schema: PHQ9.schema },
  });
  console.log(
      `Каталог: ${categories.size} категорій, +${c.created} біомаркерів ` +
      `(усього ${CATALOG.length}, усі системні), ${c.translations} перекладів.\n` +
      `+1 PROM-опитувальник (PHQ-9).`,
  );

  const content = await seedContent();
  console.log(
      `Контент біомаркерів: ${content.upserts} записів (en/uk) upsert-нуто` +
      (content.skipped.length
          ? `, пропущено ${content.skipped.length} (немає в каталозі: ${content.skipped.join(', ')}).`
          : '.'),
  );
  if (content.noKeys.length) {
    console.warn(
        `УВАГА: без ключів таксономії (чипи систем/функцій не з'являться): ${content.noKeys.join(', ')}`,
    );
  }
  if (content.brokenLinks.length) {
    console.warn(
        `УВАГА: посилання на маркери, яких немає в каталозі — на фронті вони не стануть ` +
        `клікабельними:\n  ${content.brokenLinks.join('\n  ')}`,
    );
  }

  // Демо-дані пацієнта: тільки в реальний акаунт Neon Auth (SEED_USER_ID).
  // UserProfile створює сам сід (upsert), заходити в застосунок заздалегідь не треба.
  const p = await seedPatient();
  const skipped = p.panelsSkipped
      ? ` (${p.panelsSkipped} панелей уже існували — пропущено, дублів немає)`
      : '';
  console.log(
      `Пацієнт ${p.userId}: +${p.panelsCreated} панелей, ` +
      `+${p.resultsCreated} результатів на ${PATIENT_PANELS.length} дати${skipped}.\n` +
      `Обрано показників на дашборд: ${p.selected}.`,
  );

  if (process.env.SEED_DEMO_EXTRAS === 'true') {
    const extras = await seedDemoExtras(p.userId);
    console.log(`Демо-доповнення: ${extras.length ? extras.join(', ') : 'вже є, пропущено'}.`);
  }
}

main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());