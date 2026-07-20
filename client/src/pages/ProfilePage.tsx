import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Profile, type UpdateProfileBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card, Field } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';

const SMOKING = ['NEVER', 'FORMER', 'CURRENT'] as const;
const ALCOHOL = ['NONE', 'OCCASIONAL', 'REGULAR'] as const;
const ACTIVITY = ['SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH'] as const;

/** Порожній рядок у Select означає «не вказано» і зберігається як null. */
const NOT_SET = '';

/**
 * Профіль: стать і дата народження (від них залежить добір референсів) плюс
 * спосіб життя.
 *
 * Спосіб життя — контекст, а не анкета: кожне поле можна лишити порожнім і
 * будь-коли прибрати відповідь. Ми не питаємо цифр («скільки саме ви п'єте»)
 * і нічого з цих відповідей не діагностуємо — вони лише пояснюють, чому
 * показник може поводитись так, а не інакше.
 *
 * Менструальний цикл сюди свідомо НЕ входить: він винесений в окремий пізніший
 * етап і потребує власного тумблера згоди.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.profile,
    enabled: !!user,
  });

  const [draft, setDraft] = useState<Partial<Profile>>({});
  useEffect(() => setDraft(profile ?? {}), [profile]);

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateProfileBody = {
        sex: (draft.sex ?? undefined) || undefined,
        birthDate: draft.birthDate || null,
        // Порожній вибір надсилаємо саме як null, а не пропускаємо: пропуск
        // означав би «не змінювати», і прибрати відповідь стало б неможливо.
        smokingStatus: (draft.smokingStatus as Profile['smokingStatus']) ?? null,
        alcoholUse: (draft.alcoholUse as Profile['alcoholUse']) ?? null,
        activityLevel: (draft.activityLevel as Profile['activityLevel']) ?? null,
      };
      return api.updateProfile(body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  if (isLoading) return <p className="text-sm text-muted">{t('app.loading')}</p>;

  const pick = <K extends keyof Profile>(key: K) => (v: string) =>
    setDraft((d) => ({ ...d, [key]: (v === NOT_SET ? null : v) as Profile[K] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('profile.title')}</h1>
        <p className="text-sm text-muted">{t('profile.subtitle')}</p>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-medium">{t('profile.basics')}</h2>
        <p className="text-xs text-muted">{t('profile.basicsHint')}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('profile.sex')}>
            <Select
              value={draft.sex ?? NOT_SET}
              onChange={pick('sex')}
              placeholder={t('profile.notSet')}
              options={[
                { value: 'MALE', label: t('admin.sexMale') },
                { value: 'FEMALE', label: t('admin.sexFemale') },
              ]}
            />
          </Field>
          <Field label={t('profile.birthDate')}>
            <DatePicker
              value={draft.birthDate?.slice(0, 10) ?? ''}
              onChange={(v) => setDraft((d) => ({ ...d, birthDate: v }))}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-medium">{t('profile.lifestyle')}</h2>
        <p className="text-xs text-muted">{t('profile.lifestyleHint')}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('profile.smoking')}>
            <Select
              value={draft.smokingStatus ?? NOT_SET}
              onChange={pick('smokingStatus')}
              placeholder={t('profile.notSet')}
              options={SMOKING.map((v) => ({ value: v, label: t(`profile.smokingValue.${v}`) }))}
            />
          </Field>
          <Field label={t('profile.alcohol')}>
            <Select
              value={draft.alcoholUse ?? NOT_SET}
              onChange={pick('alcoholUse')}
              placeholder={t('profile.notSet')}
              options={ALCOHOL.map((v) => ({ value: v, label: t(`profile.alcoholValue.${v}`) }))}
            />
          </Field>
          <Field label={t('profile.activity')}>
            <Select
              value={draft.activityLevel ?? NOT_SET}
              onChange={pick('activityLevel')}
              placeholder={t('profile.notSet')}
              options={ACTIVITY.map((v) => ({ value: v, label: t(`profile.activityValue.${v}`) }))}
            />
          </Field>
        </div>
      </Card>

      <Button disabled={save.isPending || !online} title={online ? undefined : offlineHint()} onClick={() => save.mutate()}>
        {save.isPending ? t('app.saving') : t('profile.save')}
      </Button>
      {save.isError && <p className="text-sm text-alert">{(save.error as Error).message}</p>}
    </div>
  );
}
