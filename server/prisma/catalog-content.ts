/**
 * Структурований довідковий контент біомаркерів (EN — канон, UK — переклад).
 *
 * Джерело істини для полів BiomarkerContent. Прив'язка до маркера — за slug
 * (той самий, що в catalog.ts). Сід НЕ створює копій маркерів: він лише
 * upsert-ить контент у наявні біомаркери за (biomarkerId, locale).
 *
 * ВАЖЛИВО ЩОДО БЕЗПЕКИ КОНТЕНТУ:
 *  — це освітня інформація, НЕ діагноз і НЕ призначення лікування;
 *  — формулювання описові («може бути пов'язано з…»), без наказового способу;
 *  — про добавки та класи препаратів — лише загально, без доз і без порад
 *    починати/припиняти прийом. Рішення — завжди за лікарем.
 *
 * commonlyEvaluatedWith / confirmatoryTests — це slug'и НАЯВНИХ у каталозі
 * маркерів (щоб фронт міг зробити клікабельні посилання). Клінічно доречні
 * тести, яких ще немає в каталозі, свідомо НЕ додаємо сюди як slug — щоб не
 * плодити «биті» посилання; за потреби згадуй їх у прозі відповідного поля.
 *
 * Останню перевірку контенту (lastReviewedAt) став датою фактичного рев'ю.
 */

export type Locale = 'en' | 'uk';

export type ContentSource = { title: string; url?: string };

export type BiomarkerInfoContent = {
    /** Що це за показник (загальний опис). */
    overview?: string;
    /** Що саме він вимірює. */
    whatItMeasures?: string;
    /** Яку роль виконує в організмі. */
    roleInBody?: string;
    /** З якими системами організму пов'язаний. */
    relatedSystems?: string;
    /** Зв'язок з енергією, сном, витривалістю, метаболізмом тощо. */
    functionalLinks?: string;
    /** Що може означати низьке значення (описово, не діагноз). */
    lowMeaning?: string;
    /** Що може означати високе значення (описово, не діагноз). */
    highMeaning?: string;
    /** Фактори, що можуть впливати на результат. */
    influencingFactors?: string;
    /** Як підготуватися до здавання аналізу. */
    preparation?: string;
    /** Які аналізи часто оцінюють разом (slug'и наявних маркерів). */
    commonlyEvaluatedWith?: string[];
    /** Які аналізи можуть уточнити результат (slug'и наявних маркерів). */
    confirmatoryTests?: string[];
    /** Харчові джерела речовини (де це доречно). */
    foodSources?: string;
    /** Загальна інформація про добавки (без доз, без призначень). */
    supplementsInfo?: string;
    /** Загальна інформація про класи препаратів, що можуть впливати на показник. */
    drugClassesInfo?: string;
    /** Медичні джерела. */
    medicalSources?: ContentSource[];
    /** Дата останньої перевірки контенту (YYYY-MM-DD). */
    lastReviewedAt?: string;
};

export type LocalizedBiomarkerContent = Partial<Record<Locale, BiomarkerInfoContent>>;

/**
 * Дисклеймер показуємо над блоком контенту незалежно від маркера.
 *
 * УВАГА: цей рядок НЕ рендериться. Те, що бачить користувач, лежить у
 * client/src/i18n (ключ `content.disclaimer`) — бо це текст інтерфейсу, який
 * має перемикатися разом з мовою. Тут він лишається орієнтиром для авторів
 * контенту: правити для показу треба саме словники, інакше два тексти
 * розійдуться, а розходження в дисклеймері — найгірше місце для розбіжностей.
 */
export const CONTENT_DISCLAIMER: Record<Locale, string> = {
    en:
        'This is educational information, not medical advice. It is not a diagnosis and ' +
        'does not replace consultation with a clinician. Do not start, stop, or change any ' +
        'supplement or medication without professional guidance.',
    uk:
        'Це освітня інформація, а не медична порада. Вона не є діагнозом і не замінює ' +
        'консультацію лікаря. Не починайте, не припиняйте й не змінюйте прийом добавок ' +
        'чи ліків без консультації з фахівцем.',
};

const REVIEWED = '2026-07-20';

// Часто вживані джерела — щоб не дублювати рядки.
const SRC = {
    medlineThyroidAb: {
        title: 'Thyroid Antibodies — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/thyroid-antibodies/',
    },
    medlineTSH: {
        title: 'TSH (Thyroid-Stimulating Hormone) Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/',
    },
    medlineT4: {
        title: 'T4 Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/t4-test/',
    },
    medlineT3: {
        title: 'T3 Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/t3-test/',
    },
    medlineB12: {
        title: 'Vitamin B12 Level — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/vitamin-b12-level/',
    },
    medlineFerritin: {
        title: 'Ferritin Blood Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/ferritin-blood-test/',
    },
    medlineCholesterol: {
        title: 'Cholesterol Levels — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/cholesterollevelswhatyouneedtoknow.html',
    },
    medlineGlucose: {
        title: 'Blood Glucose Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/',
    },
    medlineA1c: {
        title: 'Hemoglobin A1c (HbA1c) Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/',
    },
    medlineTestosterone: {
        title: 'Testosterone Levels Test — MedlinePlus (NIH)',
        url: 'https://medlineplus.gov/lab-tests/testosterone-levels-test/',
    },
    whoFerritin: {
        title: 'WHO Guideline on Use of Ferritin Concentrations to Assess Iron Status (2020)',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK569877/',
    },
    endoTestosterone: {
        title: 'Endocrine Society — Testosterone Therapy for Hypogonadism (Clinical Practice Guideline)',
        url: 'https://www.endocrine.org/clinical-practice-guidelines/testosterone-therapy',
    },
    escEas2019: {
        title: 'ESC/EAS 2019 Guidelines for the Management of Dyslipidaemias',
        url: 'https://www.escardio.org/Guidelines',
    },
    adaStandards: {
        title: 'American Diabetes Association — Standards of Care in Diabetes',
        url: 'https://diabetesjournals.org/care',
    },
    vitDConsensusUA: {
        title:
            'Діагностика, профілактика та лікування дефіциту вітаміну D у дорослих: ' +
            'Консенсус українських експертів, 2023',
    },
} satisfies Record<string, ContentSource>;

