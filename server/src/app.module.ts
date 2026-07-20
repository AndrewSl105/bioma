import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ProfileModule } from './profile/profile.module';
import { BiomarkersModule } from './biomarkers/biomarkers.module';
import { CategoriesModule } from './categories/categories.module';
import { ResultsModule } from './results/results.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    BiomarkersModule,
    CategoriesModule,
    ResultsModule,
    AiModule,
  ],
  // Глобальні guard'и виконуються в порядку реєстрації: спершу автентифікація
  // (усі маршрути захищені, окрім @Public()), потім перевірка ролі для тих,
  // що позначені @Roles()/@AdminOnly().
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
