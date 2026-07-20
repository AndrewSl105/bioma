import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { BodyMetricKind } from '../../generated/prisma/enums';

const KINDS: BodyMetricKind[] = ['WEIGHT', 'WAIST', 'RESTING_HR', 'BP_SYSTOLIC', 'BP_DIASTOLIC'];

export class CreateBodyMetricDto {
  @IsIn(KINDS)
  kind!: BodyMetricKind;

  @IsNumber()
  value!: number;

  @IsDateString()
  measuredAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Тиск приходить ОДНИМ запитом із двома числами — це той самий вимір, і
 * розділяти його на два запити означало б лишати пару напівзаписаною, якщо
 * другий не дійде.
 */
export class CreateBloodPressureDto {
  @IsNumber()
  systolic!: number;

  @IsNumber()
  diastolic!: number;

  @IsDateString()
  measuredAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SetHeightDto {
  /** null прибирає зріст — тоді ІМТ просто перестає рахуватись. */
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(260)
  heightCm?: number | null;
}
