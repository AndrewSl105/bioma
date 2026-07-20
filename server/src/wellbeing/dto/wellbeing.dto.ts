import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertWellbeingDto {
  /** День чек-іну (YYYY-MM-DD). Один запис на день. */
  @IsDateString()
  date!: string;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  energy?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  sleepQuality?: number | null;

  /** Години сну — не шкала, тож окремі межі. 0..24 як фізична межа доби. */
  @IsOptional() @IsNumber() @Min(0) @Max(24)
  sleepHours?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  mood?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  digestion?: number | null;

  @IsOptional() @IsString() @MaxLength(2000)
  note?: string | null;
}
