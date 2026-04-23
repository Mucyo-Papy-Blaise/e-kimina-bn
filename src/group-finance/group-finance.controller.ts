import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateLoanApplicationDto } from './dto/create-loan-application.dto';
import { DepositPreviewResponseDto } from './dto/deposit-preview-response.dto';
import { LoanRequestPreviewResponseDto } from './dto/loan-request-preview.dto';
import { GroupFinanceService } from './group-finance.service';

@ApiTags('group-finance')
@ApiBearerAuth('JWT-auth')
@Controller('groups/:groupId/finance')
export class GroupFinanceController {
  constructor(private readonly groupFinance: GroupFinanceService) {}

  @Get('deposit-preview')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({ summary: 'Amount breakdown for a deposit (contribution, fines, installment)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: DepositPreviewResponseDto })
  @ApiNotFoundResponse({ description: 'Group not found' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  depositPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupFinance.getDepositPreview(user.id, groupId);
  }

  @Post('deposits')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({ summary: 'Record a deposit (MoMo or manual); validates against contribution rules' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiCreatedResponse({ description: 'Deposit recorded' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  createDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateDepositDto,
  ) {
    return this.groupFinance.createDeposit(user.id, groupId, {
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      phone: dto.phone,
    });
  }

  @Get('loan-request-preview')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary: 'Eligibility and caps for a loan from group loan rules and member contributions',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: LoanRequestPreviewResponseDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  loanRequestPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupFinance.getLoanRequestPreview(user.id, groupId);
  }

  @Post('loan-applications')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({ summary: 'Submit a loan request within configured limits' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiCreatedResponse({ description: 'Application created' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  createLoanApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateLoanApplicationDto,
  ) {
    return this.groupFinance.createLoanApplication(
      user.id,
      groupId,
      dto.requestedAmount,
    );
  }
}
