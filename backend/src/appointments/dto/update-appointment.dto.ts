import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AppointmentStatus } from '../../generated/prisma/enums';
export enum AppointmentAction {
  EDIT = 'EDIT',
  RESCHEDULE = 'RESCHEDULE',
  STATUS = 'STATUS',
}
export class UpdateAppointmentDto {
  @IsEnum(AppointmentAction) action!: AppointmentAction;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  serviceIds?: string[];
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsString() @MaxLength(2_000) notes?: string;
}
