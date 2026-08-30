import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SaleItemDto } from './sale-item.dto';

export class CreateSaleDto {
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  discountTotal?: string;
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  taxTotal?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
