import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupFinanceController } from './group-finance.controller';
import { GroupFinanceService } from './group-finance.service';

@Module({
  imports: [PrismaModule],
  controllers: [GroupFinanceController],
  providers: [GroupFinanceService],
  exports: [GroupFinanceService],
})
export class GroupFinanceModule {}
