import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserFinanceService } from './user-finance.service';

@ApiTags('user-finance')
@ApiBearerAuth('JWT-auth')
@Controller('users/me/loans')
export class UserLoansController {
  constructor(private readonly userFinance: UserFinanceService) {}

  @Get()
  @ApiOperation({
    summary: 'Your loan applications and active/completed member loans (all groups)',
  })
  @ApiOkResponse({ description: 'Applications with dual-approval state + disbursed loans' })
  @ApiUnauthorizedResponse()
  getMyLoans(@CurrentUser() user: AuthenticatedUser) {
    return this.userFinance.getUserLoans(user.id);
  }
}
