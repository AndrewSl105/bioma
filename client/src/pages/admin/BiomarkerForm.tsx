import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import {
  api,
  type AdminBiomarker,
  type BiomarkerContent,
  type BiomarkerContentInput,
  type BiomarkerInput,
  type ReferenceRangeInput,
  type Sex,
} from '@/lib/api';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import {
  BODY_SYSTEM_KEYS,
  FUNCTIONAL_TAG_KEYS,
  FunctionalIcon,
  SystemIcon,
  isBodySystemKey,
  isFunctionalTagKey,
} from '@/lib/taxonomy';
import { cn } from '@/lib/cn';

type Tab = 'main' | 'ranges' | 'content';

/**
 * Створення й редагування біомаркера.
 *
 * Три вкладки, а не одна довга форма: полів разом із контентом майже сорок,
 * і на мобільному суцільна стрічка перетворюється на нескінченний скрол.
 *
 * Контент зберігається ОКРЕМИМ запитом на локаль (PUT .../content/:locale),
 * бо це окремий ресурс — і при редагуванні маркера його не можна відправити
 * разом з основними полями.
 */
export function BiomarkerForm({
  biomarker,
  onClose,
}: {
  biomarker: AdminBiomarker | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('main');
  const isEdit = !!biomarker;

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  // ── основне ──
  const [name, setName] = useState(biomarker?.canonicalName ?? '');
  const [shortName, setShortName] = useState(biomarker?.canonicalShort ?? '');
  const [unit, setUnit] = useState(biomarker?.unit ?? '');
  const [categoryId, setCategoryId] = useState(biomarker?.category?.id ?? '');
  const [precision, setPrecision] = useState(String(biomarker?.precision ?? 2));
  const [loincCode, setLoincCode] = useState(biomarker?.loincCode ?? '');
  const [isActive, setIsActive] = useState(biomarker?.isActive ?? true);
  const [names, setNames] = useState<Record<string, { name: string; shortName: string }>>(() =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map((l) => {
        const tr = (biomarker?.translations ?? []).find((x) => x.locale === l);
        return [l, { name: tr?.name ?? '', shortName: tr?.shortName ?? '' }];
      }),
    ),
  );

  // ── референси ──
  const [ranges, setRanges] = useState<ReferenceRangeInput[]>(
    () => (biomarker?.referenceRanges ?? []).map(({ id: _id, unit: _u, ...r }) => r),
  );

  // ── контент ──
  const [contentLocale, setContentLocale] = useState<string>(SUPPORTED_LOCALES[0]);
  // Суфікс 'all' обов'язковий: сторінка показника тримає під ключем
  // ['biomarker-content', slug] ОДИН об'єкт контенту, а тут лежить масив по
  // локалях. React Query кешує лише за ключем — без суфікса адмін, відкривши
  // форму й перейшовши потім на /b/:slug, дістав би з кешу масив замість
  // об'єкта і сторінка впала б. Інвалідація за коротким ключем однаково
  // накриває обидва: вона зіставляє префікс.
  const { data: allContent } = useQuery({
    queryKey: ['biomarker-content', biomarker?.slug, 'all'],
    queryFn: () => api.allBiomarkerContent(biomarker!.slug),
    enabled: isEdit,
  });

  const save = useMutation({
    mutationFn: async (body: BiomarkerInput) => {
      const saved = isEdit
        ? await api.updateBiomarker(biomarker.slug, body)
        : await api.createBiomarker(body);
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
  });

  function submit() {
    save.mutate({
      name: name.trim(),
      shortName: shortName.trim() || null,
      unit: unit.trim(),
      categoryId: categoryId || null,
      precision: Number(precision) || 0,
      loincCode: loincCode.trim() || null,
      isActive,
      translations: SUPPORTED_LOCALES.filter((l) => names[l]?.name.trim()).map((l) => ({
        locale: l,
        name: names[l].name.trim(),
        shortName: names[l].shortName.trim() || null,
      })),
      referenceRanges: ranges,
    });
  }

  const canSubmit = name.trim() !== '' && unit.trim() !== '';

  const TABS: { key: Tab; label: string }[] = [
    { key: 'main', label: t('admin.tabMain') },
    { key: 'ranges', label: t('admin.tabRanges') },
    { key: 'content', label: t('admin.tabContent') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center">
      <Card className="flex max-h-[92dvh] w-full flex-col rounded-b-none p-0 sm:max-w-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold">
            {isEdit ? t('admin.editBiomarker') : t('admin.addBiomarker')}
          </h2>
          <Button variant="ghost" className="h-10 w-10 p-0" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="flex shrink-0 gap-1 px-5 pt-4">
          {TABS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={cn(
                'h-11 flex-1 rounded-xl px-3 text-sm font-medium transition-colors',
                tab === x.key
                  ? 'bg-primary-soft text-primary-ink'
                  : 'text-muted hover:bg-line/40 hover:text-ink',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {tab === 'main' && (
            <>
              <Field label={t('admin.canonicalName')}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vitamin D (25-OH)"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('admin.canonicalShort')}>
                  <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
                </Field>
                <Field label={t('admin.unit')}>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="нг/мл"
                  />
                </Field>
              </div>

              <Field label={t('admin.category')}>
                <Select
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder={t('admin.noCategory')}
                  options={[
                    { value: '', label: t('admin.noCategory') },
                    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('admin.precision')}>
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={precision}
                    onChange={(e) => setPrecision(e.target.value)}
                  />
                </Field>
                <Field label={t('admin.loinc')}>
                  <Input
                    value={loincCode}
                    onChange={(e) => setLoincCode(e.target.value)}
                    placeholder="14635-7"
                  />
                </Field>
              </div>

              {SUPPORTED_LOCALES.map((l) => (
                <div key={l} className="grid gap-3 sm:grid-cols-2">
                  <Field label={`${t('admin.nameIn')} ${LOCALE_LABELS[l as Locale]}`}>
                    <Input
                      value={names[l]?.name ?? ''}
                      onChange={(e) =>
                        setNames((p) => ({ ...p, [l]: { ...p[l], name: e.target.value } }))
                      }
                    />
                  </Field>
                  <Field label={t('admin.shortIn')}>
                    <Input
                      value={names[l]?.shortName ?? ''}
                      onChange={(e) =>
                        setNames((p) => ({ ...p, [l]: { ...p[l], shortName: e.target.value } }))
                      }
                    />
                  </Field>
                </div>
              ))}

              <label className="flex items-center gap-2 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-5 w-5 rounded border-line"
                />
                {t('admin.active')}
              </label>
            </>
          )}

          {tab === 'ranges' && (
            <RangesEditor ranges={ranges} onChange={setRanges} />
          )}

          {tab === 'content' && (
            <>
              {!isEdit ? (
                // Контент — окремий ресурс під slug, якого до створення ще
                // немає. Чесніше сказати це, ніж тримати форму, що мовчки
                // загубить введене.
                <p className="rounded-xl bg-paper p-4 text-sm text-muted">
                  {t('admin.contentAfterCreate')}
                </p>
              ) : (
                <ContentEditor
                  slug={biomarker.slug}
                  locale={contentLocale}
                  onLocaleChange={setContentLocale}
                  existing={allContent?.find((c) => c.locale === contentLocale) ?? null}
                />
              )}
            </>
          )}
        </div>

        {tab !== 'content' && (
          <div className="shrink-0 border-t border-line p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
            {save.isError && <p className="mb-3 text-sm text-alert">{t('admin.saveError')}</p>}
            <Button className="w-full" disabled={!canSubmit || save.isPending} onClick={submit}>
              {save.isPending ? t('addResult.saving') : t('admin.save')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Кілька референсних діапазонів зі статтю й віком. */
function RangesEditor({
  ranges,
  onChange,
}: {
  ranges: ReferenceRangeInput[];
  onChange: (r: ReferenceRangeInput[]) => void;
}) {
  const { t } = useTranslation();

  function patch(i: number, part: Partial<ReferenceRangeInput>) {
    onChange(ranges.map((r, idx) => (idx === i ? { ...r, ...part } : r)));
  }

  // Порожній рядок ≠ 0: undefined лишає межу невизначеною («немає верхньої
  // межі»), а 0 — це справжнє значення.
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('admin.rangesHint')}</p>

      {ranges.map((r, i) => (
        <Card key={i} className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">#{i + 1}</span>
            <Button
              variant="ghost"
              aria-label={t('admin.removeRange')}
              className="h-9 w-9 p-0"
              onClick={() => onChange(ranges.filter((_, idx) => idx !== i))}
            >
              <Trash2 size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('admin.low')}>
              <Input
                type="number"
                step="any"
                value={r.low ?? ''}
                onChange={(e) => patch(i, { low: num(e.target.value) })}
              />
            </Field>
            <Field label={t('admin.high')}>
              <Input
                type="number"
                step="any"
                value={r.high ?? ''}
                onChange={(e) => patch(i, { high: num(e.target.value) })}
              />
            </Field>
            <Field label={t('admin.optimalLow')}>
              <Input
                type="number"
                step="any"
                value={r.optimalLow ?? ''}
                onChange={(e) => patch(i, { optimalLow: num(e.target.value) })}
              />
            </Field>
            <Field label={t('admin.optimalHigh')}>
              <Input
                type="number"
                step="any"
                value={r.optimalHigh ?? ''}
                onChange={(e) => patch(i, { optimalHigh: num(e.target.value) })}
              />
            </Field>
          </div>

          <Field label={t('admin.sex')}>
            <Select
              value={r.sex ?? 'ANY'}
              onChange={(v) => patch(i, { sex: v as Sex })}
              options={[
                { value: 'ANY', label: t('admin.sexAny') },
                { value: 'MALE', label: t('admin.sexMale') },
                { value: 'FEMALE', label: t('admin.sexFemale') },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('admin.ageMin')}>
              <Input
                type="number"
                value={r.ageMinYears ?? ''}
                onChange={(e) => patch(i, { ageMinYears: num(e.target.value) })}
              />
            </Field>
            <Field label={t('admin.ageMax')}>
              <Input
                type="number"
                value={r.ageMaxYears ?? ''}
                onChange={(e) => patch(i, { ageMaxYears: num(e.target.value) })}
              />
            </Field>
          </div>

          <Field label={t('admin.rangeSource')}>
            <Input
              value={r.source ?? ''}
              onChange={(e) => patch(i, { source: e.target.value || undefined })}
              placeholder="ESC 2016"
            />
          </Field>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={() => onChange([...ranges, {}])}>
        <Plus size={16} /> {t('admin.addRange')}
      </Button>
    </div>
  );
}

/** Довідковий контент однієї локалі. */
function ContentEditor({
  slug,
  locale,
  onLocaleChange,
  existing,
}: {
  slug: string;
  locale: string;
  onLocaleChange: (l: string) => void;
  existing: BiomarkerContent | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<BiomarkerContentInput>({});

  // Ключ по локалі: без нього перемикання мови лишало б у полях текст
  // попередньої, і адмін зберіг би його не туди.
  // lastReviewedAt з сервера може бути null, а DTO приймає лише рядок або
  // його відсутність — інакше збереження впало б на валідації.
  const { lastReviewedAt, locale: _l, ...base } = existing ?? ({} as BiomarkerContent);
  const state: BiomarkerContentInput = {
    ...base,
    ...(lastReviewedAt ? { lastReviewedAt } : {}),
    ...form,
  };

  const save = useMutation({
    mutationFn: (body: BiomarkerContentInput) => api.saveBiomarkerContent(slug, locale, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biomarker-content', slug] });
      qc.invalidateQueries({ queryKey: ['biomarkers', 'admin'] });
      setForm({});
    },
  });

  const text = (key: keyof BiomarkerContentInput, rows = 3) => (
    <Field label={t(`content.${key}` as string)}>
      <textarea
        value={(state[key] as string) ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        rows={rows}
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </Field>
  );

  const list = (key: keyof BiomarkerContentInput) => (
    <Field label={t(`content.${key}` as string)}>
      <Input
        value={((state[key] as string[]) ?? []).join(', ')}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            [key]: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }))
        }
        placeholder={t('admin.commaSeparated')}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setForm({});
              onLocaleChange(l);
            }}
            className={cn(
              'h-11 flex-1 rounded-xl px-3 text-sm font-medium transition-colors',
              locale === l
                ? 'bg-primary-soft text-primary-ink'
                : 'text-muted hover:bg-line/40 hover:text-ink',
            )}
          >
            {LOCALE_LABELS[l as Locale]}
          </button>
        ))}
      </div>

      {/* Той самий дисклеймер, що бачить користувач — щоб автор писав, тримаючи
          в голові рамку освітнього тексту, а не призначень. */}
      <p className="rounded-xl bg-primary-soft p-3 text-xs text-primary-ink">
        {t('content.disclaimer')}
      </p>

      {text('overview')}

      {/* Ключі, а не текст: саме за ними малюються чипи з іконками на сторінці
          показника. Проза нижче лишається підписом під ними. */}
      <KeyPicker
        label={t('content.relatedSystems')}
        options={BODY_SYSTEM_KEYS}
        selected={(state.relatedSystemKeys ?? []).filter(isBodySystemKey)}
        onChange={(v) => setForm((p) => ({ ...p, relatedSystemKeys: v }))}
        renderIcon={(k) => <SystemIcon name={k as never} />}
        labelFor={(k) => t(`systems.${k}`)}
      />
      <KeyPicker
        label={t('content.functionalLinks')}
        options={FUNCTIONAL_TAG_KEYS}
        selected={(state.functionalTagKeys ?? []).filter(isFunctionalTagKey)}
        onChange={(v) => setForm((p) => ({ ...p, functionalTagKeys: v }))}
        renderIcon={(k) => <FunctionalIcon name={k as never} />}
        labelFor={(k) => t(`functional.${k}`)}
      />
      {text('whatItMeasures')}
      {text('roleInBody')}
      {text('relatedSystems')}
      {text('functionalLinks')}
      {text('lowMeaning')}
      {text('highMeaning')}
      {text('influencingFactors')}
      {text('preparation')}
      {list('commonlyEvaluatedWith')}
      {list('confirmatoryTests')}
      {text('foodSources')}
      {text('supplementsInfo')}
      {text('drugClassesInfo')}

      {save.isError && <p className="text-sm text-alert">{t('admin.saveError')}</p>}

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(state)}>
        {save.isPending ? t('addResult.saving') : t('admin.saveContent')}
      </Button>
    </div>
  );
}

/**
 * Мультиселект ключів таксономії. Чипи-перемикачі, а не список із чекбоксами:
 * ключів десяток, і вигляд тут той самий, що й на сторінці показника — адмін
 * одразу бачить результат, а не абстрактний перелік.
 */
function KeyPicker({
  label,
  options,
  selected,
  onChange,
  renderIcon,
  labelFor,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  renderIcon: (key: string) => React.ReactNode;
  labelFor: (key: string) => string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((k) => {
          const on = selected.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== k) : [...selected, k])}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                on
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
              )}
            >
              {renderIcon(k)}
              {labelFor(k)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
