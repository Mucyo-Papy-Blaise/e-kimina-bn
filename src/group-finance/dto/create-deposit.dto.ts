import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepositPaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
}
