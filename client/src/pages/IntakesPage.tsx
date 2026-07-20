import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pill, Plus, Trash2 } from 'lucide-react';
import { api, type DrugClassKey, type Intake, type IntakeType } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import { DRUG_CLASS_KEYS } from '@/lib/taxonomy';
import { fmtDate } from '@/lib/format';

/**
 * Ліки й добавки користувача.
 *
 * Чутливі дані: живуть лише в його акаунті, в адмінці їх немає. Ми нічого не
 * призначаємо й не інтерпретуємо — доза це вільний текст, який ми зберігаємо
 * і показуємо назад. Єдине, що з цього виростає, — освітня плашка на сторінці
 * показника, який може залежати від зазначеного класу.
 */
export function IntakesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: intakes, isLoading } = useQuery({
    queryKey: ['intakes'],
    queryFn: api.intakes,
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteIntake(id),
    // Плашка на сторінці показника читає той самий прийом — інвалідуємо і її,
    // інакше видалений препарат ще якийсь час «впливав» би на показник.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['intakes'] });
      void qc.invalidateQueries({ queryKey: ['biomarker-content'] });
    },
  });

  const active = (intakes ?? []).filter((i) => i.active);
  const past = (intakes ?? []).filter((i) => !i.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t('intakes.title')}</h1>
          <p className="text-sm text-muted">{t('intakes.subtitle')}</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={!online}
          title={online ? undefined : offlineHint()}
          onClick={() => setAdding((v) => !v)}
        >
          <Plus size={17} /> {t('intakes.add')}
        </Button>
      </div>

      <p className="rounded-2xl bg-primary-soft p-4 text-xs leading-relaxed text-primary-ink">
        {t('intakes.privacy')}
      </p>

      {adding && <IntakeForm onDone={() => setAdding(false)} />}

      {isLoading && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {!isLoading && !intakes?.length && !adding && (
        <Card className="p-10 text-center">
          <Pill className="mx-auto mb-3 text-primary" />
          <p className="font-medium">{t('intakes.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('intakes.emptyHint')}</p>
        </Card>
      )}

      {active.length > 0 && (
        <IntakeList title={t('intakes.active')} items={active} onDelete={(id) => del.mutate(id)} />
      )}
      {past.length > 0 && (
        <IntakeList title={t('intakes.past')} items={past} onDelete={(id) => del.mutate(id)} />
      )}
    </div>
  );
}

function IntakeList({
  title, items, onDelete,
}: { title: string; items: Intake[]; onDelete: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        {title} · {items.length}
      </h2>
      <Card className="divide-y divide-line">
        {items.map((i) => (
          <div key={i.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t(`intakes.type.${i.type}`)}
                {i.drugClassKey && ` · ${t(`drugClass.${i.drugClassKey}`)}`}
                {i.dosageText && ` · ${i.dosageText}`}
              </p>
              {(i.startDate || i.endDate) && (
                <p className="mt-0.5 text-xs text-muted">
                  {i.startDate ? fmtDate(i.startDate) : '…'} — {i.endDate ? fmtDate(i.endDate) : t('intakes.ongoing')}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              aria-label={t('intakes.delete')}
              className="h-11 w-11 shrink-0 p-0"
              onClick={() => onDelete(i.id)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function IntakeForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [type, setType] = useState<IntakeType>('MEDICATION');
  const [name, setName] = useState('');
  const [drugClassKey, setDrugClassKey] = useState<string>('');
  const [dosageText, setDosageText] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api.addIntake({
        type,
        name,
        // Порожній вибір означає «клас не вказано» — це припустимо, просто не
        // буде автоматичної прив'язки до показників.
        drugClassKey: (drugClassKey || null) as DrugClassKey | null,
        dosageText: dosageText || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['intakes'] });
      void qc.invalidateQueries({ queryKey: ['biomarker-content'] });
      onDone();
    },
  });

  return (
    <Card className="space-y-4 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('intakes.type_')}>
          <Select
            value={type}
            onChange={(v) => setType(v as IntakeType)}
            options={[
              { value: 'MEDICATION', label: t('intakes.type.MEDICATION') },
              { value: 'SUPPLEMENT', label: t('intakes.type.SUPPLEMENT') },
            ]}
          />
        </Field>
        <Field label={t('intakes.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('intakes.namePlaceholder')} />
        </Field>
      </div>

      <Field label={t('intakes.drugClass')}>
        <Select
          value={drugClassKey}
          onChange={setDrugClassKey}
          placeholder={t('intakes.drugClassNone')}
          options={DRUG_CLASS_KEYS.map((k) => ({ value: k, label: t(`drugClass.${k}`) }))}
        />
      </Field>
      <p className="text-xs text-muted">{t('intakes.drugClassHint')}</p>

      <Field label={t('intakes.dosage')}>
        <Input
          value={dosageText}
          onChange={(e) => setDosageText(e.target.value)}
          placeholder={t('intakes.dosagePlaceholder')}
        />
      </Field>

      <div className="flex gap-2">
        <Button disabled={!name || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t('app.saving') : t('intakes.save')}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t('intakes.cancel')}
        </Button>
      </div>
      {save.isError && <p className="text-sm text-alert">{(save.error as Error).message}</p>}
    </Card>
  );
}
