import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { authClient } from '@/lib/authClient';
import { Button, Card, Field, Input } from '@/components/ui/primitives';

type Mode = 'signIn' | 'signUp';

/** Google-логотип: у lucide брендових іконок немає, тож inline-SVG. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.900l-.3.1-6.7 5.2-.1.3C7.9 40.9 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 27.6c-.5-1.4-.7-2.9-.7-4.6s.3-3.2.7-4.6v-.3l-6.8-5.3-.2.1A22 22 0 0 0 2 23c0 3.5.9 6.9 2.5 9.9l7-5.3z" />
      <path fill="#EB4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.3 29.9 1 24 1 15.4 1 7.9 6.1 4.5 13.1l7 5.4C13.3 12.4 18.2 9.5 24 9.5z" />
    </svg>
  );
}

/**
 * Вхід / реєстрація через Neon Auth (email + пароль або Google).
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

  /**
   * Вхід через Google. Це редирект на провайдера й назад, тож pending з нього
   * не знімаємо: успішний виклик забирає користувача зі сторінки, і скидання
   * стану лише блимнуло б кнопкою перед самим переходом.
   */
  async function signInWithGoogle() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        // Повертаємось на поточний origin: у dev це localhost, у проді —
        // домен застосунку, і хардкод тут ламав би одне з двох.
        callbackURL: window.location.origin,
      });
      if (res.error) {
        setError(res.error.message ?? t('login.googleFailed'));
        setPending(false);
      }
    } catch {
      setError(t('login.googleFailed'));
      setPending(false);
    }
  }

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

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full"
        disabled={pending}
        onClick={() => void signInWithGoogle()}
      >
        <GoogleMark />
        {t('login.withGoogle')}
      </Button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">{t('login.or')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
