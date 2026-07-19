import { Global, Module } from '@nestjs/common';

/**
 * Гард реєструється глобально в AppModule і власних залежностей не має
 * (у БД він більше не пише). Модуль лишається місцем для майбутніх
 * auth-провайдерів.
 */
@Global()
@Module({})
export class AuthModule {}
