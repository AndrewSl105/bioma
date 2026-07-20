import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { authClient } from '@/lib/authClient';
import { Button, Card, Field, Input } from '@/components/ui/primitives';

type Mode = 'signIn' | 'signUp';

/**
 * Вхід / реєстрація через Neon Auth (email + пароль).
 * Свідомо на власних примітивах, а не на готовому UI-кіті Neon —
 * той тягне окремий CSS-пресет і конфліктував би з дизайн-системою.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  const canSubmit =
    email.trim() !== '' && password !== '' && (mode === 'signIn' || name.trim() !== '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || pending) return;

    setPending(true);
    setError(null);
    try {
      const res =
        mode === 'signIn'
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });

      if (res.error) {
        setError(res.error.message ?? t('login.failed'));
        return;
      }

      // Якщо в проєкті увімкнено підтвердження пошти, сесії тут ще не буде —
      // useSession лишиться порожнім, тож показуємо це явно.
      if (mode === 'signUp' && !res.data?.token) setVerifySent(true);
    } catch {
      setError(t('login.unavailable'));
    } finally {
      setPending(false);
    }
  }

  if (verifySent) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-bold">{t('login.verifyTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('login.verifyBody', { email })}</p>
        <Button
          variant="outline"
          className="mt-5 w-full"
          onClick={() => {
            setVerifySent(false);
            setMode('signIn');
          }}
        >
          {t('login.backToSignIn')}
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-xl font-bold">
        {mode === 'signIn' ? t('login.signInTitle') : t('login.signUpTitle')}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === 'signIn' ? t('login.signInSubtitle') : t('login.signUpSubtitle')}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'signUp' && (
          <Field label={t('login.name')}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder={t('login.namePlaceholder')}
            />
          </Field>
        )}

        <Field label={t('login.email')}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />
        </Field>

        <Field label={t('login.password')}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
          />
        </Field>

        {error && <p className="text-sm text-alert">{error}</p>}

        <Button type="submit" className="w-full" disabled={!canSubmit || pending}>
          {pending && <Loader2 size={16} className="animate-spin" />}
          {mode === 'signIn' ? t('login.signIn') : t('login.signUp')}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {mode === 'signIn' ? t('login.noAccount') : t('login.hasAccount')}{' '}
        <button
          type="button"
          className="font-medium text-primary hover:text-primary-ink"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        >
          {mode === 'signIn' ? t('login.toSignUp') : t('login.toSignIn')}
        </button>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
          <span className="font-display text-xl font-bold tracking-tight">Bioma</span>
        </div>
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  );
}
