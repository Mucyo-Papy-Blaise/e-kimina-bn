import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CurrentUser } from '../decorators/current-user.decorator';
import { FinanceHistoryQueryDto } from './dto/finance-history-query.dto';
import { UserFinanceHistoryResponseDto } from './dto/finance-history-response.dto';
import { UserFinanceSummaryResponseDto } from './dto/finance-summary-response.dto';
import { UserFinanceUpcomingResponseDto } from './dto/finance-upcoming-response.dto';
import { UserFinanceService } from './user-finance.service';

@ApiTags('user-finance')
@ApiBearerAuth('JWT-auth')
@Controller('users/me/finance')
export class UserFinanceController {
  constructor(private readonly userFinance: UserFinanceService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Per-group contribution totals, penalties (late) for verified memberships',
  })
  @ApiOkResponse({ type: UserFinanceSummaryResponseDto })
  @ApiUnauthorizedResponse()
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.userFinance.getSummary(user.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Paginated history: paid contributions and confirmed bank deposits',
  })
  @ApiOkResponse({ type: UserFinanceHistoryResponseDto })
  @ApiUnauthorizedResponse()
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceHistoryQueryDto,
  ) {
    return this.userFinance.getHistory(
      user.id,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Open contributions, penalties, and manual deposits awaiting admin confirmation',
  })
  @ApiOkResponse({ type: UserFinanceUpcomingResponseDto })
  @ApiUnauthorizedResponse()
  getUpcoming(@CurrentUser() user: AuthenticatedUser) {
    return this.userFinance.getUpcoming(user.id);
  }
}
