import { ArrayUnique, IsArray, IsUUID } from 'class-validator';
export class ReplaceEmployeeServicesDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) serviceIds!: string[];
}
