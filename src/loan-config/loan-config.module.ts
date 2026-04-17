import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsModule } from '../groups/groups.module';
import { LoanConfigController } from './loan-config.controller';
import { LoanConfigService } from './loan-config.service';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [LoanConfigController],
  providers: [LoanConfigService],
  exports: [LoanConfigService],
})
export class LoanConfigModule {}
