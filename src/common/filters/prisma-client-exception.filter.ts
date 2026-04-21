import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.mapStatusCode(exception.code);

    this.logger.error(
      `Prisma ${exception.code}: ${exception.message}`,
      exception.meta != null ? JSON.stringify(exception.meta) : undefined,
    );

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
      case 'P2003':
        return HttpStatus.BAD_REQUEST;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private mapErrorName(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      default:
        return 'Internal Server Error';
    }
  }

  private mapMessage(exception: Prisma.PrismaClientKnownRequestError): string {
    const isProd = process.env.NODE_ENV === 'production';

    switch (exception.code) {
      case 'P2002':
        return 'A resource with the same unique field already exists.';
      case 'P2025':
        return 'The requested resource was not found.';
      case 'P2003':
        return isProd
          ? 'A database error occurred.'
          : `Foreign key constraint failed: ${exception.message}`;
      default:
        // In development, return Prisma’s message so you can see the real cause (missing table, bad FK, etc.).
        return isProd
          ? 'A database error occurred.'
          : `${exception.message} (Prisma ${exception.code})`;
    }
  }
}
