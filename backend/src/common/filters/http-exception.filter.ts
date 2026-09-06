import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  message?: string | string[];
  error?: string;
  status?: string;
  database?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const isPayloadTooLarge = this.isPayloadTooLarge(exception);
    const statusCode = isHttpException
      ? exception.getStatus()
      : isPayloadTooLarge
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = isHttpException
      ? this.getErrorResponse(exception)
      : isPayloadTooLarge
        ? { message: 'Payload too large', error: 'Payload Too Large' }
        : {
            message: 'Internal server error',
            error: 'Internal Server Error',
          };

    if (!isHttpException && !isPayloadTooLarge) {
      this.logger.error('Unhandled internal server error');
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message: details.message,
      error: details.error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details.status ? { status: details.status } : {}),
      ...(details.database ? { database: details.database } : {}),
    });
  }

  private isPayloadTooLarge(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'type' in exception &&
      exception.type === 'entity.too.large'
    );
  }

  private getErrorResponse(exception: HttpException): ErrorResponse {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        message: response,
        error: this.getStatusLabel(exception.getStatus()),
      };
    }

    const details = response as ErrorResponse;

    return {
      message: details.message ?? exception.message,
      error: details.error ?? this.getStatusLabel(exception.getStatus()),
      status: details.status,
      database: details.database,
    };
  }

  private getStatusLabel(statusCode: number): string {
    return String(HttpStatus[statusCode])
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
