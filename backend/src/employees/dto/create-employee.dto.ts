import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @MinLength(1) @MaxLength(200) displayName!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(2_000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
