import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Sex } from '../../generated/prisma/enums';
import { SUPPORTED_LOCALES } from '../../i18n/locale';
import { BiomarkerContentDto } from './biomarker-content.dto';

export class BiomarkerTranslationDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;
}

/** Референсний діапазон. Може залежати від статі й віку. */
export class ReferenceRangeDto {
  @IsOptional()
  @IsNumber()
  low?: number;

  @IsOptional()
  @IsNumber()
  high?: number;

  @IsOptional()
  @IsNumber()
  optimalLow?: number;

  @IsOptional()
  @IsNumber()
  optimalHigh?: number;

  @IsOptional()
  @IsIn(Object.values(Sex))
  sex?: Sex;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageMinYears?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageMaxYears?: number;

  /** Звідки взято межі — «ESC 2016», «виробник тесту» тощо. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}

export class CreateBiomarkerDto {
  /** Канонічна (англійська) назва. Локалізовані — у translations. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  precision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  loincCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiomarkerTranslationDto)
  translations?: BiomarkerTranslationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  referenceRanges?: ReferenceRangeDto[];

  /** Довідковий контент одразу, по локалях. Наповнюється й пізніше. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalizedContentDto)
  content?: LocalizedContentDto[];
}

/** Контент разом із міткою мови — для створення маркера «одним пострілом». */
export class LocalizedContentDto extends BiomarkerContentDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;
}

export class UpdateBiomarkerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit?: string;

  /** null — свідомо відв'язати від категорії. */
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  precision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  loincCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Передані переклади upsert-яться; не передані лишаються як є. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiomarkerTranslationDto)
  translations?: BiomarkerTranslationDto[];

  /**
   * Передані діапазони ЗАМІНЮЮТЬ усі наявні: діапазони не мають стабільного
   * ключа (стать+вік+джерело), і зливати їх поштучно означало б плодити дублі
   * при кожному збереженні форми.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  referenceRanges?: ReferenceRangeDto[];
}
