import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
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
  @ApiOperation({ summary: 'List groups with derived member counts' })
  @ApiOkResponse({ type: GroupResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get a group by id' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findOne(@Param('groupId') groupId: string) {
    return this.groupsService.findOne(groupId);
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
}
