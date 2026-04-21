import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { GroupRoleGuard } from './auth/guards/group-role.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { LoanConfigModule } from './loan-config/loan-config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    EmailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    GroupsModule,
    LoanConfigModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GroupRoleGuard,
    },
  ],
})
export class AppModule {}
