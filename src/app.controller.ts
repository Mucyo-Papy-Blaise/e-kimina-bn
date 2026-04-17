import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('meta')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Expose API metadata' })
  @ApiOkResponse({
    schema: {
      example: {
        name: 'nest-app',
        version: '0.0.1',
        environment: 'development',
        docsPath: '/api/docs',
      },
    },
  })
  getApiInfo() {
    return this.appService.getApiInfo();
  }
}
