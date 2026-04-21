import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GroupRole } from '../decorators/group-role.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MemberActionReasonDto } from './dto/member-action-reason.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth('JWT-auth')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a group (creator becomes GROUP_ADMIN via UserGroup)',
  })
  @ApiCreatedResponse({ type: GroupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List groups with derived member counts',
    description:
      '`view=mine` — groups you are an active member of. `view=discover` — others’ public groups. `publicOnly=true` (without `view`) — legacy: all public groups.',
  })
  @ApiOkResponse({ type: GroupResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('publicOnly') publicOnly?: string,
    @Query('view') view?: string,
  ) {
    const onlyPublic =
      publicOnly === 'true' || publicOnly === '1' || publicOnly === 'yes';
    const normalizedView =
      view === 'mine' || view === 'discover' ? view : undefined;

    return this.groupsService.findAll(user.id, {
      view: normalizedView,
      legacyPublicOnly: onlyPublic && !normalizedView,
    });
  }

  @Get('removal-notifications')
  @ApiOperation({
    summary: 'List removal or suspension notices for the current user (groups only)',
  })
  @ApiOkResponse({ description: 'Notifications for the signed-in user' })
  listRemovalNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listRemovalNotifications(user.id);
  }

  @Patch('removal-notifications/:notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a dismissal notice as read' })
  @ApiParam({ name: 'notificationId', type: String })
  @ApiNoContentResponse({ description: 'Marked read' })
  markRemovalNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.groupsService.markRemovalNotificationRead(user.id, notificationId);
  }

  @Get(':groupId/members')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary:
      'List members in the group (admins see suspended; others see active only)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ description: 'Members with role and status' })
  @ApiForbiddenResponse({ description: 'Not a member of this group' })
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.listMembers(groupId, user.id);
  }

  @Patch(':groupId')
  @GroupRole(RoleName.GROUP_ADMIN)
  @ApiOperation({ summary: 'Update group name or description (GROUP_ADMIN)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: GroupResponseDto })
  updateGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(user.id, groupId, dto);
  }

  @Delete(':groupId')
  @GroupRole(RoleName.GROUP_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the group (GROUP_ADMIN only)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiNoContentResponse({ description: 'Group deleted' })
  @ApiForbiddenResponse({ description: 'Not group admin' })
  deleteGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.deleteGroup(user.id, groupId);
  }

  @Delete(':groupId/members/:memberUserId')
  @GroupRole(RoleName.GROUP_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Remove a member from the group (not platform-wide); user is notified with reason',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'memberUserId', type: String })
  @ApiNoContentResponse({ description: 'Member removed' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: MemberActionReasonDto,
  ) {
    return this.groupsService.removeMember(
      user.id,
      groupId,
      memberUserId,
      dto.reason,
    );
  }

  @Patch(':groupId/members/:memberUserId/suspend')
  @GroupRole(RoleName.GROUP_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Suspend a member in this group only (they can still log in; notified with reason)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'memberUserId', type: String })
  @ApiNoContentResponse({ description: 'Member suspended' })
  suspendMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: MemberActionReasonDto,
  ) {
    return this.groupsService.suspendMember(
      user.id,
      groupId,
      memberUserId,
      dto.reason,
    );
  }

  @Patch(':groupId/members/:memberUserId/reactivate')
  @GroupRole(RoleName.GROUP_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reactivate a suspended member (GROUP_ADMIN)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'memberUserId', type: String })
  @ApiNoContentResponse({ description: 'Member reactivated' })
  reactivateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.groupsService.reactivateMember(user.id, groupId, memberUserId);
  }

  @Post(':groupId/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Join a group as MEMBER (if capacity allows)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiNoContentResponse({ description: 'Joined successfully' })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    await this.groupsService.join(user.id, groupId);
  }

  @Post(':groupId/invite-member')
  @HttpCode(HttpStatus.OK)
  @GroupRole(RoleName.GROUP_ADMIN)
  @ApiOperation({
    summary:
      'Invite a team member by email (GROUP_ADMIN only; completes registration like treasurer invite)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Not group admin' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.groupsService.inviteMember(user.id, groupId, dto.email);
  }

  @Patch(':groupId/verify')
  @Roles(RoleName.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Mark a group as verified (platform SUPER_ADMIN only — enables loan features)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  verify(@Param('groupId') groupId: string) {
    return this.groupsService.verifyGroup(groupId);
  }

  @Patch(':groupId/toggle-public')
  @GroupRole(RoleName.GROUP_ADMIN)
  @ApiOperation({
    summary: 'Toggle a group between public and private (GROUP_ADMIN only)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  togglePublic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body('isPublic') isPublic: boolean,
  ) {
    return this.groupsService.togglePublic(user.id, groupId, isPublic);
  }

  @Get(':groupId')
  @ApiOperation({
    summary: 'Get group details (must be an active member)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse({ description: 'Not a member' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.findOneForUser(groupId, user.id);
  }
}
