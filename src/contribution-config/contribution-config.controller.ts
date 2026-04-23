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
import { ContributionConfigResponseDto } from './dto/contribution-config-response.dto';
import { UpsertContributionConfigDto } from './dto/upsert-contribution-config.dto';
import { ContributionConfigService } from './contribution-config.service';

@ApiTags('contribution-config')
@ApiBearerAuth('JWT-auth')
@Controller('groups/:groupId/contribution-config')
export class ContributionConfigController {
  constructor(
    private readonly contributionConfigService: ContributionConfigService,
  ) {}

  @Get()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary:
      'Get contribution schedule rules for a verified group. Returns `null` if not configured yet.',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({
    type: ContributionConfigResponseDto,
    description: 'Config, or `null` when none has been created.',
  })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.contributionConfigService.getForMember(user.id, groupId);
  }

  @Put()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Create or update contribution rules (GROUP_ADMIN or TREASURER; group must be verified).',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: ContributionConfigResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpsertContributionConfigDto,
  ) {
    return this.contributionConfigService.upsertForGroupAdminOrTreasurer(
      user.id,
      groupId,
      dto,
    );
  }
}
