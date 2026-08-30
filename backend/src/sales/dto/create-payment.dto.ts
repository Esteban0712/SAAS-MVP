import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '../../generated/prisma/enums';

export class CreatePaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) amount!: string;
  @IsOptional()
  @IsIn([PaymentStatus.PENDING, PaymentStatus.COMPLETED])
  status?: PaymentStatus;
  @IsOptional() @IsString() @MaxLength(500) externalReference?: string;
}
