import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupFinanceController } from './group-finance.controller';
import { GroupFinanceService } from './group-finance.service';
import { GroupLoansService } from './group-loans.service';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [GroupFinanceController],
  providers: [GroupFinanceService, GroupLoansService],
  exports: [GroupFinanceService, GroupLoansService],
})
export class GroupFinanceModule {}
