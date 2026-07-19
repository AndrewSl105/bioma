# PROM — трекер аналізів з AI-розпізнаванням фото

Монорепо: перегляд динаміки лабораторних показників, референсні межі,
графіки та додавання результатів **вручну** або **з фото документа через AI (Claude vision)**.

```
prom/
├─ client/   React + TypeScript + Tailwind + Radix + Framer Motion + Recharts
├─ server/   NestJS + Prisma
└─ (БД)      Neon Postgres · Auth: Neon Auth (Stack Auth)
```

## Можливості
- **Показники та історія.** Кожен біомаркер (Вітамін D, холестерин, ТТГ…) має історію значень, тренд і графік динаміки з підсвіченою зоною норми.
- **Референси.** Межі норми залежать від статі/віку; є «оптимальний» діапазон і джерело.
- **Ручне додавання.** Показник → значення → дата → в історію. Прапорець «в нормі / поза нормою» рахується автоматично.
- **AI з фото.** Фото бланка → Claude витягує показники → ви звіряєте прев'ю → підтверджені значення падають в історію (`source = AI_PHOTO`).
- **PROM-модуль.** Каркас під опитувальники самопочуття (напр. PHQ-9) — моделі `PromInstrument` / `PromResponse`.

## Стек
| Шар | Технології |
|-----|-----------|
| Клієнт | React 18, TypeScript, Vite, Tailwind, Radix UI, Framer Motion, Recharts, TanStack Query, React Router |
| Сервер | NestJS 10, Prisma 5, Anthropic SDK, jose (JWT/JWKS) |
| БД / Auth | Neon Postgres · Neon Auth (Stack Auth) |

---

## Швидкий старт

### 0. Передумови
- Node 18+, `pnpm` (`npm i -g pnpm`) — або звичайний `npm` у кожній папці.
- Проєкт Neon з увімкненим **Neon Auth**.
- Ключ **Anthropic API**.

### 1. Змінні оточення
Скопіюйте `.env.example` → `server/.env` та `client/.env` і заповніть:

**server/.env**
```
DATABASE_URL="postgresql://…@…neon.tech/neondb?sslmode=require"
NEON_AUTH_JWKS_URL="https://api.stack-auth.com/api/v1/projects/<PROJECT_ID>/.well-known/jwks.json"
ANTHROPIC_API_KEY="sk-ant-…"
PORT=3001
CLIENT_ORIGIN="http://localhost:5173"
```

**client/.env**
```
VITE_API_URL=http://localhost:3001
VITE_STACK_PROJECT_ID=<PROJECT_ID>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=pck_…
VITE_AUTH_DEV_BYPASS=true   # локально — без реального логіну (мок-користувач)
```

### 2. Встановлення
```bash
pnpm install            # у корені (або npm install у client/ і server/)
```

### 3. База даних
```bash
pnpm --filter server db:migrate   # створює таблиці в Neon
pnpm --filter server db:seed      # каталог біомаркерів + PHQ-9
```
> `db:generate` (prisma generate) тягне движок Prisma з мережі — у деяких пісочницях
> це заблоковано. На вашій машині виконайте `npx prisma generate` у `server/` перед білдом.

### 4. Запуск
```bash
pnpm dev                # клієнт :5173 + сервер :3001 паралельно
```
Vite проксіює `/api` на сервер. Відкрийте http://localhost:5173.

---

## Автентифікація (Neon Auth)
`client/src/lib/auth.tsx` — абстракція з двома режимами:
- **dev-bypass** (`VITE_AUTH_DEV_BYPASS=true`) — мок-користувач і токен, застосунок працює одразу.
- **прод** — підключіть `@stackframe/react` (`StackProvider`), а `getToken()` замініть на
  отримання `accessToken` з поточного користувача. JWT надсилається у `Authorization: Bearer …`.

Сервер (`server/src/auth/auth.guard.ts`) перевіряє JWT проти JWKS проєкту (`jose`),
дістає `sub` як id користувача і синхронізує дзеркало в таблицю `User`.
Глобальний `APP_GUARD` захищає всі маршрути; для публічних — декоратор `@Public()`.

## AI-розпізнавання
`server/src/ai/ai.service.ts`:
1. `POST /api/ai/extract` (multipart, поле `file`) — фото → Claude (`claude-sonnet-5`, tool-use зі строгою JSON-схемою) → структуровані показники + мапінг на каталог (LOINC → назва). Створює `Document`, **не** пишучи в історію.
2. `POST /api/ai/commit` — підтверджені показники → `LabPanel` + `LabResult` (`source=AI_PHOTO`).

Двокроковість — навмисна: користувач звіряє розпізнане перед тим, як воно потрапить в історію.

## API (стисло)
```
GET    /api/overview                 останнє значення по кожному показнику
GET    /api/biomarkers               каталог (глобальні + власні)
GET    /api/results?biomarker=slug   історія + серія для графіка + референс
POST   /api/results                  додати значення вручну
DELETE /api/results/:id              видалити значення
POST   /api/ai/extract               фото → прев'ю показників
POST   /api/ai/commit                підтвердити → в історію
```

## Що варто доробити
- Реальне підключення `@stackframe/react` замість dev-bypass.
- Зберігання фото в об'єктному сховищі (зараз документ не персиститься як файл).
- Розширення каталогу біомаркерів і синонімів для точнішого AI-мапінгу.
- Наповнення PROM-модуля (проходження опитувальників, підрахунок балів, графіки).
- Конвертація одиниць (напр. нг/мл ↔ нмоль/л).

> ⚕️ Довідково, не медична порада. Референси спрощені — звіряйте з бланком вашої лабораторії.
