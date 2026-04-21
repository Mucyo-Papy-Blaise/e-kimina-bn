import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class MemberActionReasonDto {
  @ApiProperty({
    example: 'No longer participating in weekly contributions.',
    description: 'Shown to the member as the reason for removal or suspension.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
