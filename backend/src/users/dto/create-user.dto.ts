import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums';

export class CreateUserDto {
  @IsUUID()
  roleId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: (typeof UserStatus)[keyof typeof UserStatus];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
