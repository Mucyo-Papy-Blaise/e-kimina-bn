import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsModule } from '../groups/groups.module';
import { ContributionConfigController } from './contribution-config.controller';
import { ContributionConfigService } from './contribution-config.service';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [ContributionConfigController],
  providers: [ContributionConfigService],
  exports: [ContributionConfigService],
})
export class ContributionConfigModule {}
