import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ExternalLink,
  Info,
  Pill,
  TestTube,
  TrendingDown,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import { api, type MatchedIntake, type BiomarkerContent } from '@/lib/api';
import { Card } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  FunctionalIcon,
  SystemIcon,
  isBodySystemKey,
  isFunctionalTagKey,
  type BodySystemKey,
  type FunctionalTagKey,
} from '@/lib/taxonomy';

/** Рівень 2 — проза, що ховається в акордеон. */
const DETAIL_TEXT = ['whatItMeasures', 'roleInBody', 'influencingFactors'] as const;

/** Рівень 3 — довідкове, з власною іконкою на картку. */
const REFERENCE_CARDS = [
  { key: 'foodSources', icon: Utensils },
  { key: 'supplementsInfo', icon: Pill },
  { key: 'drugClassesInfo', icon: TestTube },
] as const;

/**
 * Довідкова інформація про показник — три рівні пріоритету.
 *
 *   1. Головне: вступ, чипи систем і функцій, картки низького/високого — видимі
 *      одразу, бо саме по них людина розуміє, навіщо їй цей показник.
 *   2. Деталі: проза в акордеоні.
 *   3. Довідкове: харчування, добавки, препарати, джерела — приглушено внизу.
 *
 * Дисклеймер стоїть ПЕРЕД усім: рамку освітнього матеріалу треба задати до
 * того, як людина почне читати про «низькі значення».
 */
export function BiomarkerContentSections({ slug }: { slug: string }) {
  const { t } = useTranslation();

  const { data: content, isLoading } = useQuery({
    queryKey: ['biomarker-content', slug],
    queryFn: () => api.biomarkerContent(slug),
  });

  // Каталог — щоб slug'и пов'язаних аналізів стали назвами: показувати
  // «total-cholesterol» замість «Загальний холестерин» означало б світити
  // внутрішній ідентифікатор.
  const { data: catalog } = useQuery({ queryKey: ['biomarkers'], queryFn: api.biomarkers });

  if (isLoading) return <p className="text-sm text-muted">{t('app.loading')}</p>;

  const c = normalize(content);

  if (!c || isEmpty(c)) {
    return (
      <Card className="p-10 text-center">
        <Info className="mx-auto mb-3 text-muted" />
        <p className="font-medium">{t('content.emptyTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('content.empty')}</p>
      </Card>
    );
  }

  const systems = c.relatedSystemKeys.filter(isBodySystemKey);
  const functional = c.functionalTagKeys.filter(isFunctionalTagKey);
  const details = DETAIL_TEXT.filter((k) => c[k]?.trim());
  const hasPrep = !!c.preparation?.trim();
  const links = ([['commonlyEvaluatedWith'], ['confirmatoryTests']] as const).flat();

  return (
    <div className="space-y-4">
      <p className="flex gap-2 rounded-2xl bg-primary-soft p-4 text-xs leading-relaxed text-primary-ink">
        <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>{t('content.disclaimer')}</span>
      </p>

      <IntakeNotice matched={content?.matchedIntakes ?? []} />

      {/* ── Рівень 1: головне ── */}
      {c.overview?.trim() && (
        <p className="text-[15px] leading-relaxed text-ink sm:text-base">{c.overview}</p>
      )}

      {systems.length > 0 && (
        <ChipRow
          title={t('content.relatedSystems')}
          caption={c.relatedSystems}
          chips={systems.map((k: BodySystemKey) => ({
            key: k,
            label: t(`systems.${k}`),
            icon: <SystemIcon name={k} />,
          }))}
          tone="system"
        />
      )}

      {functional.length > 0 && (
        <ChipRow
          title={t('content.functionalLinks')}
          caption={c.functionalLinks}
          chips={functional.map((k: FunctionalTagKey) => ({
            key: k,
            label: t(`functional.${k}`),
            icon: <FunctionalIcon name={k} />,
          }))}
          tone="functional"
        />
      )}

      {(c.lowMeaning?.trim() || c.highMeaning?.trim()) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {c.lowMeaning?.trim() && (
            <MeaningCard kind="low" title={t('content.lowMeaning')} text={c.lowMeaning} />
          )}
          {c.highMeaning?.trim() && (
            <MeaningCard kind="high" title={t('content.highMeaning')} text={c.highMeaning} />
          )}
        </div>
      )}

      {/* ── Рівень 2: деталі ── */}
      {(details.length > 0 || hasPrep || links.some((k) => c[k].length > 0)) && (
        <Card className="divide-y divide-line overflow-hidden">
          {details.map((k) => (
            <Accordion key={k} title={t(`content.${k}`)}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{c[k]}</p>
            </Accordion>
          ))}

          {hasPrep && (
            <Accordion title={t('content.preparation')}>
              <ul className="space-y-2">
                {splitSteps(c.preparation!).map((step) => (
                  <li key={step} className="flex gap-2 text-sm leading-relaxed text-ink">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span className="min-w-0">{step}</span>
                  </li>
                ))}
              </ul>
            </Accordion>
          )}

          {links.map((k) =>
            c[k].length > 0 ? (
              <Accordion key={k} title={t(`content.${k}`)}>
                <RelatedChips slugs={c[k]} catalog={catalog} />
              </Accordion>
            ) : null,
          )}
        </Card>
      )}

      {/* ── Рівень 3: довідкове, приглушене ── */}
      {REFERENCE_CARDS.some(({ key }) => c[key]?.trim()) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {REFERENCE_CARDS.map(({ key, icon: Icon }) =>
            c[key]?.trim() ? (
              <Card key={key} className="bg-paper p-4 shadow-none">
                <div className="mb-2 flex items-center gap-2 text-muted">
                  <Icon size={15} aria-hidden className="shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t(`content.${key}`)}
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{c[key]}</p>
              </Card>
            ) : null,
          )}
        </div>
      )}

      {c.medicalSources.length > 0 && (
        <Card className="bg-paper p-4 shadow-none">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            {t('content.medicalSources')}
          </p>
          <ul className="space-y-2">
            {c.medicalSources.map((src) => (
              <li key={src.url ?? src.title}>
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 text-sm text-primary hover:text-primary-ink"
                  >
                    <span className="min-w-0">{src.title}</span>
                    <ExternalLink size={13} className="mt-0.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  // Друковані настанови посилання не мають — лишаємо назвою.
                  <span className="text-sm text-ink">{src.title}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {c.lastReviewedAt && (
        <p className="text-xs text-muted">
          {t('content.reviewedAt', { date: fmtDate(c.lastReviewedAt) })}
        </p>
      )}
    </div>
  );
}

type Chip = { key: string; label: string; icon: React.ReactNode };

/** Ряд чипів із підписом-прозою під ним. */
function ChipRow({
  title,
  caption,
  chips,
  tone,
}: {
  title: string;
  caption: string | null;
  chips: Chip[];
  tone: 'system' | 'functional';
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            // Форма й колір різні для двох рядів, щоб їх не плутали між собою:
            // системи — заокруглені й нейтральні, функції — м'який акцент.
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium',
              tone === 'system'
                ? 'rounded-full bg-surface text-ink ring-1 ring-line'
                : 'rounded-lg bg-primary-soft text-primary-ink',
            )}
          >
            {chip.icon}
            {chip.label}
          </span>
        ))}
      </div>
      {caption?.trim() && <p className="mt-2 text-xs leading-relaxed text-muted">{caption}</p>}
    </div>
  );
}

