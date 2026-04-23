import { ApiProperty } from '@nestjs/swagger';

export class ContributionUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;
}
