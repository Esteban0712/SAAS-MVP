import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateInitialBranchDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
}

export class CreateInitialAdminDto {
  @IsString() @MinLength(3) @MaxLength(100) username!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'admin.password must contain uppercase, lowercase, number and symbol',
  })
  password!: string;

  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
}

export class CreatePlatformBusinessDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug!: string;

  @IsString() @MinLength(1) @MaxLength(100) timezone!: string;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter code' })
  currency!: string;

  @IsInt() @Min(1) @Max(1000000) maxUsers!: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) taxId?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;

  @ValidateNested()
  @Type(() => CreateInitialBranchDto)
  branch!: CreateInitialBranchDto;

  @ValidateNested()
  @Type(() => CreateInitialAdminDto)
  admin!: CreateInitialAdminDto;
}
