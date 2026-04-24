import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepositPaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({ example: 17000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: DepositPaymentMethod })
  @IsEnum(DepositPaymentMethod)
  paymentMethod!: DepositPaymentMethod;

  @ApiPropertyOptional({ description: 'Required when paymentMethod is MTN_MOMO' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Required when paymentMethod is MANUAL_TRANSFER — public URL of the uploaded receipt (e.g. from POST /upload).',
  })
  @ValidateIf((o: CreateDepositDto) => o.paymentMethod === DepositPaymentMethod.MANUAL_TRANSFER)
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  proofImageUrl?: string;

  @ApiPropertyOptional({
    description:
      'When set, this payment repays that member loan (same MoMo/manual rules as a normal deposit).',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  memberLoanId?: string;
}
