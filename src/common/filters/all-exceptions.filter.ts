import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

// Database errors that are the client's fault, not a server bug.
const PRISMA_ERRORS: Record<
  string,
  { statusCode: number; error: string; message: string }
> = {
  P2002: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: 'A record with these details already exists',
  },
  P2003: {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    message: 'A related record does not exist',
  },
  P2025: {
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    message: 'Record not found',
  },
};

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Gives every error the same JSON shape so the Flutter apps can parse
 * failures in one place. Unexpected errors are logged and hidden from clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Something went wrong';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const { message: bodyMessage, error: bodyError } = body as {
          message?: string | string[];
          error?: string;
        };
        message = bodyMessage ?? exception.message;
        error = bodyError ?? exception.name;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code in PRISMA_ERRORS
    ) {
      ({ statusCode, error, message } = PRISMA_ERRORS[exception.code]);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Input the DTOs let through but the database can't take, such as null
      // for a required column. Logged in case it's our bug; only the reason
      // line, since the full message echoes the query's data.
      this.logger.warn(
        `Invalid database input on ${request.method} ${request.originalUrl}: ` +
          exception.message.trim().split('\n').at(-1),
      );
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Some fields have invalid values';
    } else {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ErrorResponse = {
      statusCode,
      error,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(payload);
  }
}
