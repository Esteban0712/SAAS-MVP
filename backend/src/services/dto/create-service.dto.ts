import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class CreateServiceDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsInt() @Min(1) @Max(1440) durationMinutes!: number;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) price!: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
