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
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  price?: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