/**
 * Картка «низьке» / «високе». Колір — не єдиний носій сенсу: поруч завжди є
 * і стрілка, і підпис словами.
 */
function MeaningCard({
  kind,
  title,
  text,
}: {
  kind: 'low' | 'high';
  title: string;
  text: string;
}) {
  const Icon = kind === 'low' ? TrendingDown : TrendingUp;
  return (
    <Card
      className={cn(
        'p-4',
        kind === 'low' ? 'bg-primary-soft/50' : 'bg-alert-soft/60',
      )}
    >
      <div
        className={cn(
          'mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide',
          kind === 'low' ? 'text-primary-ink' : 'text-alert',
        )}
      >
        <Icon size={15} aria-hidden className="shrink-0" />
        {title}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{text}</p>
    </Card>
  );
}

/** Чипи-посилання на інші показники. Нерозпізнаний slug не рендеримо взагалі. */
function RelatedChips({
  slugs,
  catalog,
}: {
  slugs: string[];
  catalog?: { slug: string; name: string }[];
}) {
  const { t } = useTranslation();
  const known = slugs
    .map((s) => catalog?.find((b) => b.slug === s))
    .filter((b): b is { slug: string; name: string } => !!b);

  // Каталог ще не приїхав або жоден slug не резолвиться — краще нічого, ніж
  // биті посилання.
  if (known.length === 0) return <p className="text-sm text-muted">{t('content.noLinks')}</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {known.map((b) => (
        <Link
          key={b.slug}
          to={`/b/${b.slug}`}
          aria-label={b.name}
          className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors hover:bg-primary hover:text-white"
        >
          {b.name}
        </Link>
      ))}
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
      >
        <span className="min-w-0 text-sm font-medium">{title}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Підготовку показуємо чек-листом. Ділимо по крапці з комою або переносу —
 * автор пише її саме так; якщо роздільників немає, лишається один пункт, і це
 * теж коректний вигляд.
 */
function splitSteps(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Приводить відповідь до повної форми.
 *
 * Персистований кеш живе в localStorage і переживає деплої: запис, збережений
 * до появи нового поля, повернеться без нього — і будь-яке звернення до
 * `.length` на такому масиві впаде. Саме так сторінка й падала після додавання
 * relatedSystemKeys: запиту на сервер не було взагалі, дані прийшли з диска.
 *
 * Тому нормалізуємо ОДИН раз на вході, а не латаємо кожне звернення: наступне
 * додане поле інакше повторить ту саму історію.
 */
function normalize(raw: unknown): BiomarkerContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;

  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  /**
   * Текстове поле. Масив теж приймаємо й склеюємо: до переходу на прозу ці
   * поля були Json-масивами, і в кешах вони ще лежать саме так — краще
   * показати склеєний перелік, ніж загубити дані або впасти на .trim().
   */
  const str = (v: unknown): string | null => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join('; ') || null;
    return null;
  };

  return {
    locale: typeof c.locale === 'string' ? c.locale : '',
    overview: str(c.overview),
    whatItMeasures: str(c.whatItMeasures),
    roleInBody: str(c.roleInBody),
    relatedSystems: str(c.relatedSystems),
    functionalLinks: str(c.functionalLinks),
    relatedSystemKeys: arr<string>(c.relatedSystemKeys),
    functionalTagKeys: arr<string>(c.functionalTagKeys),
    lowMeaning: str(c.lowMeaning),
    highMeaning: str(c.highMeaning),
    influencingFactors: str(c.influencingFactors),
    preparation: str(c.preparation),
    commonlyEvaluatedWith: arr<string>(c.commonlyEvaluatedWith),
    confirmatoryTests: arr<string>(c.confirmatoryTests),
    foodSources: str(c.foodSources),
    supplementsInfo: str(c.supplementsInfo),
    drugClassesInfo: str(c.drugClassesInfo),
    // Джерела мають структуру — лишаємо лише те, що на неї схоже.
    medicalSources: arr<{ title?: unknown; url?: unknown }>(c.medicalSources)
      .filter((s) => s && typeof s.title === 'string')
      .map((s) => ({
        title: s.title as string,
        url: typeof s.url === 'string' ? s.url : undefined,
      })),
    lastReviewedAt: typeof c.lastReviewedAt === 'string' ? c.lastReviewedAt : null,
    reviewedBy: typeof c.reviewedBy === 'string' ? c.reviewedBy : null,
  };
}

