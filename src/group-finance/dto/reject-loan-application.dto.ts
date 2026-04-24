import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectLoanApplicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  reason!: string;
}
