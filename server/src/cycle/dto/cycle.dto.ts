import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { FlowLevel } from '../../generated/prisma/enums';

const FLOWS: FlowLevel[] = ['SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY'];

/** Ключі симптомів — мовно-незалежні, підписи живуть у словниках клієнта. */
export const SYMPTOM_KEYS = [
  'cramps', 'headache', 'bloating', 'backache', 'tender_breasts',
  'fatigue', 'nausea', 'acne', 'cravings', 'insomnia',
] as const;

export class UpsertCycleDayDto {
  @IsDateString()
  date!: string;

  @IsOptional() @IsBoolean()
  isPeriod?: boolean;

  @IsOptional() @IsIn(FLOWS)
  flow?: FlowLevel | null;

  @IsOptional() @IsArray() @IsIn(SYMPTOM_KEYS as unknown as string[], { each: true })
  symptoms?: string[];

  @IsOptional() @IsInt() @Min(1) @Max(5)
  mood?: number | null;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string | null;
}

export class UpdateCycleSettingsDto {
  /** Згода на трекінг. Без неї розділ не збирає нічого. */
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(15) @Max(90)
  avgCycleLength?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(15)
  avgPeriodLength?: number | null;

  @IsOptional() @IsIn(['awareness', 'conception', 'avoidance'])
  trackingGoal?: string | null;
}
