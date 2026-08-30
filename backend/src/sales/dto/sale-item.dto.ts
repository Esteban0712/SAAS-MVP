import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SaleItemType } from '../../generated/prisma/enums';

export class SaleItemDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsEnum(SaleItemType) type!: SaleItemType;
  @IsString() @MinLength(1) @MaxLength(500) description!: string;
  @IsInt() @Min(1) @Max(10000) quantity!: number;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) unitPrice!: string;
}
