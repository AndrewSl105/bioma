import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateResultDto {
  @IsString()
  biomarkerSlug!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsDateString()
  measuredAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
