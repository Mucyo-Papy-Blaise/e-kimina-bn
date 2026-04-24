import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserFinanceController } from './user-finance.controller';
import { UserLoansController } from './user-loans.controller';
import { UserFinanceService } from './user-finance.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserFinanceController, UserLoansController],
  providers: [UserFinanceService],
  exports: [UserFinanceService],
})
export class UserFinanceModule {}