/** Порожній контент — це коли нема жодного заповненого поля. */
function isEmpty(c: BiomarkerContent): boolean {
  const text = [
    c.overview,
    c.whatItMeasures,
    c.roleInBody,
    c.relatedSystems,
    c.functionalLinks,
    c.lowMeaning,
    c.highMeaning,
    c.influencingFactors,
    c.preparation,
    c.foodSources,
    c.supplementsInfo,
    c.drugClassesInfo,
  ].some((v) => v?.trim());
  const lists =
    c.relatedSystemKeys.length ||
    c.functionalTagKeys.length ||
    c.commonlyEvaluatedWith.length ||
    c.confirmatoryTests.length ||
    c.medicalSources.length;
  return !text && !lists;
}

/**
 * Освітня плашка: людина приймає щось із класу, від якого цей показник може
 * залежати.
 *
 * Формулювання навмисно описове й БЕЗ порад: ми не пишемо ні дозувань, ні
 * «припиніть/почніть». Єдина дія, яку плашка пропонує, — обговорити з лікарем.
 * Це фіксація факту, який людина сама ж і внесла, поруч із її показником.
 *
 * Не показуємо нічого, якщо збігів немає: плашка «на вас ніщо не впливає» —
 * шум, а не інформація.
 */
function IntakeNotice({ matched }: { matched: MatchedIntake[] }) {
  const { t } = useTranslation();
  if (!matched.length) return null;

  const names = matched.map((m) => m.name).join(', ');
  return (
    <div className="flex gap-2 rounded-2xl bg-caution-soft p-4 text-xs leading-relaxed text-caution">
      <Pill size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t('intakes.noticeTitle', { names })}</p>
        {/* Пояснення, ЧОМУ клас впливає, уже є нижче окремою секцією
            «Класи препаратів, що можуть впливати» — дублювати його тут
            означало б двічі показати той самий абзац на одному екрані. */}
        <p>{t('intakes.noticeDiscuss')}</p>
      </div>
    </div>
  );
}
