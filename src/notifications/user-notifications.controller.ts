import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationAudience } from '@prisma/client';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service.js';

function parseAudience(v: string | undefined): NotificationAudience | undefined {
  if (!v) return undefined;
  return (Object.values(NotificationAudience) as string[]).includes(v)
    ? (v as NotificationAudience)
    : undefined;
}

/** In-app financial / group workflow notifications. Any authenticated user. */
@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('users/me/notifications')
export class UserNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread in-app notification count' })
  @ApiQuery({ name: 'audience', required: false, enum: NotificationAudience })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiOkResponse()
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('audience') audienceRaw?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.notifications
      .unreadCount(user.id, {
        audience: parseAudience(audienceRaw),
        groupId: groupId || undefined,
      })
      .then((count) => ({ count }));
  }

  @Get()
  @ApiOperation({ summary: 'In-app notifications for the signed-in user' })
  @ApiQuery({ name: 'audience', required: false, enum: NotificationAudience })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Notification list' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('audience') audienceRaw?: string,
    @Query('groupId') groupId?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr != null && limitStr !== '' ? Number.parseInt(limitStr, 10) : undefined;
    return this.notifications.listForUser(user.id, {
      audience: parseAudience(audienceRaw),
      groupId: groupId || undefined,
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications (optionally filtered) as read' })
  @ApiQuery({ name: 'audience', required: false, enum: NotificationAudience })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Query('audience') audienceRaw?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.notifications
      .markAllRead(user.id, {
        audience: parseAudience(audienceRaw),
        groupId: groupId || undefined,
      })
      .then((r) => ({ updated: r.count }));
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notifications.markRead(user.id, notificationId);
  }
}
