import { IsDateString, IsEnum, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { ActivityLevel, AlcoholUse, Sex, SmokingStatus } from '../../generated/prisma/enums';
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

  /**
   * Спосіб життя. null дозволений свідомо — це «не хочу вказувати», і
   * можливість прибрати відповідь тут така сама частина приватності, як і
   * можливість її не давати.
   */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(SmokingStatus)
  smokingStatus?: SmokingStatus | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(AlcoholUse)
  alcoholUse?: AlcoholUse | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel | null;
}
