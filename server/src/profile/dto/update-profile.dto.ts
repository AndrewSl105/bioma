import { IsDateString, IsEnum, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { Sex } from '../../generated/prisma/enums';
import { SUPPORTED_LOCALES } from '../../i18n/locale';

export class UpdateProfileDto {
  /**
   * Мова інтерфейсу. Перелік звужений до підтримуваних: у БД це вільний рядок,
   * і без валідації сюди приїхала б будь-яка локаль, для якої немає словників.
   */
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale?: string;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  /** null — свідомо скинути дату народження. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  birthDate?: string | null;
}
