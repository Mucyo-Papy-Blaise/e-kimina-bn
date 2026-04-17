import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.mapStatusCode(exception.code);

    response.status(status).json({
      statusCode: status,
      error: this.mapErrorName(status),
      message: this.mapMessage(exception),
    });
  }

  private mapStatusCode(code: string): HttpStatus {
    switch (code) {
      case 'P2002':
        return HttpStatus.CONFLICT;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private mapErrorName(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      default:
        return 'Internal Server Error';
    }
  }

  private mapMessage(exception: Prisma.PrismaClientKnownRequestError): string {
    switch (exception.code) {
      case 'P2002':
        return 'A resource with the same unique field already exists.';
      case 'P2025':
        return 'The requested resource was not found.';
      default:
        return 'A database error occurred.';
    }
  }
}
