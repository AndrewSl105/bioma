import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, fromAcceptLanguage, normalizeLocale, type Locale as LocaleTag } from './locale';

/** Мінімум із запиту, потрібний для визначення локалі. */
type LocaleRequest = {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
};

/**
 * Локаль поточного запиту. Пріоритет — від найбільш явного до найменш:
 *
 *   1. ?locale=      — явний намір у конкретному запиті (шеринг посилання).
 *   2. X-Locale       — вибір користувача, який клієнт шле на кожен запит.
 *   3. Accept-Language — те, що каже браузер.
 *   4. DEFAULT_LOCALE  — українська.
 *
 * Збережена в профілі мова свідомо НЕ читається тут: це коштувало б звернення
 * до БД на кожному запиті, включно з гарячим списком маркерів. Клієнт піднімає
 * profile.locale при старті й далі сам шле її в X-Locale — джерело те саме,
 * але без зайвого читання.
 *
 * Винесено з декоратора окремою функцією, щоб імена полів запиту
 * (саме 'x-locale' у нижньому регістрі, як їх віддає Node) можна було
 * перевірити тестом, а не лише очима.
 */
export function resolveLocale(req: LocaleRequest | undefined): LocaleTag {
  return (
    normalizeLocale(req?.query?.locale as string | undefined) ??
    normalizeLocale(req?.headers?.['x-locale'] as string | undefined) ??
    fromAcceptLanguage(req?.headers?.['accept-language'] as string | undefined) ??
    DEFAULT_LOCALE
  );
}

export const Locale = createParamDecorator((_data: unknown, ctx: ExecutionContext): LocaleTag =>
  resolveLocale(ctx.switchToHttp().getRequest()),
);
