# Bioma — технічна документація

> Опис для користувачів — у [README](../README.md). Тут — як це влаштовано і як запустити для розробки.

Монорепо: перегляд динаміки лабораторних показників, референсні межі,
графіки та додавання результатів **вручну** або **з фото документа через AI (Claude vision)**.

```
prom/
├─ client/   React + TypeScript + Tailwind + Radix + Framer Motion + Recharts
├─ server/   NestJS + Prisma
└─ (БД)      Neon Postgres · Auth: Neon Auth (Better Auth)
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
| БД / Auth | Neon Postgres · Neon Auth (Better Auth) |

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
NEON_AUTH_JWKS_URL="https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth/.well-known/jwks.json"
ANTHROPIC_API_KEY="sk-ant-…"
PORT=3001
CLIENT_ORIGIN="http://localhost:5173"
```

**client/.env**
```
VITE_API_URL=http://localhost:3001
# Той самий хост, що й NEON_AUTH_JWKS_URL, але без /.well-known/jwks.json
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth
```

### 2. Встановлення
```bash
pnpm install            # у корені (або npm install у client/ і server/)
```

### 3. База даних
```bash
pnpm --filter server db:migrate   # створює таблиці в Neon
pnpm --filter server db:seed      # каталог біомаркерів + PHQ-9 + демо-дані пацієнта
```
Демо-дані пацієнта прив'язуються **виключно** до реального акаунта Neon Auth:
`SEED_USER_ID` (user id / `sub`) обов'язковий, без нього сід завершиться помилкою.
Сід сам створює цього користувача з профілем (стать/дата народження), тож
заходити в застосунок заздалегідь не потрібно:
```bash
cd server && SEED_USER_ID=<реальний-neon-auth-id> npm run db:seed
```
Сід ідемпотентний: повторний запуск не дублює панелі (матчинг за номером замовлення).
> `db:generate` (prisma generate) тягне движок Prisma з мережі — у деяких пісочницях
> це заблоковано. На вашій машині виконайте `npx prisma generate` у `server/` перед білдом.

### 4. Запуск
```bash
pnpm dev                # клієнт :5173 + сервер :3001 паралельно
```
Vite проксіює `/api` на сервер. Відкрийте http://localhost:5173.

---

## Демо-режим і Docker
Найшвидший спосіб підняти все локально — без Neon і без ключів:
```bash
docker compose up --build      # http://localhost:8080 · demo@bioma.app / demo1234
```
Compose піднімає три контейнери: `db` (Postgres 17), `server` (на старті сам
виконує `prisma migrate deploy` і сід) та `web` (статика Vite за nginx, який
проксіює `/api` на сервер — один origin, без CORS).

Демо-режим вмикається двома прапорцями:

| Де | Змінна | Що робить |
|----|--------|-----------|
| server | `DEMO_MODE=true` | `POST /api/auth/demo/login` видає власний HS256-JWT; guard перевіряє лише його, JWKS Neon не потрібен |
| server | `DEMO_EMAIL`, `DEMO_PASSWORD` | демо-логін (за замовч. `demo@bioma.app` / `demo1234`); `GET /api/auth/demo` віддає їх сторінці входу |
| server | `DEMO_USER_ID` | id демо-користувача (за замовч. `demo-user`), має збігатися з `SEED_USER_ID` |
| server | `DEMO_JWT_SECRET` | ключ підпису; без нього — випадковий на кожен старт |
| server | `SEED_DEMO_EXTRAS=true` | сід доливає вигадані тілесні метрики, самопочуття й добавки |
| client (build) | `VITE_DEMO_MODE=true` | вхід через демо-ендпоінт замість Neon Auth; `VITE_NEON_AUTH_URL` не потрібен |

Демо-користувач завжди має роль `user` — адмінка на публічному демо закрита.
Відвідувачі можуть змінювати демо-дані; щоб скинути їх: `docker compose down -v && docker compose up`.

Без Docker те саме: `DEMO_MODE=true` у `server/.env`, `VITE_DEMO_MODE=true` у `client/.env`,
далі `SEED_USER_ID=demo-user SEED_DEMO_EXTRAS=true npm run db:seed` і `pnpm dev`.

---

## Автентифікація (Neon Auth)
Neon Auth = керований **Better Auth** (не Stack Auth — це попередня реалізація Neon).

- `client/src/lib/authClient.ts` — клієнт `@neondatabase/neon-js` на `VITE_NEON_AUTH_URL`.
- `client/src/lib/auth.tsx` — тонкий адаптер (`useAuth`): сесія з `useSession()`,
  JWT з `authClient.token()` з кешуванням за `exp`, вихід через `signOut()`.
- `client/src/pages/LoginPage.tsx` — вхід/реєстрація email + пароль на власних примітивах.

JWT надсилається у `Authorization: Bearer …`; на 401 кеш токена скидається і запит
повторюється один раз.

Сервер (`server/src/auth/auth.guard.ts`) перевіряє JWT проти JWKS проєкту (`jose`),
дістає `sub` як id користувача і синхронізує дзеркало в таблицю `User`.
Глобальний `APP_GUARD` захищає всі маршрути; для публічних — декоратор `@Public()`.

**Локальна розробка без логіну (лише сервер):** `AUTH_DEV_BYPASS=true` у `server/.env`
змушує guard пропустити JWKS-перевірку і підставити фіксованого `dev-user` —
зручно для curl/тестів API. Клієнт завжди працює з реальним Neon Auth.
У проді має бути вимкнено.

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
- OAuth-провайдери та відновлення пароля в Neon Auth (зараз лише email + пароль).
- Зберігання фото в об'єктному сховищі (зараз документ не персиститься як файл).
- Розширення каталогу біомаркерів і синонімів для точнішого AI-мапінгу.
- Наповнення PROM-модуля (проходження опитувальників, підрахунок балів, графіки).
- Конвертація одиниць (напр. нг/мл ↔ нмоль/л).

> ⚕️ Довідково, не медична порада. Референси спрощені — звіряйте з бланком вашої лабораторії.
