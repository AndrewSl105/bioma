import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import { api, type BiomarkerContent } from '@/lib/api';
import { Card } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Ключі контенту в порядку читання: від «що це» до джерел. */
const TEXT_SECTIONS = [
  'overview',
  'whatItMeasures',
  'roleInBody',
  // Прозові поля: автор описує їх реченням, а не переліком.
  'relatedSystems',
  'functionalLinks',
  'lowMeaning',
  'highMeaning',
  'influencingFactors',
  'preparation',
  'foodSources',
  'supplementsInfo',
  'drugClassesInfo',
] as const;

/** Переліки аналізів — рендеряться посиланнями, якщо це відомі slug'и. */
const LINK_SECTIONS = ['commonlyEvaluatedWith', 'confirmatoryTests'] as const;

/**
 * Довідкова інформація про показник.
 *
 * Секції згорнуті: разом це довгий текст, і розгорнутим він відсунув би
 * графік та історію — те, заради чого сторінку відкривають найчастіше.
 *
 * Дисклеймер завжди розгорнутий і стоїть ПЕРЕД контентом: це освітній
 * матеріал, і рамку треба задати до того, як людина почне читати про
 * «низькі значення».
 */
export function BiomarkerContentSections({ slug }: { slug: string }) {
  const { t } = useTranslation();

  const { data: content } = useQuery({
    queryKey: ['biomarker-content', slug],
    queryFn: () => api.biomarkerContent(slug),
  });

  // Каталог потрібен, щоб перетворити slug'и пов'язаних аналізів на назви:
  // показувати користувачу «total-cholesterol» замість «Загальний холестерин»
  // означало б світити внутрішній ідентифікатор.
  const { data: catalog } = useQuery({ queryKey: ['biomarkers'], queryFn: api.biomarkers });

  // Перевіряємо не лише наявність, а й форму: persist-кеш лежить у
  // localStorage і переживає зміни коду (buster прив'язаний до версії пакета),
  // тож із попередніх збірок тут могло осісти щось іншої форми.
  if (!content || Array.isArray(content) || typeof content !== 'object') return null;

  const sections = buildSections(content);
  if (sections.length === 0 && content.medicalSources.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="text-sm font-medium">{t('content.title')}</h2>
        <p className="mt-2 flex gap-2 rounded-xl bg-primary-soft p-3 text-xs leading-relaxed text-primary-ink">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>{t('content.disclaimer')}</span>
        </p>
      </div>

      <div className="mt-3 divide-y divide-line">
        {sections.map((s) => (
          <Section key={s.key} title={t(`content.${s.key}`)}>
            {s.kind === 'text' && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{s.value}</p>
            )}

            {s.kind === 'links' && (
              <div className="flex flex-wrap gap-2">
                {s.items.map((item) => {
                  const known = catalog?.find((b) => b.slug === item);
                  return known ? (
                    <Link
                      key={item}
                      to={`/b/${known.slug}`}
                      className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors hover:bg-primary hover:text-white"
                    >
                      {known.name}
                    </Link>
                  ) : (
                    // Невідомий показник лишається текстом: у переліку
                    // допускається вільний ввід для того, чого ще немає в каталозі.
                    <span key={item} className="rounded-full bg-paper px-3 py-1.5 text-xs text-muted">
                      {item}
                    </span>
                  );
                })}
              </div>
            )}
          </Section>
        ))}

        {content.medicalSources.length > 0 && (
          <Section title={t('content.medicalSources')}>
            <ul className="space-y-2">
              {content.medicalSources.map((src) => (
                <li key={src.url ?? src.title}>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 text-sm text-primary hover:text-primary-ink"
                    >
                      <span className="min-w-0">{src.title}</span>
                      <ExternalLink size={13} className="mt-0.5 shrink-0" />
                    </a>
                  ) : (
                    // Друковані настанови посилання не мають — лишаємо назвою.
                    <span className="text-sm text-ink">{src.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {content.lastReviewedAt && (
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          {t('content.reviewedAt', { date: fmtDate(content.lastReviewedAt) })}
        </p>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-paper"
      >
        <span className="min-w-0 text-sm font-medium">{title}</span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

type Section =
  | { key: string; kind: 'text'; value: string }
  | { key: string; kind: 'links'; items: string[] };

/** Порожні секції не показуємо: контент наповнюється поступово. */
function buildSections(c: BiomarkerContent): Section[] {
  const out: Section[] = [];

  const order = [
    'overview',
    'whatItMeasures',
    'roleInBody',
    'relatedSystems',
    'functionalLinks',
    'lowMeaning',
    'highMeaning',
    'influencingFactors',
    'preparation',
    'commonlyEvaluatedWith',
    'confirmatoryTests',
    'foodSources',
    'supplementsInfo',
    'drugClassesInfo',
  ] as const;

  for (const key of order) {
    if ((TEXT_SECTIONS as readonly string[]).includes(key)) {
      const value = c[key as (typeof TEXT_SECTIONS)[number]];
      if (value?.trim()) out.push({ key, kind: 'text', value });
    } else if ((LINK_SECTIONS as readonly string[]).includes(key)) {
      const items = c[key as (typeof LINK_SECTIONS)[number]];
      if (items?.length) out.push({ key, kind: 'links', items });
    }
  }

  return out;
}
