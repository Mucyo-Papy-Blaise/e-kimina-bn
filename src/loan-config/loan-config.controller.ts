import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GroupRole } from '../decorators/group-role.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { LoanConfigResponseDto } from './dto/loan-config-response.dto';
import { UpsertLoanConfigDto } from './dto/upsert-loan-config.dto';
import { LoanConfigService } from './loan-config.service';

@ApiTags('loan-config')
@ApiBearerAuth('JWT-auth')
@Controller('groups/:groupId/loan-config')
export class LoanConfigController {
  constructor(private readonly loanConfigService: LoanConfigService) {}

  @Get()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary: 'Get loan configuration for a verified group (members)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: LoanConfigResponseDto })
  @ApiNotFoundResponse({ description: 'Group or loan config not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.loanConfigService.getForMember(user.id, groupId);
  }

  @Put()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Create or update loan configuration (GROUP_ADMIN or TREASURER; group must be verified)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: LoanConfigResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpsertLoanConfigDto,
  ) {
    return this.loanConfigService.upsertForGroupAdminOrTreasurer(
      user.id,
      groupId,
      dto,
    );
  }
}
