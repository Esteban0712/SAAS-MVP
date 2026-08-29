import { IsString, MaxLength, MinLength } from 'class-validator';

export class TenantLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  businessSlug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
