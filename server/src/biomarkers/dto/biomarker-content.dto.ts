import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Медичне джерело: назва + посилання. */
export class MedicalSourceDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  /** Опційний: у частині джерел є лише назва (друковані настанови). */
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;
}

/** Довжина одного текстового розділу. Це довідка, а не стаття. */
const SECTION = 4000;

/**
 * Довідковий контент про біомаркер для однієї мови.
 *
 * Усі поля опційні: контент наповнюється поступово, і адмін має мати змогу
 * зберегти половину форми. Тон — освітній і описовий; призначень і доз тут
 * бути не повинно, а клієнт показує все це лише разом із дисклеймером.
 */
export class BiomarkerContentDto {
  @IsOptional() @IsString() @MaxLength(SECTION) overview?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) whatItMeasures?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) roleInBody?: string;

  @IsOptional() @IsString() @MaxLength(SECTION) relatedSystems?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) functionalLinks?: string;

  @IsOptional() @IsString() @MaxLength(SECTION) lowMeaning?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) highMeaning?: string;

  @IsOptional() @IsString() @MaxLength(SECTION) influencingFactors?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) preparation?: string;

  /** Slug'и наявних маркерів або вільний текст для відсутніх у каталозі. */
  @IsOptional() @IsArray() @IsString({ each: true }) commonlyEvaluatedWith?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) confirmatoryTests?: string[];

  @IsOptional() @IsString() @MaxLength(SECTION) foodSources?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) supplementsInfo?: string;
  @IsOptional() @IsString() @MaxLength(SECTION) drugClassesInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicalSourceDto)
  medicalSources?: MedicalSourceDto[];

  @IsOptional() @IsDateString() lastReviewedAt?: string;
  @IsOptional() @IsString() @MaxLength(200) reviewedBy?: string;
}
