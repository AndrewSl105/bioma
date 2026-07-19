-- Документація контракту на рівні БД: UserProfile.userId дорівнює id
-- користувача з Neon Auth (claim "sub" у JWT), тобто neon_auth.users_sync.id.
-- FK свідомо НЕ ставимо: neon_auth — керована Neon схема, і зовнішній ключ
-- у неї нам не належить (Neon може перестворювати таблицю при синхронізації).
COMMENT ON TABLE "UserProfile" IS
  'Наші поля користувача. Особа (email, ім''я) живе тільки в Neon Auth (neon_auth.users_sync) і тут не дублюється.';

COMMENT ON COLUMN "UserProfile"."userId" IS
  'Дорівнює neon_auth.users_sync.id (claim "sub" з JWT). Без FK — neon_auth керується Neon.';
