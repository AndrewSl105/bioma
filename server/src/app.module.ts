import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { BiomarkersModule } from './biomarkers/biomarkers.module';
import { ResultsModule } from './results/results.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BiomarkersModule,
    ResultsModule,
    AiModule,
  ],
  // Глобальний guard: усі маршрути захищені, окрім позначених @Public()
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
