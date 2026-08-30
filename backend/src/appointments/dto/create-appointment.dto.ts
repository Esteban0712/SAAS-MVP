import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class CreateAppointmentDto {
  @IsUUID() branchId!: string;
  @IsUUID() customerId!: string;
  @IsUUID() employeeId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  serviceIds!: string[];
  @IsDateString() startAt!: string;
  @IsOptional() @IsString() @MaxLength(2_000) notes?: string;
}
