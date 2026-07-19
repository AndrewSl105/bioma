import { IsDateString, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { Sex } from '../../generated/prisma/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  /** null — свідомо скинути дату народження. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  birthDate?: string | null;
}
