import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, fromAcceptLanguage, normalizeLocale, type Locale as LocaleTag } from './locale';

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
 */
export const Locale = createParamDecorator((_data: unknown, ctx: ExecutionContext): LocaleTag => {
  const req = ctx.switchToHttp().getRequest();
  return (
    normalizeLocale(req.query?.locale) ??
    normalizeLocale(req.headers?.['x-locale']) ??
    fromAcceptLanguage(req.headers?.['accept-language']) ??
    DEFAULT_LOCALE
  );
});
