import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appConfig } from './config/app.config';

type AppConfig = ReturnType<typeof appConfig>;

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  getApiInfo() {
    return {
      name: this.configService.get('app.name', { infer: true }),
      version: this.configService.get('app.version', { infer: true }),
      environment: this.configService.get('app.nodeEnv', { infer: true }),
      docsPath: `/${this.configService.get('app.apiPrefix', { infer: true })}/docs`,
    };
  }
}
