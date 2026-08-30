import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SaleStatus } from '../../generated/prisma/enums';

export class ListSalesQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(SaleStatus) status?: SaleStatus;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
