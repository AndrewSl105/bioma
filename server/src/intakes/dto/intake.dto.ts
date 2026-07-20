import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DRUG_CLASS_KEYS } from '../../biomarkers/taxonomy';
import type { IntakeType } from '../../generated/prisma/enums';

const TYPES: IntakeType[] = ['MEDICATION', 'SUPPLEMENT'];

export class CreateIntakeDto {
  @IsIn(TYPES)
  type!: IntakeType;

  @IsString()
  @MaxLength(200)
  name!: string;

  /**
   * Невідомий ключ відхиляємо: якби він доїхав до БД, прив'язка мовчки не
   * спрацьовувала б, і виглядало б це як «плашка чомусь не показується».
   * null дозволений — це «клас не вказано».
   */
  @IsOptional()
  @IsIn(DRUG_CLASS_KEYS as unknown as string[])
  drugClassKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosageText?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateIntakeDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: IntakeType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn([...(DRUG_CLASS_KEYS as unknown as string[]), null])
  drugClassKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosageText?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  /** null тут — свідоме «знову приймає», а не «не змінювати». */
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
