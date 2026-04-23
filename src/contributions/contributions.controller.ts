import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { ContributionsService } from './contributions.service';
import { ContributionResponseDto } from './dto/contribution-response.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { ListContributionsQueryDto } from './dto/list-contributions-query.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';

@ApiTags('contributions')
@ApiBearerAuth('JWT-auth')
@Controller('groups/:groupId/contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary:
      'List contributions for a verified group. Members see only their rows; admins and treasurers see all (optional `userId` filter).',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: [ContributionResponseDto] })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: ListContributionsQueryDto,
  ) {
    return this.contributionsService.list(user.id, groupId, query);
  }

  @Get(':contributionId')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary:
      'Get one contribution. Members may only load their own; admins and treasurers any in the group.',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'contributionId', type: String })
  @ApiOkResponse({ type: ContributionResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.contributionsService.getById(user.id, groupId, contributionId);
  }

  @Post()
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Create a contribution record (expected payment). Group must be verified; target user must be an active member.',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiCreatedResponse({ type: ContributionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.contributionsService.create(user.id, groupId, dto);
  }

  @Patch(':contributionId')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Update status and/or payment time (e.g. mark PAID). Admins and treasurers only.',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'contributionId', type: String })
  @ApiOkResponse({ type: ContributionResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
    @Body() dto: UpdateContributionDto,
  ) {
    return this.contributionsService.update(
      user.id,
      groupId,
      contributionId,
      dto,
    );
  }
}
