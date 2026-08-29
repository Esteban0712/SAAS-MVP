import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { OriginValidationMiddleware } from './origin-validation.middleware';

describe('OriginValidationMiddleware', () => {
  const config = {
    get: jest.fn((_key: string, fallback: string) => fallback),
  };
  const middleware = new OriginValidationMiddleware(
    config as unknown as ConfigService,
  );
  const response = {} as Response;
  const next = jest.fn() as NextFunction;

  beforeEach(() => jest.clearAllMocks());

  it('allows a mutation from the configured frontend', () => {
    const request = {
      method: 'POST',
      get: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as Request;

    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects a mutation from another origin', () => {
    const request = {
      method: 'POST',
      get: jest.fn().mockReturnValue('https://untrusted.example'),
    } as unknown as Request;

    expect(() => middleware.use(request, response, next)).toThrow(
      ForbiddenException,
    );
  });
});