export const CATALOG_CONTENT: Record<string, LocalizedBiomarkerContent> = {
    // ─────────────── Щитоподібна залоза ───────────────
    tsh: {
        en: {
            overview:
                'Thyroid-stimulating hormone (TSH) is the main screening test of thyroid function.',
            whatItMeasures:
                'The amount of TSH produced by the pituitary gland to regulate the thyroid.',
            roleInBody:
                'TSH signals the thyroid to produce T4 and T3; the pituitary raises or lowers it via feedback to keep thyroid hormones stable.',
            relatedSystems: 'Endocrine system; hypothalamic–pituitary–thyroid (HPT) axis.',
            functionalLinks:
                'Thyroid hormones set the pace of metabolism, so thyroid balance is linked to energy, body temperature, weight regulation, mood, and heart rate.',
            lowMeaning:
                'A low TSH can be seen when thyroid hormone levels are high (an overactive thyroid pattern) or with certain medications; interpretation depends on T4/T3.',
            highMeaning:
                'A high TSH often reflects an underactive thyroid pattern, where the pituitary works harder to stimulate the gland; it is interpreted together with T4.',
            influencingFactors:
                'Time of day, acute illness, pregnancy, biotin supplements (assay interference), and thyroid or steroid medications can shift the value.',
            preparation:
                'No fasting required. Stop high-dose biotin supplements a couple of days before testing if advised, as biotin can distort results.',
            commonlyEvaluatedWith: ['free-t4', 'free-t3', 'anti-tpo'],
            confirmatoryTests: ['free-t4', 'free-t3', 'anti-tpo', 'tsh-receptor-ab'],
            drugClassesInfo:
                'Thyroid hormone replacement, antithyroid drugs, corticosteroids, dopamine agonists, and some others can influence TSH.',
            medicalSources: [SRC.medlineTSH],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview:
                'Тиреотропний гормон (ТТГ) — основний скринінговий показник роботи щитоподібної залози.',
            whatItMeasures:
                'Кількість ТТГ, який виробляє гіпофіз для регуляції щитоподібної залози.',
            roleInBody:
                'ТТГ дає щитоподібній залозі сигнал виробляти Т4 і Т3; гіпофіз підвищує або знижує його за принципом зворотного зв\'язку, щоб рівень гормонів був стабільним.',
            relatedSystems: 'Ендокринна система; вісь гіпоталамус–гіпофіз–щитоподібна залоза.',
            functionalLinks:
                'Гормони щитоподібної залози задають темп обміну речовин, тож її баланс пов\'язаний з енергією, температурою тіла, регуляцією ваги, настроєм і частотою серцебиття.',
            lowMeaning:
                'Низький ТТГ трапляється, коли рівень гормонів щитоподібної залози підвищений, або на тлі деяких ліків; трактується разом із Т4/Т3.',
            highMeaning:
                'Підвищений ТТГ часто відображає знижену активність щитоподібної залози, коли гіпофіз працює інтенсивніше; оцінюється разом із Т4.',
            influencingFactors:
                'Час доби, гостре захворювання, вагітність, добавки біотину (вплив на методику) та тиреоїдні чи стероїдні ліки можуть змінювати значення.',
            preparation:
                'Натще не потрібно. Високі дози біотину варто відмінити за кілька днів до аналізу (за порадою лікаря), бо біотин може спотворювати результат.',
            commonlyEvaluatedWith: ['free-t4', 'free-t3', 'anti-tpo'],
            confirmatoryTests: ['free-t4', 'free-t3', 'anti-tpo', 'tsh-receptor-ab'],
            drugClassesInfo:
                'На ТТГ можуть впливати замісні гормони щитоподібної залози, антитиреоїдні препарати, кортикостероїди, агоністи дофаміну та деякі інші.',
            medicalSources: [SRC.medlineTSH],
            lastReviewedAt: REVIEWED,
        },
    },
    'free-t4': {
        en: {
            overview: 'Free thyroxine (Free T4) is the unbound, active fraction of the main thyroid hormone.',
            whatItMeasures: 'The portion of T4 circulating free (not bound to proteins) and available to tissues.',
            roleInBody: 'T4 is converted in tissues to the more active T3 and helps set overall metabolic rate.',
            relatedSystems: 'Endocrine system; HPT axis.',
            functionalLinks: 'Influences energy, body temperature, weight, and cardiovascular activity.',
            lowMeaning: 'A low Free T4 with a high TSH fits an underactive-thyroid pattern.',
            highMeaning: 'A high Free T4 with a low TSH fits an overactive-thyroid pattern.',
            influencingFactors: 'Acute illness, pregnancy, biotin (assay interference), and thyroid medications.',
            preparation: 'No fasting required; pause high-dose biotin if advised.',
            commonlyEvaluatedWith: ['tsh', 'free-t3'],
            confirmatoryTests: ['tsh', 'free-t3', 'anti-tpo'],
            medicalSources: [SRC.medlineT4],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Вільний тироксин (Т4 вільний) — незв\'язана, активна частка основного гормону щитоподібної залози.',
            whatItMeasures: 'Частку Т4, яка циркулює у вільному стані (не зв\'язана з білками) і доступна тканинам.',
            roleInBody: 'Т4 у тканинах перетворюється на активніший Т3 і допомагає задавати загальний темп обміну речовин.',
            relatedSystems: 'Ендокринна система; вісь гіпоталамус–гіпофіз–щитоподібна залоза.',
            functionalLinks: 'Впливає на енергію, температуру тіла, вагу та роботу серцево-судинної системи.',
            lowMeaning: 'Низький Т4 вільний із високим ТТГ відповідає патерну зниженої функції щитоподібної залози.',
            highMeaning: 'Високий Т4 вільний із низьким ТТГ відповідає патерну підвищеної функції щитоподібної залози.',
            influencingFactors: 'Гостре захворювання, вагітність, біотин (вплив на методику) та тиреоїдні ліки.',
            preparation: 'Натще не потрібно; високі дози біотину — відмінити за порадою лікаря.',
            commonlyEvaluatedWith: ['tsh', 'free-t3'],
            confirmatoryTests: ['tsh', 'free-t3', 'anti-tpo'],
            medicalSources: [SRC.medlineT4],
            lastReviewedAt: REVIEWED,
        },
    },
    'free-t3': {
        en: {
            overview: 'Free triiodothyronine (Free T3) is the unbound, biologically most active thyroid hormone.',
            whatItMeasures: 'The free (available) fraction of T3 in the blood.',
            roleInBody: 'T3 acts directly on cells to regulate metabolic rate; most T3 is produced by converting T4 in tissues.',
            relatedSystems: 'Endocrine system; HPT axis.',
            functionalLinks: 'Closely tied to energy expenditure, heart rate, and body temperature.',
            lowMeaning: 'Can be reduced in an underactive-thyroid pattern or during acute non-thyroidal illness.',
            highMeaning: 'Can be elevated in an overactive-thyroid pattern.',
            influencingFactors: 'Illness (non-thyroidal illness syndrome), fasting, and biotin (assay interference).',
            preparation: 'No fasting required; pause high-dose biotin if advised.',
            commonlyEvaluatedWith: ['tsh', 'free-t4'],
            confirmatoryTests: ['tsh', 'free-t4'],
            medicalSources: [SRC.medlineT3],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Вільний трийодтиронін (Т3 вільний) — незв\'язаний, біологічно найактивніший гормон щитоподібної залози.',
            whatItMeasures: 'Вільну (доступну) частку Т3 у крові.',
            roleInBody: 'Т3 діє безпосередньо на клітини й регулює темп обміну; більшість Т3 утворюється з Т4 у тканинах.',
            relatedSystems: 'Ендокринна система; вісь гіпоталамус–гіпофіз–щитоподібна залоза.',
            functionalLinks: 'Тісно пов\'язаний із витратами енергії, частотою серцебиття й температурою тіла.',
            lowMeaning: 'Може знижуватися при патерні зниженої функції щитоподібної залози або при гострих нетиреоїдних станах.',
            highMeaning: 'Може підвищуватися при патерні підвищеної функції щитоподібної залози.',
            influencingFactors: 'Захворювання (синдром нетиреоїдної патології), голодування та біотин (вплив на методику).',
            preparation: 'Натще не потрібно; високі дози біотину — відмінити за порадою лікаря.',
            commonlyEvaluatedWith: ['tsh', 'free-t4'],
            confirmatoryTests: ['tsh', 'free-t4'],
            medicalSources: [SRC.medlineT3],
            lastReviewedAt: REVIEWED,
        },
    },
    'anti-tpo': {
        en: {
            overview: 'Thyroid peroxidase antibodies (anti-TPO) are markers of thyroid autoimmunity.',
            whatItMeasures: 'Antibodies directed against thyroid peroxidase, an enzyme used to make thyroid hormones.',
            roleInBody: 'Anti-TPO is not a normal body substance; its presence signals an immune response against thyroid tissue.',
            relatedSystems: 'Immune and endocrine systems; thyroid.',
            functionalLinks: 'Autoimmune thyroid activity can, over time, affect thyroid hormone output and thus metabolism and energy.',
            lowMeaning: 'A negative/low result means significant anti-TPO autoimmunity was not detected.',
            highMeaning: 'Elevated anti-TPO is commonly associated with Hashimoto’s thyroiditis and can also occur in Graves’ disease; it is interpreted with TSH and T4.',
            influencingFactors: 'Presence of other autoimmune conditions; levels can be positive years before thyroid hormones change.',
            preparation: 'No special preparation; no fasting required.',
            commonlyEvaluatedWith: ['tsh', 'free-t4', 'anti-tg'],
            confirmatoryTests: ['tsh', 'free-t4', 'anti-tg', 'tsh-receptor-ab'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Антитіла до тиреопероксидази (АТПО) — маркер аутоімунного процесу в щитоподібній залозі.',
            whatItMeasures: 'Антитіла проти тиреопероксидази — ферменту, потрібного для синтезу гормонів щитоподібної залози.',
            roleInBody: 'АТПО не є нормальною речовиною організму; їхня наявність свідчить про імунну реакцію проти тканини щитоподібної залози.',
            relatedSystems: 'Імунна та ендокринна системи; щитоподібна залоза.',
            functionalLinks: 'Аутоімунна активність із часом може впливати на вироблення гормонів щитоподібної залози, а отже на обмін речовин і енергію.',
            lowMeaning: 'Негативний/низький результат означає, що значущої АТПО-аутоімунності не виявлено.',
            highMeaning: 'Підвищений АТПО часто асоціюється з тиреоїдитом Хашимото, трапляється й при хворобі Грейвса; трактується разом із ТТГ і Т4.',
            influencingFactors: 'Наявність інших аутоімунних станів; антитіла можуть бути позитивними за роки до зміни рівня гормонів.',
            preparation: 'Спеціальної підготовки не потрібно; натще не обов\'язково.',
            commonlyEvaluatedWith: ['tsh', 'free-t4', 'anti-tg'],
            confirmatoryTests: ['tsh', 'free-t4', 'anti-tg', 'tsh-receptor-ab'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
    },
    'anti-tg': {
        en: {
            overview: 'Thyroglobulin antibodies (anti-Tg) are another marker of thyroid autoimmunity.',
            whatItMeasures: 'Antibodies against thyroglobulin, a protein the thyroid uses to store hormone precursors.',
            roleInBody: 'Their presence reflects an immune response toward thyroid tissue.',
            relatedSystems: 'Immune and endocrine systems; thyroid.',
            functionalLinks: 'Part of the autoimmune picture that can influence long-term thyroid function.',
            lowMeaning: 'A negative/low result means significant anti-Tg autoimmunity was not detected.',
            highMeaning: 'Elevated anti-Tg is associated with Hashimoto’s thyroiditis and is also relevant when interpreting thyroglobulin measurements.',
            influencingFactors: 'Can be detectable in a small share of healthy people; often assessed alongside anti-TPO.',
            preparation: 'No special preparation; no fasting required.',
            commonlyEvaluatedWith: ['anti-tpo', 'tsh', 'free-t4'],
            confirmatoryTests: ['anti-tpo', 'tsh'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Антитіла до тиреоглобуліну (АТТГ) — ще один маркер аутоімунного процесу в щитоподібній залозі.',
            whatItMeasures: 'Антитіла проти тиреоглобуліну — білка, у якому щитоподібна залоза зберігає попередники гормонів.',
            roleInBody: 'Їхня наявність відображає імунну реакцію щодо тканини щитоподібної залози.',
            relatedSystems: 'Імунна та ендокринна системи; щитоподібна залоза.',
            functionalLinks: 'Частина аутоімунної картини, що може впливати на функцію щитоподібної залози в довгостроковій перспективі.',
            lowMeaning: 'Негативний/низький результат означає, що значущої АТТГ-аутоімунності не виявлено.',
            highMeaning: 'Підвищений АТТГ асоціюється з тиреоїдитом Хашимото і важливий при трактуванні рівня тиреоглобуліну.',
            influencingFactors: 'Може виявлятися в невеликої частки здорових людей; часто оцінюється разом з АТПО.',
            preparation: 'Спеціальної підготовки не потрібно; натще не обов\'язково.',
            commonlyEvaluatedWith: ['anti-tpo', 'tsh', 'free-t4'],
            confirmatoryTests: ['anti-tpo', 'tsh'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
    },
    'tsh-receptor-ab': {
        en: {
            overview: 'TSH-receptor antibodies (TRAb, stimulating) target the receptor the thyroid uses to sense TSH.',
            whatItMeasures: 'Antibodies that bind the TSH receptor; stimulating forms can drive the thyroid to overproduce hormones.',
            roleInBody: 'Their presence points to autoimmune activity at the TSH receptor.',
            relatedSystems: 'Immune and endocrine systems; thyroid.',
            functionalLinks: 'Stimulating antibodies can accelerate metabolism, heart rate, and energy turnover when thyroid output rises.',
            lowMeaning: 'A negative/low result makes receptor-driven autoimmune stimulation unlikely.',
            highMeaning: 'Elevated stimulating TRAb is characteristic of Graves’ disease and is interpreted with TSH and T4/T3.',
            influencingFactors: 'Assay generation and timing relative to treatment can affect interpretation.',
            preparation: 'No special preparation; no fasting required.',
            commonlyEvaluatedWith: ['tsh', 'free-t4', 'free-t3'],
            confirmatoryTests: ['tsh', 'free-t4', 'free-t3', 'anti-tpo'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Антитіла до рецептора ТТГ (АТ-р-ТТГ, стимулюючі) спрямовані на рецептор, яким щитоподібна залоза «зчитує» ТТГ.',
            whatItMeasures: 'Антитіла, що зв\'язуються з рецептором ТТГ; стимулюючі форми можуть спонукати залозу до надвиробництва гормонів.',
            roleInBody: 'Їхня наявність вказує на аутоімунну активність на рівні рецептора ТТГ.',
            relatedSystems: 'Імунна та ендокринна системи; щитоподібна залоза.',
            functionalLinks: 'Стимулюючі антитіла можуть прискорювати обмін речовин, частоту серцебиття й енерговитрати, коли вироблення гормонів зростає.',
            lowMeaning: 'Негативний/низький результат робить рецептор-опосередковану аутоімунну стимуляцію малоймовірною.',
            highMeaning: 'Підвищені стимулюючі АТ-р-ТТГ характерні для хвороби Грейвса; трактуються разом із ТТГ і Т4/Т3.',
            influencingFactors: 'На трактування впливають покоління тест-системи та час відносно лікування.',
            preparation: 'Спеціальної підготовки не потрібно; натще не обов\'язково.',
            commonlyEvaluatedWith: ['tsh', 'free-t4', 'free-t3'],
            confirmatoryTests: ['tsh', 'free-t4', 'free-t3', 'anti-tpo'],
            medicalSources: [SRC.medlineThyroidAb],
            lastReviewedAt: REVIEWED,
        },
    },

    // ─────────────── Вітаміни / мінерали / залізо ───────────────
    'vitamin-d': {
        en: {
            overview: '25-hydroxyvitamin D is the standard blood marker of vitamin D status.',
            whatItMeasures: 'The circulating storage form of vitamin D, reflecting supply from sun, food, and supplements.',
            roleInBody: 'Vitamin D supports calcium absorption and bone health and has broad roles in immune function.',
            relatedSystems: 'Skeletal, endocrine, and immune systems; calcium metabolism.',
            functionalLinks: 'Adequate vitamin D is associated with bone strength and muscle function; deficiency is often discussed alongside fatigue, though causes of fatigue are many.',
            lowMeaning: 'Lower values indicate insufficiency or deficiency of vitamin D stores.',
            highMeaning: 'Very high values can reflect excessive supplementation and, at extremes, a risk of toxicity.',
            influencingFactors: 'Season, sun exposure, skin tone, latitude, body weight, malabsorption, and supplement use.',
            preparation: 'No fasting required.',
            commonlyEvaluatedWith: ['ionized-calcium', 'magnesium'],
            confirmatoryTests: ['ionized-calcium'],
            foodSources: 'Fatty fish (salmon, mackerel, sardines), egg yolk, and fortified foods; sunlight lets skin synthesize vitamin D.',
            supplementsInfo: 'Vitamin D (D3 or D2) is a common supplement; dosing and target levels are individualized and best set with a clinician, especially at high doses.',
            drugClassesInfo: 'Some anticonvulsants, glucocorticoids, and certain weight-loss or lipid-binding agents can lower vitamin D levels.',
            medicalSources: [SRC.vitDConsensusUA],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: '25-гідроксивітамін D — стандартний показник забезпеченості організму вітаміном D.',
            whatItMeasures: 'Депонуючу форму вітаміну D у крові, що відображає надходження від сонця, їжі та добавок.',
            roleInBody: 'Вітамін D підтримує всмоктування кальцію й здоров\'я кісток, а також має широкі функції в роботі імунітету.',
            relatedSystems: 'Кісткова, ендокринна та імунна системи; обмін кальцію.',
            functionalLinks: 'Достатній рівень вітаміну D пов\'язують із міцністю кісток і функцією м\'язів; дефіцит часто згадують поряд із втомою, хоча причин втоми багато.',
            lowMeaning: 'Нижчі значення свідчать про недостатність або дефіцит запасів вітаміну D.',
            highMeaning: 'Дуже високі значення можуть відображати надмірний прийом добавок, а на екстремумах — ризик токсичності.',
            influencingFactors: 'Пора року, перебування на сонці, тип шкіри, широта, маса тіла, порушення всмоктування та прийом добавок.',
            preparation: 'Натще не потрібно.',
            commonlyEvaluatedWith: ['ionized-calcium', 'magnesium'],
            confirmatoryTests: ['ionized-calcium'],
            foodSources: 'Жирна риба (лосось, скумбрія, сардини), яєчний жовток і збагачені продукти; під дією сонця шкіра синтезує вітамін D.',
            supplementsInfo: 'Вітамін D (D3 або D2) — поширена добавка; доза й цільовий рівень індивідуальні, їх краще узгоджувати з лікарем, особливо у високих дозах.',
            drugClassesInfo: 'Деякі протисудомні, глюкокортикоїди та окремі засоби для схуднення чи зв\'язування ліпідів можуть знижувати рівень вітаміну D.',
            medicalSources: [SRC.vitDConsensusUA],
            lastReviewedAt: REVIEWED,
        },
    },
    'vitamin-b12': {
        en: {
            overview: 'Vitamin B12 (cobalamin) is essential for red blood cells and the nervous system.',
            whatItMeasures: 'The amount of B12 circulating in the blood, reflecting recent intake and stores.',
            roleInBody: 'B12 is needed for red blood cell formation, DNA synthesis, and healthy nerve function.',
            relatedSystems: 'Hematologic (blood), nervous, and digestive systems.',
            functionalLinks: 'Low B12 can be linked to tiredness and reduced stamina because of its role in red blood cell production and energy metabolism.',
            lowMeaning: 'Low B12 may reflect inadequate intake or absorption and can be associated with certain anemias and neurological symptoms.',
            highMeaning: 'High values are often related to supplementation; markedly high results without supplements may prompt further evaluation.',
            influencingFactors: 'Diet (especially plant-based diets), absorption disorders, older age, and some medications.',
            preparation: 'Follow lab instructions; some labs prefer testing before taking B12 supplements that day.',
            commonlyEvaluatedWith: ['hemoglobin', 'mcv', 'ferritin'],
            confirmatoryTests: ['mcv', 'hemoglobin'],
            foodSources: 'Meat, fish, eggs, and dairy; plant foods generally lack B12, so fortified foods matter for vegetarians and vegans.',
            supplementsInfo: 'B12 is available as oral supplements or injections; the form and route depend on the cause of low levels and are chosen with a clinician.',
            drugClassesInfo: 'Long-term metformin and acid-reducing drugs (proton-pump inhibitors, H2 blockers) can lower B12 over time.',
            medicalSources: [SRC.medlineB12],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Вітамін B12 (ціанокобаламін) необхідний для утворення еритроцитів і роботи нервової системи.',
            whatItMeasures: 'Кількість B12 у крові, що відображає нещодавнє надходження та запаси.',
            roleInBody: 'B12 потрібен для утворення еритроцитів, синтезу ДНК і здорової роботи нервів.',
            relatedSystems: 'Кровотворна, нервова та травна системи.',
            functionalLinks: 'Низький B12 можна пов\'язати з утомою та зниженою витривалістю через його роль в утворенні еритроцитів і енергетичному обміні.',
            lowMeaning: 'Низький B12 може свідчити про недостатнє надходження чи всмоктування й асоціюється з деякими анеміями та неврологічними симптомами.',
            highMeaning: 'Високі значення часто пов\'язані з прийомом добавок; помітно високий результат без добавок може потребувати додаткового обстеження.',
            influencingFactors: 'Раціон (особливо рослинний), порушення всмоктування, старший вік і деякі ліки.',
            preparation: 'Дотримуйтесь інструкцій лабораторії; частина лабораторій радить здавати до прийому добавки B12 того дня.',
            commonlyEvaluatedWith: ['hemoglobin', 'mcv', 'ferritin'],
            confirmatoryTests: ['mcv', 'hemoglobin'],
            foodSources: 'М\'ясо, риба, яйця та молочні продукти; рослинна їжа зазвичай не містить B12, тож для вегетаріанців і веганів важливі збагачені продукти.',
            supplementsInfo: 'B12 буває у формі пігулок або ін\'єкцій; форму й спосіб прийому обирають з лікарем залежно від причини дефіциту.',
            drugClassesInfo: 'Тривалий прийом метформіну та засобів, що знижують кислотність (інгібітори протонної помпи, H2-блокатори), може з часом знижувати B12.',
            medicalSources: [SRC.medlineB12],
            lastReviewedAt: REVIEWED,
        },
    },
    ferritin: {
        en: {
            overview: 'Ferritin reflects the body’s iron stores and is a key test for iron status.',
            whatItMeasures: 'The amount of the iron-storage protein ferritin in the blood, which mirrors stored iron.',
            roleInBody: 'Ferritin stores iron in a safe, usable form; iron is needed to carry oxygen in red blood cells.',
            relatedSystems: 'Hematologic system; iron metabolism; also an acute-phase (inflammation) marker.',
            functionalLinks: 'Low iron stores are commonly linked to fatigue and reduced exercise tolerance because iron supports oxygen delivery.',
            lowMeaning: 'A low ferritin is a specific sign of depleted iron stores; the WHO uses a threshold below 15 µg/L in apparently healthy adults, though many labs and clinicians use higher cut-offs.',
            highMeaning: 'A high ferritin can reflect iron overload but also rises with inflammation, infection, liver conditions, or heavy alcohol use, so context matters.',
            influencingFactors: 'Inflammation and recent illness can raise ferritin independently of iron; menstrual blood loss and diet lower it.',
            preparation: 'No fasting generally required; testing during acute illness can inflate the value.',
            commonlyEvaluatedWith: ['hemoglobin', 'mcv', 'rbc'],
            confirmatoryTests: ['hemoglobin', 'mcv', 'rdw-cv'],
            foodSources: 'Iron from red meat, liver, and seafood (heme iron) is well absorbed; legumes, tofu, and leafy greens provide non-heme iron, aided by vitamin C.',
            supplementsInfo: 'Oral iron is a common way to rebuild stores when they are low; dose, form, and duration are set with a clinician, as excess iron can be harmful.',
            drugClassesInfo: 'Acid-reducing drugs can reduce iron absorption; iron supplements and repeated transfusions raise iron stores.',
            medicalSources: [SRC.whoFerritin, SRC.medlineFerritin],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Феритин відображає запаси заліза в організмі й є ключовим показником залізного статусу.',
            whatItMeasures: 'Кількість білка-депо феритину в крові, що віддзеркалює запасене залізо.',
            roleInBody: 'Феритин зберігає залізо в безпечній, придатній до використання формі; залізо потрібне для перенесення кисню еритроцитами.',
            relatedSystems: 'Кровотворна система; обмін заліза; також маркер гострої фази (запалення).',
            functionalLinks: 'Низькі запаси заліза часто пов\'язують з утомою та зниженою переносимістю навантажень, бо залізо забезпечує доставку кисню.',
            lowMeaning: 'Низький феритин — специфічна ознака виснаження запасів заліза; ВООЗ використовує поріг нижче 15 мкг/л у здорових дорослих, хоча багато лабораторій і лікарів застосовують вищі межі.',
            highMeaning: 'Високий феритин може відображати перевантаження залізом, але також зростає при запаленні, інфекції, хворобах печінки чи вживанні алкоголю — тож важливий контекст.',
            influencingFactors: 'Запалення й нещодавнє захворювання можуть підвищувати феритин незалежно від заліза; менструальна крововтрата й раціон його знижують.',
            preparation: 'Зазвичай натще не обов\'язково; аналіз під час гострого захворювання може завищити значення.',
            commonlyEvaluatedWith: ['hemoglobin', 'mcv', 'rbc'],
            confirmatoryTests: ['hemoglobin', 'mcv', 'rdw-cv'],
            foodSources: 'Залізо з червоного м\'яса, печінки та морепродуктів (гемове) добре засвоюється; бобові, тофу й листова зелень дають негемове залізо, засвоєнню якого сприяє вітамін C.',
            supplementsInfo: 'Пероральне залізо — поширений спосіб відновити низькі запаси; дозу, форму й тривалість визначають з лікарем, бо надлишок заліза шкідливий.',
            drugClassesInfo: 'Засоби, що знижують кислотність, можуть погіршувати всмоктування заліза; препарати заліза й повторні трансфузії підвищують його запаси.',
            medicalSources: [SRC.whoFerritin, SRC.medlineFerritin],
            lastReviewedAt: REVIEWED,
        },
    },

    // ─────────────── Статеві гормони ───────────────
    'total-testosterone': {
        en: {
            overview: 'Total testosterone measures the main male sex hormone, both bound and free.',
            whatItMeasures: 'The total amount of testosterone in blood, most of it bound to proteins.',
            roleInBody: 'Testosterone supports muscle and bone mass, libido, mood, and red blood cell production.',
            relatedSystems: 'Endocrine and reproductive systems; the hypothalamic–pituitary–gonadal axis.',
            functionalLinks: 'Often discussed in relation to energy, motivation, strength, and mood, though these are influenced by many factors.',
            lowMeaning: 'Low readings can reflect low testosterone, but a single result is not enough; guidelines advise confirming with a repeat morning fasting sample.',
            highMeaning: 'High readings may relate to supplementation or other endocrine causes and are interpreted with the clinical picture.',
            influencingFactors: 'Testosterone peaks in the morning and is lowered by food, glucose, acute illness, poor sleep, and overtraining.',
            preparation: 'Sample is best taken in the morning after an overnight fast; repeat testing is standard before conclusions.',
            commonlyEvaluatedWith: ['free-testosterone', 'lh', 'fsh', 'estradiol', 'prolactin'],
            confirmatoryTests: ['free-testosterone', 'lh', 'fsh'],
            supplementsInfo: 'Over-the-counter “testosterone boosters” have limited evidence; medically supervised testosterone therapy is a prescription decision, not a supplement.',
            drugClassesInfo: 'Opioids, glucocorticoids, some hormonal agents, and anabolic steroid use can lower or distort testosterone readings.',
            medicalSources: [SRC.endoTestosterone, SRC.medlineTestosterone],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Загальний тестостерон вимірює основний чоловічий статевий гормон — і зв\'язаний, і вільний.',
            whatItMeasures: 'Загальну кількість тестостерону в крові, більшість якого зв\'язана з білками.',
            roleInBody: 'Тестостерон підтримує м\'язову й кісткову масу, лібідо, настрій та утворення еритроцитів.',
            relatedSystems: 'Ендокринна й репродуктивна системи; вісь гіпоталамус–гіпофіз–гонади.',
            functionalLinks: 'Часто обговорюється у зв\'язку з енергією, мотивацією, силою та настроєм, хоча на них впливає багато чинників.',
            lowMeaning: 'Низькі значення можуть відображати знижений тестостерон, але одного результату недостатньо; рекомендації радять підтвердити повторним ранковим аналізом натще.',
            highMeaning: 'Високі значення можуть бути пов\'язані з прийомом препаратів або іншими ендокринними причинами й трактуються з урахуванням клінічної картини.',
            influencingFactors: 'Тестостерон найвищий вранці й знижується від їжі, глюкози, гострого захворювання, поганого сну та перетренованості.',
            preparation: 'Кров краще здавати вранці натще; для висновків стандартно роблять повторний аналіз.',
            commonlyEvaluatedWith: ['free-testosterone', 'lh', 'fsh', 'estradiol', 'prolactin'],
            confirmatoryTests: ['free-testosterone', 'lh', 'fsh'],
            supplementsInfo: 'Безрецептурні «бустери тестостерону» мають обмежену доказову базу; медично контрольована терапія тестостероном — це рецептурне рішення, а не добавка.',
            drugClassesInfo: 'Опіоїди, глюкокортикоїди, деякі гормональні засоби та вживання анаболічних стероїдів можуть знижувати чи спотворювати результат.',
            medicalSources: [SRC.endoTestosterone, SRC.medlineTestosterone],
            lastReviewedAt: REVIEWED,
        },
    },
    'free-testosterone': {
        en: {
            overview: 'Free testosterone is the fraction of testosterone not bound to proteins and readily active.',
            whatItMeasures: 'The small, unbound portion of testosterone available to tissues.',
            roleInBody: 'Represents the biologically active testosterone acting on target cells.',
            relatedSystems: 'Endocrine and reproductive systems.',
            functionalLinks: 'Useful when protein levels (SHBG) are altered, which can affect how total testosterone is interpreted.',
            lowMeaning: 'A low free fraction may be informative when total testosterone is borderline.',
            highMeaning: 'Interpreted with total testosterone and the clinical picture.',
            influencingFactors: 'Sex hormone–binding globulin levels, time of day, illness, and the calculation/assay method used.',
            preparation: 'Morning sampling is preferred, as with total testosterone.',
            commonlyEvaluatedWith: ['total-testosterone', 'lh', 'fsh'],
            confirmatoryTests: ['total-testosterone'],
            medicalSources: [SRC.endoTestosterone],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Вільний тестостерон — частка тестостерону, не зв\'язана з білками й одразу активна.',
            whatItMeasures: 'Невелику незв\'язану частку тестостерону, доступну тканинам.',
            roleInBody: 'Відображає біологічно активний тестостерон, що діє на клітини-мішені.',
            relatedSystems: 'Ендокринна й репродуктивна системи.',
            functionalLinks: 'Корисний, коли змінений рівень зв\'язувального білка (ГЗСГ), що впливає на трактування загального тестостерону.',
            lowMeaning: 'Низька вільна частка може бути інформативною, коли загальний тестостерон межовий.',
            highMeaning: 'Трактується разом із загальним тестостероном і клінічною картиною.',
            influencingFactors: 'Рівень глобуліну, що зв\'язує статеві гормони, час доби, захворювання та метод розрахунку/аналізу.',
            preparation: 'Бажано здавати вранці, як і загальний тестостерон.',
            commonlyEvaluatedWith: ['total-testosterone', 'lh', 'fsh'],
            confirmatoryTests: ['total-testosterone'],
            medicalSources: [SRC.endoTestosterone],
            lastReviewedAt: REVIEWED,
        },
    },

    // ─────────────── Ліпідограма ───────────────
    'total-cholesterol': {
        en: {
            overview: 'Total cholesterol is the overall amount of cholesterol carried in the blood.',
            whatItMeasures: 'The sum of cholesterol across all lipoprotein particles (LDL, HDL, and others).',
            roleInBody: 'Cholesterol is a building block for cell membranes, hormones, and vitamin D.',
            relatedSystems: 'Cardiovascular and metabolic systems.',
            functionalLinks: 'Part of long-term cardiovascular risk assessment rather than day-to-day symptoms.',
            lowMeaning: 'Very low values are uncommon and usually interpreted in context.',
            highMeaning: 'Higher total cholesterol, especially driven by LDL, is associated with greater cardiovascular risk over time.',
            influencingFactors: 'Diet, physical activity, genetics, thyroid status, and some medications.',
            preparation: 'A full lipid panel is often measured; fasting may be requested by your lab or clinician.',
            commonlyEvaluatedWith: ['ldl', 'hdl', 'triglycerides', 'non-hdl'],
            confirmatoryTests: ['ldl', 'non-hdl'],
            foodSources: 'Dietary patterns rich in fiber, unsaturated fats, and low in trans fats support healthier lipid levels.',
            drugClassesInfo: 'Lipid-lowering drug classes (e.g., statins and others) are used to manage elevated cholesterol under medical care.',
            medicalSources: [SRC.escEas2019, SRC.medlineCholesterol],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Загальний холестерин — сумарна кількість холестерину, що переноситься кров\'ю.',
            whatItMeasures: 'Суму холестерину в усіх ліпопротеїнових частинках (ЛПНЩ, ЛПВЩ та інших).',
            roleInBody: 'Холестерин — будівельний матеріал для клітинних мембран, гормонів і вітаміну D.',
            relatedSystems: 'Серцево-судинна й метаболічна системи.',
            functionalLinks: 'Частина оцінки довгострокового серцево-судинного ризику, а не щоденних симптомів.',
            lowMeaning: 'Дуже низькі значення трапляються нечасто й трактуються в контексті.',
            highMeaning: 'Вищий загальний холестерин, особливо за рахунок ЛПНЩ, з часом асоціюється з більшим серцево-судинним ризиком.',
            influencingFactors: 'Раціон, фізична активність, генетика, стан щитоподібної залози та деякі ліки.',
            preparation: 'Зазвичай вимірюють повну ліпідограму; лабораторія чи лікар можуть попросити здати натще.',
            commonlyEvaluatedWith: ['ldl', 'hdl', 'triglycerides', 'non-hdl'],
            confirmatoryTests: ['ldl', 'non-hdl'],
            foodSources: 'Раціон, багатий на клітковину й ненасичені жири та бідний на трансжири, сприяє здоровішому ліпідному профілю.',
            drugClassesInfo: 'Гіполіпідемічні класи препаратів (наприклад, статини та інші) застосовують під наглядом лікаря при підвищеному холестерині.',
            medicalSources: [SRC.escEas2019, SRC.medlineCholesterol],
            lastReviewedAt: REVIEWED,
        },
    },
    ldl: {
        en: {
            overview: 'LDL cholesterol (“low-density lipoprotein”) is the main target for cardiovascular risk.',
            whatItMeasures: 'Cholesterol carried by LDL particles, which can deposit in artery walls.',
            roleInBody: 'LDL delivers cholesterol to tissues; excess is linked to plaque buildup.',
            relatedSystems: 'Cardiovascular system.',
            functionalLinks: 'A long-term risk marker rather than a source of immediate symptoms.',
            lowMeaning: 'Lower LDL is generally favorable for cardiovascular risk.',
            highMeaning: 'Higher LDL is associated with greater risk of atherosclerosis and cardiovascular events over time; targets depend on overall risk.',
            influencingFactors: 'Diet, genetics, physical activity, thyroid status, and medications.',
            preparation: 'Follow your lab’s fasting guidance for the lipid panel.',
            commonlyEvaluatedWith: ['total-cholesterol', 'hdl', 'triglycerides', 'non-hdl'],
            confirmatoryTests: ['non-hdl', 'chol-hdl-ratio'],
            foodSources: 'Reducing saturated and trans fats and increasing soluble fiber can help lower LDL.',
            drugClassesInfo: 'Statins and other lipid-lowering agents specifically target LDL under medical supervision.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Холестерин ЛПНЩ («ліпопротеїни низької щільності») — головна мішень в оцінці серцево-судинного ризику.',
            whatItMeasures: 'Холестерин у частинках ЛПНЩ, які можуть відкладатися у стінках артерій.',
            roleInBody: 'ЛПНЩ доставляє холестерин до тканин; надлишок пов\'язують із формуванням бляшок.',
            relatedSystems: 'Серцево-судинна система.',
            functionalLinks: 'Маркер довгострокового ризику, а не джерело негайних симптомів.',
            lowMeaning: 'Нижчий ЛПНЩ загалом сприятливий щодо серцево-судинного ризику.',
            highMeaning: 'Вищий ЛПНЩ асоціюється з більшим ризиком атеросклерозу й серцево-судинних подій із часом; цільові значення залежать від загального ризику.',
            influencingFactors: 'Раціон, генетика, фізична активність, стан щитоподібної залози та ліки.',
            preparation: 'Дотримуйтесь вказівок лабораторії щодо здавання ліпідограми натще.',
            commonlyEvaluatedWith: ['total-cholesterol', 'hdl', 'triglycerides', 'non-hdl'],
            confirmatoryTests: ['non-hdl', 'chol-hdl-ratio'],
            foodSources: 'Зменшення насичених і трансжирів та більше розчинної клітковини допомагають знижувати ЛПНЩ.',
            drugClassesInfo: 'Статини та інші гіполіпідемічні засоби цілеспрямовано знижують ЛПНЩ під наглядом лікаря.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
    },
    hdl: {
        en: {
            overview: 'HDL cholesterol (“high-density lipoprotein”) is often called the “good” cholesterol.',
            whatItMeasures: 'Cholesterol carried by HDL particles, which help remove cholesterol from tissues.',
            roleInBody: 'HDL transports excess cholesterol back to the liver for processing.',
            relatedSystems: 'Cardiovascular system.',
            functionalLinks: 'Higher HDL is generally associated with lower cardiovascular risk, within context.',
            lowMeaning: 'Low HDL is associated with higher cardiovascular risk.',
            highMeaning: 'Higher HDL is generally favorable, though very high values are interpreted cautiously.',
            influencingFactors: 'Physical activity, smoking, alcohol, genetics, and metabolic health.',
            preparation: 'Measured as part of the lipid panel; follow fasting guidance if given.',
            commonlyEvaluatedWith: ['total-cholesterol', 'ldl', 'triglycerides', 'chol-hdl-ratio'],
            confirmatoryTests: ['chol-hdl-ratio', 'non-hdl'],
            foodSources: 'Regular physical activity and unsaturated fats (e.g., olive oil, nuts) are associated with healthier HDL.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Холестерин ЛПВЩ («ліпопротеїни високої щільності») часто називають «хорошим» холестерином.',
            whatItMeasures: 'Холестерин у частинках ЛПВЩ, які допомагають виводити холестерин із тканин.',
            roleInBody: 'ЛПВЩ переносить надлишок холестерину назад до печінки для переробки.',
            relatedSystems: 'Серцево-судинна система.',
            functionalLinks: 'Вищий ЛПВЩ загалом асоціюється з нижчим серцево-судинним ризиком, з урахуванням контексту.',
            lowMeaning: 'Низький ЛПВЩ асоціюється з вищим серцево-судинним ризиком.',
            highMeaning: 'Вищий ЛПВЩ загалом сприятливий, хоча дуже високі значення трактують обережно.',
            influencingFactors: 'Фізична активність, куріння, алкоголь, генетика й метаболічне здоров\'я.',
            preparation: 'Вимірюють у складі ліпідограми; дотримуйтесь вказівок щодо здавання натще.',
            commonlyEvaluatedWith: ['total-cholesterol', 'ldl', 'triglycerides', 'chol-hdl-ratio'],
            confirmatoryTests: ['chol-hdl-ratio', 'non-hdl'],
            foodSources: 'Регулярна фізична активність і ненасичені жири (оливкова олія, горіхи) асоціюються зі здоровішим ЛПВЩ.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
    },
    triglycerides: {
        en: {
            overview: 'Triglycerides are the main type of fat carried in the blood for energy.',
            whatItMeasures: 'The concentration of triglyceride fats in the blood.',
            roleInBody: 'Triglycerides store and transport energy from food between meals.',
            relatedSystems: 'Metabolic and cardiovascular systems.',
            functionalLinks: 'Levels respond strongly to recent meals, alcohol, and carbohydrate intake.',
            lowMeaning: 'Low values are usually not a concern on their own.',
            highMeaning: 'High triglycerides are associated with metabolic and cardiovascular risk and, when very high, with pancreatitis risk.',
            influencingFactors: 'Recent meals, alcohol, refined carbohydrates, weight, and blood sugar control.',
            preparation: 'Fasting (often 9–12 hours) is commonly requested because recent food raises triglycerides.',
            commonlyEvaluatedWith: ['total-cholesterol', 'ldl', 'hdl', 'glucose'],
            confirmatoryTests: ['vldl', 'non-hdl'],
            foodSources: 'Limiting alcohol, sugar, and refined carbs and increasing omega-3 fats are associated with lower triglycerides.',
            drugClassesInfo: 'Fibrates, omega-3 preparations, and other agents may be used medically when triglycerides are high.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Тригліцериди — основний тип жирів, що переноситься кров\'ю для енергії.',
            whatItMeasures: 'Концентрацію тригліцеридних жирів у крові.',
            roleInBody: 'Тригліцериди зберігають і транспортують енергію з їжі між прийомами їжі.',
            relatedSystems: 'Метаболічна й серцево-судинна системи.',
            functionalLinks: 'Рівень сильно залежить від нещодавніх прийомів їжі, алкоголю та вуглеводів.',
            lowMeaning: 'Низькі значення самі по собі зазвичай не викликають занепокоєння.',
            highMeaning: 'Високі тригліцериди асоціюються з метаболічним і серцево-судинним ризиком, а за дуже високих значень — із ризиком панкреатиту.',
            influencingFactors: 'Нещодавня їжа, алкоголь, рафіновані вуглеводи, вага й контроль цукру крові.',
            preparation: 'Часто просять здавати натще (нерідко 9–12 годин), бо нещодавня їжа підвищує тригліцериди.',
            commonlyEvaluatedWith: ['total-cholesterol', 'ldl', 'hdl', 'glucose'],
            confirmatoryTests: ['vldl', 'non-hdl'],
            foodSources: 'Обмеження алкоголю, цукру й рафінованих вуглеводів та більше омега-3 асоціюються з нижчими тригліцеридами.',
            drugClassesInfo: 'При високих тригліцеридах медично можуть застосовувати фібрати, препарати омега-3 та інші засоби.',
            medicalSources: [SRC.escEas2019],
            lastReviewedAt: REVIEWED,
        },
    },

    // ─────────────── Вуглеводний обмін ───────────────
    glucose: {
        en: {
            overview: 'Fasting glucose measures blood sugar after an overnight fast.',
            whatItMeasures: 'The concentration of glucose in the blood at the time of the draw.',
            roleInBody: 'Glucose is a primary fuel for cells; insulin keeps it in a healthy range.',
            relatedSystems: 'Metabolic and endocrine systems.',
            functionalLinks: 'Blood sugar swings can be felt as changes in energy and concentration; stable control supports steady energy.',
            lowMeaning: 'Low glucose (hypoglycemia) can cause shakiness, sweating, and low energy and is evaluated in context.',
            highMeaning: 'Higher fasting glucose can fall in prediabetes or diabetes ranges and is confirmed with repeat and additional testing.',
            influencingFactors: 'Recent food, stress, illness, physical activity, and some medications.',
            preparation: 'Typically requires fasting (often 8+ hours); water is usually allowed.',
            commonlyEvaluatedWith: ['hba1c', 'hba1c-ifcc', 'eag', 'triglycerides'],
            confirmatoryTests: ['hba1c', 'hba1c-ifcc'],
            foodSources: 'Balanced meals with fiber, protein, and fewer refined carbohydrates support steadier glucose.',
            drugClassesInfo: 'Glucocorticoids and some other drugs can raise glucose; glucose-lowering medications lower it.',
            medicalSources: [SRC.adaStandards, SRC.medlineGlucose],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Глюкоза натще вимірює цукор крові після нічного голодування.',
            whatItMeasures: 'Концентрацію глюкози в крові на момент забору.',
            roleInBody: 'Глюкоза — основне пальне для клітин; інсулін утримує її в здоровому діапазоні.',
            relatedSystems: 'Метаболічна й ендокринна системи.',
            functionalLinks: 'Коливання цукру можуть відчуватися як зміни енергії та концентрації; стабільний контроль підтримує рівну енергію.',
            lowMeaning: 'Низька глюкоза (гіпоглікемія) може спричиняти тремтіння, пітливість і занепад сил; оцінюється в контексті.',
            highMeaning: 'Вища глюкоза натще може потрапляти в діапазон предіабету чи діабету й підтверджується повторним і додатковим обстеженням.',
            influencingFactors: 'Нещодавня їжа, стрес, захворювання, фізична активність і деякі ліки.',
            preparation: 'Зазвичай потрібне голодування (часто 8+ годин); воду переважно можна.',
            commonlyEvaluatedWith: ['hba1c', 'hba1c-ifcc', 'eag', 'triglycerides'],
            confirmatoryTests: ['hba1c', 'hba1c-ifcc'],
            foodSources: 'Збалансовані страви з клітковиною, білком і меншою кількістю рафінованих вуглеводів сприяють стабільнішій глюкозі.',
            drugClassesInfo: 'Глюкокортикоїди та деякі інші ліки можуть підвищувати глюкозу; цукрознижувальні препарати її знижують.',
            medicalSources: [SRC.adaStandards, SRC.medlineGlucose],
            lastReviewedAt: REVIEWED,
        },
    },
    hba1c: {
        en: {
            overview: 'Hemoglobin A1c reflects average blood sugar over roughly the past 2–3 months.',
            whatItMeasures: 'The share of hemoglobin with glucose attached, which tracks longer-term glucose exposure.',
            roleInBody: 'It gives a longer-term view of glucose control than a single fasting sample.',
            relatedSystems: 'Metabolic and endocrine systems.',
            functionalLinks: 'Reflects sustained glucose patterns rather than momentary energy shifts.',
            lowMeaning: 'Low values are usually reassuring but interpreted alongside any symptoms of low blood sugar.',
            highMeaning: 'Higher A1c can fall in prediabetes or diabetes ranges and guides long-term monitoring.',
            influencingFactors: 'Conditions affecting red blood cell lifespan (e.g., anemia, recent blood loss) can distort A1c.',
            preparation: 'No fasting required; can be drawn at any time of day.',
            commonlyEvaluatedWith: ['glucose', 'hba1c-ifcc', 'eag'],
            confirmatoryTests: ['glucose', 'hba1c-ifcc'],
            drugClassesInfo: 'Glucose-lowering medications reduce A1c over time; glucocorticoids may raise it.',
            medicalSources: [SRC.adaStandards, SRC.medlineA1c],
            lastReviewedAt: REVIEWED,
        },
        uk: {
            overview: 'Глікований гемоглобін (HbA1c) відображає середній цукор крові приблизно за останні 2–3 місяці.',
            whatItMeasures: 'Частку гемоглобіну зі зв\'язаною глюкозою, що відображає довший вплив глюкози.',
            roleInBody: 'Дає довшу картину контролю глюкози, ніж один аналіз натще.',
            relatedSystems: 'Метаболічна й ендокринна системи.',
            functionalLinks: 'Відображає стійкі патерни глюкози, а не миттєві коливання енергії.',
            lowMeaning: 'Низькі значення зазвичай втішні, але трактуються разом із будь-якими симптомами низького цукру.',
            highMeaning: 'Вищий HbA1c може потрапляти в діапазон предіабету чи діабету й скеровує довгостроковий моніторинг.',
            influencingFactors: 'Стани, що впливають на тривалість життя еритроцитів (анемія, нещодавня крововтрата), можуть спотворювати HbA1c.',
            preparation: 'Натще не потрібно; можна здавати будь-коли впродовж дня.',
            commonlyEvaluatedWith: ['glucose', 'hba1c-ifcc', 'eag'],
            confirmatoryTests: ['glucose', 'hba1c-ifcc'],
            drugClassesInfo: 'Цукрознижувальні препарати з часом знижують HbA1c; глюкокортикоїди можуть його підвищувати.',
            medicalSources: [SRC.adaStandards, SRC.medlineA1c],
            lastReviewedAt: REVIEWED,
        },
    },
};