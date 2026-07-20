import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_LOCALES } from '../../i18n/locale';

/** Локалізована назва категорії. */
export class CategoryTranslationDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class CreateCategoryDto {
  /** Канон і водночас відкат, коли перекладу потрібною мовою немає. */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  /** Не задано — згенеруємо з name, як у біомаркерах. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations?: CategoryTranslationDto[];
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  imageKey?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Передані переклади замінюють наявні для тих самих локалей (upsert).
   * Не передані — лишаються недоторканими: часткове редагування не має
   * стирати мову, якої зараз немає у формі.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations?: CategoryTranslationDto[];
}

/** Новий порядок категорій — масив id у бажаній послідовності. */
export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
