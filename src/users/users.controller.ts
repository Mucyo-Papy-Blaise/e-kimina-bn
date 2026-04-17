import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Fetch the currently authenticated user' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Get()
  @Roles(RoleName.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users (platform SUPER_ADMIN only)' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fetch a user by id (platform SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
