import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { MyPendingManualDepositItemDto } from './dto/my-pending-manual-deposit-item.dto';
import { PendingDepositItemDto } from './dto/pending-deposit-item.dto';
import { RejectManualDepositDto } from './dto/reject-manual-deposit.dto';
import { GroupFinanceService } from './group-finance.service';
import { GroupLoansService } from './group-loans.service';
import { RejectLoanApplicationDto } from './dto/reject-loan-application.dto';

@ApiTags('group-finance')
@ApiBearerAuth('JWT-auth')
@Controller('groups/:groupId/finance')
export class GroupFinanceController {
  constructor(
    private readonly groupFinance: GroupFinanceService,
    private readonly groupLoans: GroupLoansService,
  ) {}

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
      proofImageUrl: dto.proofImageUrl,
      memberLoanId: dto.memberLoanId,
    });
  }

  @Get('deposits/my-pending')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({
    summary:
      'Your own manual bank transfers awaiting group admin proof review (read-only). MoMo is confirmed when recorded.',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: [MyPendingManualDepositItemDto] })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  getMyPendingManualDeposits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupFinance.getMyPendingManualDeposits(user.id, groupId);
  }

  @Get('deposits/pending')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Manual bank transfers with proof pending review (group admin or treasurer).',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ type: [PendingDepositItemDto] })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  listPendingManualDeposits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupFinance.listPendingManualDeposits(user.id, groupId);
  }

  @Post('deposits/:depositId/confirm')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary:
      'Confirm a manual bank deposit after proof review (group admin or treasurer; applies amounts to contributions or loan)',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'depositId', type: String })
  @ApiOkResponse({ description: 'Deposit confirmed; member emailed' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  confirmManualDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('depositId') depositId: string,
  ) {
    return this.groupFinance.confirmManualDeposit(user.id, groupId, depositId);
  }

  @Post('deposits/:depositId/reject')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary: 'Reject a manual bank deposit (group admin or treasurer); member is notified by email',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'depositId', type: String })
  @ApiOkResponse({ description: 'Deposit rejected; member emailed' })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  rejectManualDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('depositId') depositId: string,
    @Body() dto: RejectManualDepositDto,
  ) {
    return this.groupFinance.rejectManualDeposit(
      user.id,
      groupId,
      depositId,
      dto.reason,
    );
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

  @Get('loan-repayment-preview')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER, RoleName.MEMBER)
  @ApiOperation({ summary: 'Amount due to repay a specific member loan (group must match the loan)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiOkResponse({ description: 'Same shape as deposit preview with installment = loan balance' })
  loanRepaymentPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query('memberLoanId') memberLoanId: string,
  ) {
    if (!memberLoanId?.trim()) {
      return { configured: false, message: 'memberLoanId is required' };
    }
    return this.groupLoans.getLoanRepaymentPreviewForMember(
      user.id,
      groupId,
      memberLoanId.trim(),
    );
  }

  @Get('loan-applications')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary: 'List loan applications for this group (group admin and treasurer; dual approval required to disburse)',
  })
  @ApiParam({ name: 'groupId', type: String })
  listLoanApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupLoans.listLoanApplicationsForGroup(user.id, groupId);
  }

  @Get('member-loans')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({ summary: 'Active and historical member loans in this group' })
  @ApiParam({ name: 'groupId', type: String })
  listMemberLoans(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupLoans.listMemberLoansForGroup(user.id, groupId);
  }

  @Post('loan-applications/:applicationId/approve')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({
    summary: 'Record your approval as group admin or treasurer; loan disburses when both have approved',
  })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'applicationId', type: String })
  approveLoanApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.groupLoans.approveLoanApplication(
      user.id,
      groupId,
      applicationId,
    );
  }

  @Post('loan-applications/:applicationId/reject')
  @GroupRole(RoleName.GROUP_ADMIN, RoleName.TREASURER)
  @ApiOperation({ summary: 'Reject a pending loan (either role)' })
  @ApiParam({ name: 'groupId', type: String })
  @ApiParam({ name: 'applicationId', type: String })
  rejectLoanApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('applicationId') applicationId: string,
    @Body() dto: RejectLoanApplicationDto,
  ) {
    return this.groupLoans.rejectLoanApplication(
      user.id,
      groupId,
      applicationId,
      dto.reason,
    );
  }
}
