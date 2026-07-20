import type { BodySystemKey, DrugClassKey, FunctionalTagKey } from '../src/biomarkers/taxonomy';

/**
 * Ключі таксономії для наявного контенту.
 *
 * Окремо від catalog-content.ts свідомо: ключі мовно-незалежні, а контент там
 * розкладений по локалях — тримати їх усередині означало б дублювати той самий
 * перелік у en та uk і давати їм розійтися. Сід проставляє ці ключі в ОБИДВІ
 * локалі одного slug.
 *
 * Значення виведені з прози relatedSystems / functionalLinks того ж маркера,
 * а не вигадані: якщо в тексті сказано «Імунна та ендокринна системи», тут
 * стоїть саме immune + endocrine.
 */
export type ContentTaxonomy = {
  systems?: BodySystemKey[];
  functional?: FunctionalTagKey[];
  /**
   * Класи препаратів, від яких показник може залежати.
   *
   * Виведені з ТОГО, ЩО ВЖЕ НАПИСАНО в drugClassesInfo та influencingFactors
   * цього ж маркера, а не додані на здогад: якщо в тексті ТТГ сказано про
   * замісні гормони, антитиреоїдні, кортикостероїди й біотин — тут стоять
   * саме вони. Порожньо там, де контент про вплив ліків мовчить.
   */
  drugClasses?: DrugClassKey[];
};

export const CONTENT_TAXONOMY: Record<string, ContentTaxonomy> = {
  // Щитоподібна залоза: вісь гіпоталамус–гіпофіз–щитоподібна.
  tsh: {
    systems: ['endocrine'],
    functional: ['energy', 'metabolism'],
    // drugClassesInfo ТТГ: замісні гормони, антитиреоїдні, кортикостероїди;
    // біотин — з influencingFactors (вплив на методику імуноаналізу).
    drugClasses: ['thyroid_hormone', 'antithyroid', 'glucocorticoid', 'biotin'],
  },
  'free-t4': {
    systems: ['endocrine'],
    functional: ['energy', 'metabolism'],
    drugClasses: ['thyroid_hormone', 'antithyroid', 'biotin'],
  },
  'free-t3': {
    systems: ['endocrine'],
    functional: ['energy', 'metabolism', 'endurance'],
    drugClasses: ['thyroid_hormone', 'antithyroid', 'biotin'],
  },

  // Антитіла — аутоімунна складова поверх ендокринної.
  'anti-tpo': { systems: ['immune', 'endocrine'], functional: ['immunity', 'metabolism'] },
  'anti-tg': { systems: ['immune', 'endocrine'], functional: ['immunity', 'metabolism'] },
  'tsh-receptor-ab': {
    systems: ['immune', 'endocrine'],
    functional: ['immunity', 'metabolism', 'energy'],
  },

  // Вітаміни.
  'vitamin-d': {
    systems: ['skeletal', 'endocrine', 'immune'],
    functional: ['bone', 'immunity'],
    // «Деякі протисудомні, глюкокортикоїди…» — із drugClassesInfo маркера.
    drugClasses: ['glucocorticoid'],
  },
  'vitamin-b12': {
    systems: ['hematologic', 'nervous', 'digestive'],
    functional: ['energy', 'endurance', 'cognition'],
    // «Тривалий метформін і засоби, що знижують кислотність (ІПП, H2)…»
    drugClasses: ['metformin', 'ppi', 'h2_blocker'],
  },

  // Обмін заліза; феритин ще й маркер гострої фази — звідси immune.
  ferritin: {
    systems: ['hematologic', 'metabolic', 'immune'],
    functional: ['energy', 'endurance'],
  },

  // Андрогени.
  'total-testosterone': {
    systems: ['endocrine', 'reproductive'],
    functional: ['energy', 'mood', 'endurance'],
  },
  'free-testosterone': { systems: ['endocrine', 'reproductive'], functional: ['energy', 'mood'] },

  // Ліпідограма — це про довгостроковий ризик, а не про щоденне самопочуття,
  // тож функціональних тегів свідомо небагато.
  'total-cholesterol': { systems: ['cardiovascular', 'metabolic'], functional: ['metabolism'] },
  ldl: { systems: ['cardiovascular'], functional: ['metabolism'] },
  hdl: { systems: ['cardiovascular'], functional: ['metabolism'] },
  triglycerides: { systems: ['metabolic', 'cardiovascular'], functional: ['metabolism'] },

  // Вуглеводний обмін.
  glucose: {
    systems: ['metabolic', 'endocrine'],
    functional: ['energy', 'metabolism', 'cognition'],
  },
  hba1c: { systems: ['metabolic', 'endocrine'], functional: ['metabolism'] },
};
