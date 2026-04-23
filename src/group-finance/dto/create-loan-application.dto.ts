import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CreateLoanApplicationDto {
  @ApiProperty({ example: 25_000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  requestedAmount!: number;
}
