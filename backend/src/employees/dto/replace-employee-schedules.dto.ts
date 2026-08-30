import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from '../../generated/prisma/enums';
export class EmployeeScheduleInputDto {
  @IsEnum(DayOfWeek) dayOfWeek!: DayOfWeek;
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  startTime!: string;
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  endTime!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class ReplaceEmployeeSchedulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeScheduleInputDto)
  schedules!: EmployeeScheduleInputDto[];
}
